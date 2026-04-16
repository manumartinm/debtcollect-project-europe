import { ApifyClient } from "apify-client"

import { debtorEnrichmentLog } from "./task-logger.js"

/** Redact values for logs (Apify actor input may contain API tokens). */
function sanitizeActorInputForLog(input: Record<string, unknown>): Record<string, unknown> {
  const sensitive = /^(.*token.*|.*secret.*|.*password.*|.*apikey.*|.*api_key.*|token)$/i
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(input)) {
    if (sensitive.test(k)) {
      out[k] =
        typeof v === "string" && v.length > 0 ? `[redacted:${v.length}chars]` : "[redacted]"
    } else {
      out[k] = v
    }
  }
  return out
}

export type ActorRunResult<T = Record<string, unknown>> = {
  items: T[]
  runUrl: string
  actorId: string
  runId: string
}

/** Actor IDs used by enrichment (Apify Store). */
export class ApifyActorCatalog {
  static readonly ids = {
    skipTrace: "twoapi/skip-trace",
    courtRecords: "automation-lab/court-records-scraper",
    recapDockets: "pink_comic/recap-federal-court-dockets",
    bankruptcy: "pink_comic/bankruptcy-filing-search",
    businessEntity: "pink_comic/us-business-entity-search",
    uccNy: "fortuitous_pirate/ucc-lien-search-ny",
    propertyTax: "great_pistachio/property-tax-scraper",
    linkedIn: "alwaysprimedev/linkedin-profile-scraper",
    facebookPeople: "patient_discovery/facebook-search-people",
    googleSearch: "apify/google-search-scraper",
    instagramSearchUsers: "nkactors/instagram-search-users-api-no-cookies-fast-reliable",
    linkedinPeopleSearch: "unlimitedleadtestinbox/linkedin-people-search-scraper-no-cookie",
    twitterSearchUsers: "forge-api/x-scraper",
  } as const
}

/** Same keys as `ApifyActorCatalog.ids` (legacy export for call sites). */
export const APIFY_ACTORS = ApifyActorCatalog.ids

/**
 * Thin client around `apify-client`: run actor, fetch dataset, return dashboard URL.
 * Without `APIFY_API_TOKEN`, returns empty items and a search URL (dev mode).
 */
export class ApifyActorClient {
  private readonly dashboardRunBase = "https://console.apify.com/actors/runs"

  private getClient(): ApifyClient | null {
    const token = process.env.APIFY_API_TOKEN
    if (!token) return null
    return new ApifyClient({ token })
  }

  async run<T = Record<string, unknown>>(
    actorId: string,
    input: Record<string, unknown>,
    options: { waitSecs?: number } = {},
  ): Promise<ActorRunResult<T>> {
    const waitSecs = options.waitSecs ?? 90
    const client = this.getClient()

    if (!client) {
      debtorEnrichmentLog.warn("apify: APIFY_API_TOKEN missing — skipping actor run (empty dataset)", {
        actorId,
        input: sanitizeActorInputForLog(input),
      })
      return {
        items: [],
        runUrl: `https://console.apify.com/actors?search=${encodeURIComponent(actorId)}`,
        actorId,
        runId: "dev-no-token",
      }
    }

    debtorEnrichmentLog.info("apify: actor run starting", {
      actorId,
      waitSecs,
      input: sanitizeActorInputForLog(input),
    })

    try {
      const run = await client.actor(actorId).call(input, { waitSecs })
      const runId = run.id
      const runUrl = `${this.dashboardRunBase}/${runId}`
      const datasetId = run.defaultDatasetId
      if (!datasetId) {
        debtorEnrichmentLog.warn("apify: actor finished with no defaultDatasetId", {
          actorId,
          runId,
          runUrl,
        })
        return { items: [], runUrl, actorId, runId }
      }
      const { items } = await client.dataset(datasetId).listItems()
      const list = (items ?? []) as T[]
      debtorEnrichmentLog.info("apify: actor run ok", {
        actorId,
        runId,
        runUrl,
        datasetItemCount: list.length,
      })
      return {
        items: list,
        runUrl,
        actorId,
        runId,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      debtorEnrichmentLog.error("apify: actor run failed", {
        actorId,
        input: sanitizeActorInputForLog(input),
        error: message,
      })
      return {
        items: [],
        runUrl: `https://console.apify.com/actors?search=${encodeURIComponent(actorId)}`,
        actorId,
        runId: "error",
      }
    }
  }
}

export const apifyActorClient = new ApifyActorClient()

export async function runActor<T = Record<string, unknown>>(
  actorId: string,
  input: Record<string, unknown>,
  options?: { waitSecs?: number },
): Promise<ActorRunResult<T>> {
  return apifyActorClient.run<T>(actorId, input, options)
}

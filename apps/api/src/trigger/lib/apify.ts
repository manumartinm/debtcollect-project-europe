import { ApifyClient } from "apify-client"

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
    truePeopleSearch: "scrapyspider/truepeoplesearch-contact-finder",
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
      return {
        items: [],
        runUrl: `https://console.apify.com/actors?search=${encodeURIComponent(actorId)}`,
        actorId,
        runId: "dev-no-token",
      }
    }

    try {
      const run = await client.actor(actorId).call(input, { waitSecs })
      const runId = run.id
      const runUrl = `${this.dashboardRunBase}/${runId}`
      const datasetId = run.defaultDatasetId
      if (!datasetId) {
        return { items: [], runUrl, actorId, runId }
      }
      const { items } = await client.dataset(datasetId).listItems()
      return {
        items: (items ?? []) as T[],
        runUrl,
        actorId,
        runId,
      }
    } catch (err) {
      console.error(`[apify] actor ${actorId} failed`, err)
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

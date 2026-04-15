import { ApifyClient } from "apify-client"

export type ActorRunResult<T = Record<string, unknown>> = {
  items: T[]
  runUrl: string
  actorId: string
  runId: string
}

function getClient(): ApifyClient | null {
  const token = process.env.APIFY_API_TOKEN
  if (!token) return null
  return new ApifyClient({ token })
}

const DASHBOARD_BASE = "https://console.apify.com/actors/runs"

/**
 * Run an Apify actor and return dataset items + dashboard URL.
 * Without APIFY_API_TOKEN returns empty items and a placeholder URL (dev mode).
 */
export async function runActor<T = Record<string, unknown>>(
  actorId: string,
  input: Record<string, unknown>,
  options: { waitSecs?: number } = {}
): Promise<ActorRunResult<T>> {
  const waitSecs = options.waitSecs ?? 90
  const client = getClient()

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
    const runUrl = `${DASHBOARD_BASE}/${runId}`
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

/** Actor IDs used by research agents (all via Apify Store). */
export const APIFY_ACTORS = {
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
} as const

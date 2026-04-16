import { debtorEnrichmentLog } from "./task-logger.js"

const CL_BASE = "https://www.courtlistener.com/api/rest/v4"

const DOCKET_FIELDS = [
  "id",
  "case_name",
  "docket_number",
  "court",
  "date_filed",
  "date_terminated",
  "nature_of_suit",
  "cause",
  "jury_demand",
  "jurisdiction_type",
  "parties",
  "docket_entries",
] as const

type CourtListenerDocket = {
  id: number
  case_name?: string
  docket_number?: string
  court?: string
  date_filed?: string
  date_terminated?: string
  nature_of_suit?: string
  cause?: string
  jury_demand?: string
  jurisdiction_type?: string
  parties?: unknown[]
  docket_entries?: unknown[]
}

function getToken(): string | null {
  return process.env.COURTLISTENER_API_TOKEN?.trim() || null
}

export async function fetchDocketDetail(
  docketId: number,
): Promise<CourtListenerDocket | null> {
  const token = getToken()
  if (!token) return null

  const fields = DOCKET_FIELDS.join(",")
  const url = `${CL_BASE}/dockets/${docketId}/?fields=${fields}`

  const res = await fetch(url, {
    headers: { Authorization: `Token ${token}` },
  })

  if (!res.ok) {
    debtorEnrichmentLog.warn("CourtListener docket fetch failed", {
      docketId,
      status: res.status,
    })
    return null
  }

  return (await res.json()) as CourtListenerDocket
}

/**
 * Takes raw recap-docket actor items and enriches each one that has a
 * docketId (or `id`) by calling CourtListener v4 with our token.
 * Items without an id pass through unchanged.
 */
export async function enrichRecapDocketItems(
  items: Record<string, unknown>[],
): Promise<Record<string, unknown>[]> {
  const token = getToken()
  if (!token) {
    debtorEnrichmentLog.warn(
      "CourtListener: COURTLISTENER_API_TOKEN missing — skipping docket enrichment",
    )
    return items
  }
  if (items.length === 0) return items

  const enriched: Record<string, unknown>[] = []
  let ok = 0
  let fail = 0

  for (const item of items) {
    const rawId = item.docketId ?? item.id
    const docketId = typeof rawId === "number" ? rawId : Number(rawId)

    if (!Number.isFinite(docketId) || docketId <= 0) {
      enriched.push(item)
      continue
    }

    const detail = await fetchDocketDetail(docketId)
    if (detail) {
      ok++
      enriched.push({
        ...item,
        caseName: detail.case_name ?? item.caseName,
        caseNumber: detail.docket_number ?? item.caseNumber ?? item.docketNumber,
        court: detail.court ?? item.court,
        dateFiled: detail.date_filed ?? item.dateFiled,
        dateTerminated: detail.date_terminated ?? item.dateTerminated,
        natureOfSuit: detail.nature_of_suit ?? item.natureOfSuit,
        cause: detail.cause ?? item.cause,
        juryDemand: detail.jury_demand ?? item.juryDemand,
        jurisdictionType: detail.jurisdiction_type ?? item.jurisdictionType,
        parties: detail.parties ?? item.parties,
        docketEntries: detail.docket_entries ?? item.docketEntries,
      })
    } else {
      fail++
      enriched.push(item)
    }
  }

  debtorEnrichmentLog.info("CourtListener docket enrichment done", {
    total: items.length,
    enriched: ok,
    failed: fail,
  })

  return enriched
}

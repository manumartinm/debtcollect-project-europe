export type LeverageLevel = "none" | "low" | "medium" | "high"
export type EnrichmentStatus = "pending" | "running" | "complete" | "failed"
export type CaseStatus =
  | "new"
  | "reviewing"
  | "called"
  | "negotiating"
  | "payment_plan"
  | "settled"
  | "unresponsive"
  | "legal"

export type AiSource = { name: string; url: string; type: string }

export type AiTraceStep = {
  id: string
  stepNumber: number
  agentName: string
  action: string
  reasoning: string
  sources: AiSource[]
  finding: string | null
  confidence: "high" | "medium" | "low" | "none"
  timestamp: string
  durationMs: number
}

export type StatusEvent = {
  id: string
  timestamp: string
  status: CaseStatus
  note?: string
  author: string
}

export type EnrichedFields = {
  phone?: string
  address?: string
  employer?: string
  assets?: string
  socialMediaHints?: string
  incomeBracket?: string
}

export type Debtor = {
  caseId: string
  country: string
  debtAmount: number
  callOutcome: string
  legalOutcome: string
  name: string
  leverageScore: LeverageLevel
  enrichmentStatus: EnrichmentStatus
  enrichmentConfidence?: number
  caseStatus: CaseStatus
  traces: AiTraceStep[]
  /** Full template used for live simulation; merged into traces when run completes */
  traceTemplate: AiTraceStep[]
  enriched?: EnrichedFields
  statusHistory: StatusEvent[]
}

const COUNTRIES = ["ES", "PT", "IT", "GR"] as const

const FIRST = [
  "Ana",
  "Carlos",
  "Maria",
  "João",
  "Giulia",
  "Nikos",
  "Elena",
  "Pedro",
  "Sofia",
  "Marco",
]
const LAST = [
  "Silva",
  "García",
  "Santos",
  "Rossi",
  "Papadopoulos",
  "Costa",
  "Fernández",
  "Lopes",
  "Conti",
  "Vega",
]

export function buildDefaultTraceTemplate(caseId: string): AiTraceStep[] {
  const base = new Date().toISOString()
  return [
    {
      id: `${caseId}-s1`,
      stepNumber: 1,
      agentName: "Search Agent",
      action: "queried",
      reasoning:
        "Starting with the broadest public records available for this name and country to establish a baseline address or identity match.",
      sources: [
        { name: "BOE", url: "https://www.boe.es", type: "registry" },
        { name: "BORME", url: "https://www.borme.gob.es", type: "registry" },
      ],
      finding: "Possible address match in Madrid metropolitan area.",
      confidence: "medium",
      timestamp: base,
      durationMs: 2300,
    },
    {
      id: `${caseId}-s2`,
      stepNumber: 2,
      agentName: "Registry Agent",
      action: "cross-referenced",
      reasoning:
        "Previous step surfaced an address; narrowing search to commercial registries for corporate affiliations.",
      sources: [
        {
          name: "Registro Mercantil",
          url: "https://www.rmc.es",
          type: "registry",
        },
      ],
      finding: "Listed as administrator of a small SL with active filing.",
      confidence: "high",
      timestamp: base,
      durationMs: 4100,
    },
    {
      id: `${caseId}-s3`,
      stepNumber: 3,
      agentName: "Social Media Agent",
      action: "scraped",
      reasoning:
        "Employment signals are ambiguous in public records; checking open social profiles for location and lifestyle cues.",
      sources: [
        { name: "LinkedIn", url: "https://www.linkedin.com", type: "social" },
        {
          name: "Instagram",
          url: "https://www.instagram.com",
          type: "social",
        },
      ],
      finding: "Recent posts tagged from a coastal municipality.",
      confidence: "low",
      timestamp: base,
      durationMs: 1800,
    },
    {
      id: `${caseId}-s4`,
      stepNumber: 4,
      agentName: "Asset Agent",
      action: "queried",
      reasoning:
        "Cross-checking vehicle and property registers where jurisdiction allows public lookup.",
      sources: [
        { name: "DGT", url: "https://www.dgt.es", type: "vehicle" },
      ],
      finding: null,
      confidence: "none",
      timestamp: base,
      durationMs: 3200,
    },
    {
      id: `${caseId}-s5`,
      stepNumber: 5,
      agentName: "Synthesis Agent",
      action: "concluded",
      reasoning:
        "Aggregating signals with source quality weighting to produce an actionable briefing for the collector.",
      sources: [],
      finding:
        "Sufficient public signals to justify a targeted outreach angle; gaps documented honestly.",
      confidence: "medium",
      timestamp: base,
      durationMs: 900,
    },
  ]
}

export function traceTemplateWithNoResults(caseId: string): AiTraceStep[] {
  const t = buildDefaultTraceTemplate(caseId)
  return t.map((s, i) =>
    i < 4
      ? {
          ...s,
          finding: null,
          confidence: "none" as const,
          reasoning:
            "No reliable public match at this step; documenting absence rather than inferring.",
        }
      : {
          ...s,
          finding: "No actionable public information discovered across checked sources.",
          confidence: "none" as const,
        }
  )
}

export function computeLeverageFromTraces(
  traces: AiTraceStep[]
): LeverageLevel {
  const findings = traces.filter((t) => t.finding && t.confidence !== "none")
  const high = findings.filter((t) => t.confidence === "high").length
  const med = findings.filter((t) => t.confidence === "medium").length
  if (high >= 2 || (high >= 1 && med >= 2)) return "high"
  if (high >= 1 || med >= 2) return "medium"
  if (findings.length >= 1) return "low"
  return "none"
}

export function buildEnrichedFromTraces(
  traces: AiTraceStep[]
): EnrichedFields {
  const t0 = traces[0]
  const t1 = traces[1]
  const t2 = traces[2]
  const t3 = traces[3]
  return {
    phone: t0?.finding ? "+34 600 000 000" : undefined,
    address: t0?.finding ?? "Unknown",
    employer: t1?.finding
      ? t1.finding.includes("SL")
        ? "Example Services SL"
        : t1.finding
      : "Not found",
    assets: t3?.finding ?? "None in public sweep",
    socialMediaHints: t2?.finding ?? "Low signal",
    incomeBracket: "Unknown",
  }
}

/** Which trace step produced each enriched field (for UI: show agent reasoning per field). */
export const ENRICHED_FIELD_TRACE_STEP: Record<keyof EnrichedFields, number> = {
  phone: 0,
  address: 0,
  employer: 1,
  socialMediaHints: 2,
  assets: 3,
  incomeBracket: 4,
}

export function traceForEnrichedField(
  traces: AiTraceStep[],
  field: keyof EnrichedFields
): AiTraceStep | undefined {
  const idx = ENRICHED_FIELD_TRACE_STEP[field]
  return traces[idx]
}

export function leverageExplanation(score: LeverageLevel): string {
  switch (score) {
    case "high":
      return "High — multiple strong public signals (employment, assets, or social) align for negotiation leverage."
    case "medium":
      return "Medium — some corroborated public signals; worth a prepared call with documented angles."
    case "low":
      return "Low — limited or weak public signals; proceed with caution and verify verbally."
    default:
      return "None — no actionable public information discovered; honesty about gaps is the default."
  }
}

function randomDebt(i: number): number {
  const x = Math.sin(i * 9999) * 10000
  return Math.floor((x - Math.floor(x)) * 199500) + 500
}

function makeDebtor(i: number): Debtor {
  const caseId = `VX-${String(i + 1).padStart(4, "0")}`
  const country = COUNTRIES[i % COUNTRIES.length]
  const name = `${FIRST[i % FIRST.length]} ${LAST[(i + 3) % LAST.length]}`
  const debtAmount = randomDebt(i + 1)

  const callFailed = i % 10 !== 7
  const callOutcome = callFailed
    ? ["no_answer", "wrong_number", "voicemail", "busy", "disconnected"][
        i % 5
      ]
    : "answered"

  const legalEmpty = i % 4 !== 0
  const legalOutcome = legalEmpty
    ? "no_assets_listed"
    : ["vehicle_registered", "property_found"][i % 2]

  const template = buildDefaultTraceTemplate(caseId)
  const emptyTemplate = traceTemplateWithNoResults(caseId)

  let enrichmentStatus: EnrichmentStatus
  let traces: AiTraceStep[]
  let traceTemplate: AiTraceStep[]
  let enriched: EnrichedFields | undefined
  let leverageScore: LeverageLevel

  if (i % 7 === 0) {
    enrichmentStatus = "pending"
    traces = []
    traceTemplate = template
    enriched = undefined
    leverageScore = "none"
  } else if (i % 11 === 0) {
    enrichmentStatus = "complete"
    traces = emptyTemplate
    traceTemplate = emptyTemplate
    enriched = {
      phone: undefined,
      address: undefined,
      employer: undefined,
      assets: undefined,
      socialMediaHints: undefined,
      incomeBracket: undefined,
    }
    leverageScore = "none"
  } else {
    enrichmentStatus = "complete"
    traces = template
    traceTemplate = template
    enriched = {
      phone: `+${34 + (i % 4)} ${600 + (i % 900)} ${100 + (i % 900)} ${100 + (i % 900)}`,
      address: `Calle / Rua Example ${(i % 120) + 1}, ${country === "ES" ? "Madrid" : country === "PT" ? "Porto" : country === "IT" ? "Milano" : "Athens"}`,
      employer: traces[1]?.finding
        ? "Example Services SL"
        : "Unknown",
      assets: legalOutcome !== "no_assets_listed" ? "Possible asset hit" : "None in public sweep",
      socialMediaHints: traces[2]?.finding ?? "Low signal",
      incomeBracket: "Unknown",
    }
    leverageScore = computeLeverageFromTraces(traces)
  }

  const statusHistory: StatusEvent[] = [
    {
      id: `${caseId}-ev1`,
      timestamp: new Date(Date.now() - 86400000 * (3 + (i % 5))).toISOString(),
      status: "new",
      note: "Imported from portfolio CSV.",
      author: "System",
    },
  ]
  if (i % 3 === 0) {
    statusHistory.push({
      id: `${caseId}-ev2`,
      timestamp: new Date(
        Date.now() - 86400000 * (1 + (i % 3))
      ).toISOString(),
      status: "reviewing",
      author: "Alex (collector)",
    })
  }

  const caseStatuses: CaseStatus[] = [
    "new",
    "reviewing",
    "called",
    "negotiating",
    "payment_plan",
    "settled",
    "unresponsive",
    "legal",
  ]
  const caseStatus = caseStatuses[i % caseStatuses.length]

  return {
    caseId,
    country,
    debtAmount,
    callOutcome,
    legalOutcome,
    name,
    leverageScore,
    enrichmentStatus,
    enrichmentConfidence:
      enrichmentStatus === "complete" ? 0.55 + (i % 40) / 100 : undefined,
    caseStatus,
    traces,
    traceTemplate,
    enriched,
    statusHistory,
  }
}

export const INITIAL_DEBTORS: Debtor[] = Array.from({ length: 50 }, (_, i) =>
  makeDebtor(i)
)

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  new: "New",
  reviewing: "Reviewing",
  called: "Called",
  negotiating: "Negotiating",
  payment_plan: "Payment plan",
  settled: "Settled",
  unresponsive: "Unresponsive",
  legal: "Legal",
}

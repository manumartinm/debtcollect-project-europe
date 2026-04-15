import { z } from "zod"

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

/** Keys we enrich across agents (subset can be filled per run). */
export const enrichedFieldKeySchema = z.enum([
  "phones",
  "emails",
  "currentAddress",
  "addressHistory",
  "relatives",
  "dateOfBirth",
  "employer",
  "jobTitle",
  "incomeBracket",
  "linkedinUrl",
  "realEstateHoldings",
  "estimatedPropertyValue",
  "businessAffiliations",
  "uccFilings",
  "litigationHistory",
  "judgments",
  "bankruptcyStatus",
  "bankruptcyDetail",
  "socialMediaProfiles",
  "socialMediaHints",
  "stateOfResidence",
  "statuteOfLimitationsYears",
  "solExpirationDate",
  "isTimeBarred",
  "fdcpaFlags",
])

export type EnrichedFieldKey = z.infer<typeof enrichedFieldKeySchema>

export type FieldProvenance = {
  fieldKey: EnrichedFieldKey
  value: unknown
  agentName: string
  traceStepId: string
  stepNumber: number
  apifyActorId: string
  apifyRunUrl: string
  rawDataSnapshot: unknown
  aiModel: string
  aiPromptSummary: string
  aiReasoning: string
  confidence: "high" | "medium" | "low" | "none"
  sources: AiSource[]
  alternativeSources: Array<{
    agentName: string
    value: unknown
    confidence: "high" | "medium" | "low" | "none"
    reason: string
  }>
  timestamp: string
  durationMs: number
}

export type AgentResult = {
  trace: AiTraceStep
  extractedFields: Partial<Record<EnrichedFieldKey, unknown>>
  provenance: FieldProvenance[]
}

export type DebtorAgentPayload = {
  caseId: string
  name: string
  state: string
  city?: string
  /** Global 1-based step index set by orchestrator for trace ordering */
  stepIndex?: number
  overrides?: Record<string, unknown>
}

export type ResearchOrchestratorPayload = {
  caseId: string
  debtor: {
    name: string
    state: string
    city?: string
    debtAmount?: number
    debtType?: "credit_card" | "personal_loan" | "medical" | "other"
    dateOfDelinquency?: string
  }
}

export type SynthesisInput = {
  caseId: string
  debtor: ResearchOrchestratorPayload["debtor"]
  agentResults: AgentResult[]
  planReasoning?: string
}

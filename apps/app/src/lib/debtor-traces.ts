import type { ApiDebtor, ApiTraceStep } from "@/lib/api"

/** All trace steps from enriched fields, ordered for timeline display. */
export function flattenTraceSteps(debtor: ApiDebtor): ApiTraceStep[] {
  const steps = debtor.enrichedFields.flatMap((f) => f.traceSteps ?? [])
  return [...steps].sort((a, b) => {
    if (a.stepNumber !== b.stepNumber) return a.stepNumber - b.stepNumber
    return a.agentName.localeCompare(b.agentName)
  })
}

export function enrichedFieldValue(
  debtor: ApiDebtor,
  fieldName: string
): string | null | undefined {
  return debtor.enrichedFields.find((f) => f.fieldName === fieldName)?.value ?? undefined
}

export function parseDebtAmountString(s: string): number {
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

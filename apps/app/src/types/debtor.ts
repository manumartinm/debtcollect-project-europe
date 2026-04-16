export type LeverageLevel = "none" | "low" | "medium" | "high"
export type EnrichmentStatus =
  | "not_started"
  | "pending"
  | "running"
  | "complete"
  | "failed"
export type CaseStatus =
  | "new"
  | "reviewing"
  | "called"
  | "negotiating"
  | "payment_plan"
  | "settled"
  | "unresponsive"
  | "legal"

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

/** Display label for selects and UI (handles API casing and unknown values). */
export function caseStatusLabel(raw: string): string {
  const k = raw.trim().toLowerCase() as CaseStatus
  if (k in CASE_STATUS_LABELS) return CASE_STATUS_LABELS[k]
  return raw
}

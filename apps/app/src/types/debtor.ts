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

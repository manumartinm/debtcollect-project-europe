import type { EnrichmentStatus } from "@/types/debtor"

export const ENRICHMENT_STATUS_LABEL: Record<EnrichmentStatus, string> = {
  not_started: "Not started",
  pending: "Pending",
  running: "Running",
  complete: "Complete",
  failed: "Failed",
}

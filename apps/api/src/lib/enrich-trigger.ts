import type {
  DebtorEnrichmentPayload,
  ResearchOrchestratorPayload,
} from '../trigger/types.js'

/**
 * Fire-and-forget research pipeline for a debtor (Trigger.dev).
 * Requires TRIGGER_SECRET_KEY / Trigger project env in production.
 */
export async function triggerResearchOrchestrator(
  payload: ResearchOrchestratorPayload,
): Promise<{ id: string }> {
  const { tasks } = await import('@trigger.dev/sdk/v3')
  const handle = await tasks.trigger('research-orchestrator', payload)
  return { id: handle.id }
}

export async function triggerDebtorEnrichment(
  payload: DebtorEnrichmentPayload,
): Promise<{ id: string }> {
  const { tasks } = await import('@trigger.dev/sdk/v3')
  const handle = await tasks.trigger('debtor-enrichment', payload)
  return { id: handle.id }
}

import type { DebtorEnrichmentPayload } from '../trigger/types.js'

/**
 * Fire-and-forget debtor enrichment (Trigger.dev).
 * Requires TRIGGER_SECRET_KEY / Trigger project env in production.
 */
export async function triggerDebtorEnrichment(
  payload: DebtorEnrichmentPayload,
): Promise<{ id: string }> {
  const { tasks } = await import('@trigger.dev/sdk/v3')
  const handle = await tasks.trigger('debtor-enrichment', payload)
  return { id: handle.id }
}

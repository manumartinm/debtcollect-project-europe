const MAX_LEN = 4000

/** Normalizes thrown values into a bounded string for `debtors.enrichment_error`. */
export function formatEnrichmentFailure(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  const t = msg.trim() || 'Unknown error'
  return t.length > MAX_LEN ? `${t.slice(0, MAX_LEN - 3)}...` : t
}

import { useQueryClient } from "@tanstack/react-query"
import { useRealtimeRun } from "@trigger.dev/react-hooks"
import * as React from "react"

import { queryKeys } from "@/lib/query-keys"

type RunMetadata = { enrichedFieldsReady?: unknown }

/**
 * Subscribes to a Trigger.dev enrichment run ([Realtime overview](https://trigger.dev/docs/realtime/overview)):
 * refetches debtor + enriched fields when run metadata updates (per-field DB writes) and when the run finishes.
 */
export function useDebtorEnrichmentRealtime(opts: {
  debtorId: string
  runId: string | null
  publicAccessToken: string | null
  /** False when not using realtime (e.g. no token after refresh — HTTP polling applies). */
  enabled: boolean
  onRunSettled?: () => void
}) {
  const qc = useQueryClient()
  const { debtorId, runId, publicAccessToken, enabled, onRunSettled } = opts
  const lastMetaKey = React.useRef<string>("")

  React.useEffect(() => {
    lastMetaKey.current = ""
  }, [runId])

  const { run, error } = useRealtimeRun(enabled && runId ? runId : undefined, {
    accessToken: publicAccessToken ?? undefined,
    enabled: enabled && !!runId && !!publicAccessToken,
    skipColumns: ["payload", "output"],
    onComplete: () => {
      qc.invalidateQueries({ queryKey: queryKeys.debtors.detail(debtorId) })
      qc.invalidateQueries({ queryKey: queryKeys.debtors.enrichedFields(debtorId) })
      qc.invalidateQueries({ queryKey: queryKeys.debtors.all })
      onRunSettled?.()
    },
  })

  React.useEffect(() => {
    const m = run?.metadata as RunMetadata | undefined
    const ready = m?.enrichedFieldsReady
    if (ready == null) return
    const key = JSON.stringify(ready)
    if (key === lastMetaKey.current) return
    lastMetaKey.current = key
    qc.invalidateQueries({ queryKey: queryKeys.debtors.enrichedFields(debtorId) })
    qc.invalidateQueries({ queryKey: queryKeys.debtors.detail(debtorId) })
  }, [run?.metadata, debtorId, qc])

  return { run, error }
}

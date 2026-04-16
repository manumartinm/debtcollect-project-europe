import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import {
  debtorsApi,
  type ApiDebtor,
  type ApiStatusEvent,
  type ApiEnrichedField,
} from "@/lib/api"

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useDebtorsList(orgId: string) {
  return useQuery({
    queryKey: queryKeys.debtors.list(orgId),
    queryFn: () => debtorsApi.list(orgId),
    enabled: !!orgId,
  })
}

/**
 * Single-debtor detail (includes `enrichedFields` nested from API).
 * - `staleTime: 0` so list navigation / post-enrichment invalidations surface fresh DB data (default app staleTime is 30s).
 * - Polls every 4s while `enrichmentStatus === "running"` so Trigger.dev completion updates the UI without a manual refresh.
 */
export function useDebtor(
  id: string,
  options?: { skipRunningPoll?: boolean }
) {
  const skipPoll = options?.skipRunningPoll ?? false
  return useQuery({
    queryKey: queryKeys.debtors.detail(id),
    queryFn: () => debtorsApi.get(id),
    enabled: !!id,
    staleTime: 0,
    refetchInterval: (query) => {
      if (skipPoll) return false
      const d = query.state.data as ApiDebtor | undefined
      return d?.enrichmentStatus === "running" ? 4000 : false
    },
  })
}

export function useStatusEvents(debtorId: string) {
  return useQuery({
    queryKey: queryKeys.debtors.statusEvents(debtorId),
    queryFn: () => debtorsApi.getStatusEvents(debtorId),
    enabled: !!debtorId,
  })
}

export function useEnrichedFields(
  debtorId: string,
  options?: { refetchInterval?: number | false; skipRunningPoll?: boolean }
) {
  const skipPoll = options?.skipRunningPoll ?? false
  const qc = useQueryClient()
  return useQuery({
    queryKey: queryKeys.debtors.enrichedFields(debtorId),
    queryFn: () => debtorsApi.getEnrichedFields(debtorId),
    enabled: !!debtorId,
    staleTime: 0,
    refetchInterval: () => {
      if (skipPoll) return false
      if (options?.refetchInterval !== undefined) return options.refetchInterval
      const detail = qc.getQueryData<ApiDebtor>(
        queryKeys.debtors.detail(debtorId)
      )
      return detail?.enrichmentStatus === "running" ? 4000 : false
    },
  })
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateDebtor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: debtorsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.debtors.all })
    },
  })
}

export function useBulkCreateDebtors() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: debtorsApi.bulkCreate,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.debtors.all })
    },
  })
}

export function useUpdateDebtor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof debtorsApi.update>[1] }) =>
      debtorsApi.update(id, patch),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.debtors.detail(id) })
      qc.invalidateQueries({ queryKey: queryKeys.debtors.all })
    },
  })
}

export function useDeleteDebtor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: debtorsApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.debtors.all })
    },
  })
}

export function useSetDebtorStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string
      status: string
      note?: string
      author: string
    }) => debtorsApi.setStatus(id, data),
    onSuccess: (_data: ApiStatusEvent, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.debtors.detail(id) })
      qc.invalidateQueries({ queryKey: queryKeys.debtors.statusEvents(id) })
      qc.invalidateQueries({ queryKey: queryKeys.debtors.all })
    },
  })
}

export function useAiCallDebtor() {
  return useMutation({
    mutationFn: (id: string) => debtorsApi.aiCall(id),
  })
}

export function useEnrichDebtor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => debtorsApi.enrich(id),
    onSuccess: (data, id) => {
      if (data.debtor) {
        qc.setQueryData(queryKeys.debtors.detail(id), data.debtor)
      }
      qc.invalidateQueries({ queryKey: queryKeys.debtors.detail(id) })
      qc.invalidateQueries({ queryKey: queryKeys.debtors.enrichedFields(id) })
      qc.invalidateQueries({ queryKey: queryKeys.debtors.all })
    },
  })
}

export function useEnrichDebtorsBatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (debtorIds: string[]) => debtorsApi.enrichBatch(debtorIds),
    onSuccess: (_data, debtorIds) => {
      for (const debtorId of debtorIds) {
        qc.invalidateQueries({ queryKey: queryKeys.debtors.detail(debtorId) })
        qc.invalidateQueries({
          queryKey: queryKeys.debtors.enrichedFields(debtorId),
        })
      }
      qc.invalidateQueries({ queryKey: queryKeys.debtors.all })
    },
  })
}

export function useUpsertEnrichedField() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      debtorId,
      ...data
    }: {
      debtorId: string
      fieldName: string
      value: string | null
      traceSteps?: Parameters<typeof debtorsApi.upsertEnrichedField>[1]["traceSteps"]
    }) => debtorsApi.upsertEnrichedField(debtorId, data),
    onSuccess: (_data: ApiEnrichedField, { debtorId }) => {
      qc.invalidateQueries({
        queryKey: queryKeys.debtors.enrichedFields(debtorId),
      })
      qc.invalidateQueries({ queryKey: queryKeys.debtors.detail(debtorId) })
    },
  })
}

// Re-export types for convenience
export type { ApiDebtor, ApiStatusEvent, ApiEnrichedField }

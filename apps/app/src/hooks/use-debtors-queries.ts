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

export function useDebtor(id: string) {
  return useQuery({
    queryKey: queryKeys.debtors.detail(id),
    queryFn: () => debtorsApi.get(id),
    enabled: !!id,
  })
}

export function useStatusEvents(debtorId: string) {
  return useQuery({
    queryKey: queryKeys.debtors.statusEvents(debtorId),
    queryFn: () => debtorsApi.getStatusEvents(debtorId),
    enabled: !!debtorId,
  })
}

export function useEnrichedFields(debtorId: string) {
  return useQuery({
    queryKey: queryKeys.debtors.enrichedFields(debtorId),
    queryFn: () => debtorsApi.getEnrichedFields(debtorId),
    enabled: !!debtorId,
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

export function useEnrichDebtor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => debtorsApi.enrich(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: queryKeys.debtors.detail(id) })
      qc.invalidateQueries({ queryKey: queryKeys.debtors.all })
    },
  })
}

export function useEnrichDebtorsBatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (debtorIds: string[]) => debtorsApi.enrichBatch(debtorIds),
    onSuccess: () => {
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

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { transcriptsApi, type ApiCallTranscript } from "@/lib/api"

export function useTranscriptsList(orgId: string) {
  return useQuery({
    queryKey: queryKeys.transcripts.list(orgId),
    queryFn: () => transcriptsApi.list(orgId),
    enabled: !!orgId,
  })
}

export function useTranscript(id: string) {
  return useQuery({
    queryKey: queryKeys.transcripts.detail(id),
    queryFn: () => transcriptsApi.get(id),
    enabled: !!id,
    staleTime: Infinity,
  })
}

export function useTranscriptsByDebtor(debtorId: string) {
  return useQuery({
    queryKey: queryKeys.transcripts.byDebtor(debtorId),
    queryFn: () => transcriptsApi.getByDebtor(debtorId),
    enabled: !!debtorId,
  })
}

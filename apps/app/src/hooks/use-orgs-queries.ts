import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { orgsApi, type ApiOrganization, type ApiMember } from "@/lib/api"

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useOrgsList() {
  return useQuery({
    queryKey: queryKeys.orgs.mine(),
    queryFn: orgsApi.mine,
  })
}

export function useOrg(id: string) {
  return useQuery({
    queryKey: queryKeys.orgs.detail(id),
    queryFn: () => orgsApi.get(id),
    enabled: !!id,
  })
}

export function useOrgMembers(orgId: string) {
  return useQuery({
    queryKey: queryKeys.orgs.members(orgId),
    queryFn: () => orgsApi.members.list(orgId),
    enabled: !!orgId,
  })
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateOrg() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: orgsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.orgs.all })
      qc.invalidateQueries({ queryKey: queryKeys.orgs.mine() })
    },
  })
}

export function useUpdateOrg() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string
      patch: Parameters<typeof orgsApi.update>[1]
    }) => orgsApi.update(id, patch),
    onSuccess: (_data: ApiOrganization, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.orgs.detail(id) })
      qc.invalidateQueries({ queryKey: queryKeys.orgs.all })
      qc.invalidateQueries({ queryKey: queryKeys.orgs.mine() })
    },
  })
}

export function useAddMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      orgId,
      ...data
    }: {
      orgId: string
      userId: string
      role?: string
    }) => orgsApi.members.add(orgId, data),
    onSuccess: (_data: ApiMember, { orgId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.orgs.members(orgId) })
      qc.invalidateQueries({ queryKey: queryKeys.orgs.mine() })
    },
  })
}

export function useUpdateMemberRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      orgId,
      memberId,
      role,
    }: {
      orgId: string
      memberId: string
      role: string
    }) => orgsApi.members.updateRole(orgId, memberId, role),
    onSuccess: (_data: ApiMember, { orgId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.orgs.members(orgId) })
    },
  })
}

export function useRemoveMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      orgId,
      memberId,
    }: {
      orgId: string
      memberId: string
    }) => orgsApi.members.remove(orgId, memberId),
    onSuccess: (_, { orgId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.orgs.members(orgId) })
    },
  })
}

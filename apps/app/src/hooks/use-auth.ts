import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { authClient } from "@/lib/auth-client"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type User = {
  id: string
  name: string
  email: string
  image?: string | null
}

type SessionData = {
  user: User
  session: {
    token: string
    userId: string
    expiresAt: string
  }
}

// ---------------------------------------------------------------------------
// Session query
// ---------------------------------------------------------------------------

export function useAuthSession() {
  return useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: async (): Promise<SessionData | null> => {
      const { data } = await authClient.getSession()
      return (data as SessionData) ?? null
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useSignIn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      email,
      password,
    }: {
      email: string
      password: string
    }) => {
      const { error } = await authClient.signIn.email({ email, password })
      if (error) throw new Error(error.message ?? "Sign-in failed")
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.auth.session })
    },
  })
}

export function useSignUp() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      email,
      password,
      name,
    }: {
      email: string
      password: string
      name: string
    }) => {
      const { error } = await authClient.signUp.email({
        email,
        password,
        name,
      })
      if (error) throw new Error(error.message ?? "Sign-up failed")
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.auth.session })
    },
  })
}

export function useSignOut() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => authClient.signOut(),
    onSuccess: () => {
      qc.setQueryData(queryKeys.auth.session, null)
      qc.invalidateQueries()
    },
  })
}

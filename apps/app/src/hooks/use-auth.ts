import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { clearClientStorageAfterSignOut } from "@/lib/client-storage"
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

/** True when the client has a usable session (fixes stale/partial cache blocking /signup). */
export function hasValidSession(
  session: SessionData | null | undefined,
): session is SessionData {
  return typeof session?.user?.id === "string" && session.user.id.length > 0
}

/**
 * better-auth / better-fetch may return `{ data: payload }` or the payload `{ user, session }` directly.
 * Ensures `user.id` is set (fallback: `session.userId`).
 */
function normalizeSessionResult(result: unknown): SessionData | null {
  if (result == null || typeof result !== "object") return null
  const r = result as Record<string, unknown>

  let inner: unknown
  if ("data" in r && r.data != null) inner = r.data
  else if ("user" in r) inner = r
  else return null

  if (inner == null || typeof inner !== "object") return null
  const innerObj = inner as Record<string, unknown>
  const userRaw = innerObj.user
  if (!userRaw || typeof userRaw !== "object") return null

  const sessRaw = innerObj.session
  const u = userRaw as Record<string, unknown>
  const s =
    sessRaw && typeof sessRaw === "object"
      ? (sessRaw as Record<string, unknown>)
      : {}

  const userId =
    (typeof u.id === "string" && u.id) ||
    (typeof s.userId === "string" && s.userId) ||
    null

  if (!userId) return null

  const user = { ...u, id: userId } as User

  return {
    user,
    session: s as SessionData["session"],
  }
}

// ---------------------------------------------------------------------------
// Session query
// ---------------------------------------------------------------------------

export function useAuthSession() {
  return useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: async (): Promise<SessionData | null> => {
      try {
        const result = await authClient.getSession()
        return normalizeSessionResult(result)
      } catch {
        return null
      }
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
      clearClientStorageAfterSignOut()
      qc.setQueryData(queryKeys.auth.session, null)
      qc.invalidateQueries()
    },
  })
}

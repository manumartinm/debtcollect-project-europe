import { createAuthClient } from "better-auth/react"

import { API_BASE } from "@/lib/api"

export const authClient = createAuthClient({
  baseURL: API_BASE,
})

export const {
  signIn,
  signOut,
  signUp,
  resetPassword,
  requestPasswordReset,
  useSession,
} = authClient

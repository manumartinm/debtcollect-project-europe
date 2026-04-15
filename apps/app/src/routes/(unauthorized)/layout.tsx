import { Navigate, Outlet } from "react-router"
import { hasValidSession, useAuthSession } from "@/hooks/use-auth"

export default function Layout() {
  const { data: session, isPending } = useAuthSession()

  if (isPending) return null
  // Only treat as logged in when user id is present (avoids blocking /signup on bad cache).
  if (hasValidSession(session)) return <Navigate to="/" replace />

  return <Outlet />
}

import { Navigate, Outlet } from "react-router"
import { OrgProvider } from "@/context/org-context"
import { hasValidSession, useAuthSession } from "@/hooks/use-auth"

export default function Layout() {
  const { data: session, isPending } = useAuthSession()

  if (isPending) return null
  if (!hasValidSession(session)) return <Navigate to="/signup" replace />

  return (
    <OrgProvider>
      <Outlet />
    </OrgProvider>
  )
}

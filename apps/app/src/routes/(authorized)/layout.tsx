import { Navigate, Outlet } from "react-router"
import { useAuthSession } from "@/hooks/use-auth"

export default function Layout() {
  const { data: session, isPending } = useAuthSession()

  if (isPending) return null
  if (!session) return <Navigate to="/signin" replace />

  return <Outlet />
}

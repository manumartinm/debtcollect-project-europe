import { Outlet, useLocation } from "react-router"

/**
 * Re-mounts on pathname change and runs a soft page entrance (fade + slide).
 */
export function AnimatedOutlet() {
  const { pathname } = useLocation()

  return (
    <div key={pathname} className="vexor-page-in">
      <Outlet />
    </div>
  )
}

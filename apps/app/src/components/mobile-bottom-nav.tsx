import { Link, useLocation } from "react-router"
import { FileUp, LayoutDashboard, List, Settings } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

const items = [
  { to: "/", label: "Home", icon: LayoutDashboard },
  { to: "/upload", label: "Upload", icon: FileUp },
  { to: "/debtors", label: "Cases", icon: List },
  { to: "/settings", label: "Account", icon: Settings },
]

export function MobileBottomNav() {
  const { pathname } = useLocation()

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex rounded-t-2xl border border-border/50 border-b-0 bg-background/90 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_32px_rgb(15_23_42/0.06)] backdrop-blur-xl backdrop-saturate-150 lg:hidden"
      aria-label="Primary"
    >
      {items.map(({ to, label, icon: Icon }) => {
        const active =
          to === "/"
            ? pathname === "/"
            : pathname === to || pathname.startsWith(`${to}/`)
        return (
          <Link
            key={to}
            to={to}
            className={cn(
              "flex min-h-[3.25rem] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors duration-200",
              active
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground/80"
            )}
          >
            <Icon className="size-5" strokeWidth={active ? 2 : 1.5} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

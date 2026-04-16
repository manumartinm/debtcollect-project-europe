import { Link, useLocation } from "react-router"
import {
  ClipboardList,
  FileUp,
  LayoutDashboard,
  List,
  Settings,
} from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

/** Full-height left rail width — keep in sync with layout padding */
export const FLOATING_NAV_WIDTH_CLASS = "w-56"

type NavItem = {
  to: string
  label: string
  icon: typeof LayoutDashboard
  /** When set, replaces default prefix match for this link */
  isActive?: (pathname: string) => boolean
}

type NavSection = {
  title: string
  items: readonly NavItem[]
}

const sections: readonly NavSection[] = [
  {
    title: "Overview",
    items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Portfolio",
    items: [
      { to: "/upload", label: "Upload CSV", icon: FileUp },
      { to: "/debtors", label: "Debtors", icon: List },
    ],
  },
  {
    title: "Calls",
    items: [
      {
        to: "/calls",
        label: "Call log",
        icon: ClipboardList,
        isActive: (p) =>
          p === "/calls" || /^\/calls\/[^/]+$/.test(p),
      },
    ],
  },
  {
    title: "Workspace",
    items: [{ to: "/settings", label: "Settings", icon: Settings }],
  },
] as const

function isActive(pathname: string, to: string) {
  return to === "/"
    ? pathname === "/"
    : pathname === to || pathname.startsWith(`${to}/`)
}

function linkActive(pathname: string, item: NavItem) {
  if (item.isActive) return item.isActive(pathname)
  return isActive(pathname, item.to)
}

export function FloatingNav() {
  const { pathname } = useLocation()

  return (
    <nav
      className={cn(
        FLOATING_NAV_WIDTH_CLASS,
        "fixed left-0 top-0 z-50 hidden h-dvh flex-col border-r border-border bg-card shadow-[4px_0_24px_rgb(15_23_42/0.04)] md:flex"
      )}
      aria-label="Primary"
    >
      <div className="shrink-0 border-b border-border px-4 py-5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-[11px] font-bold tracking-tight text-primary-foreground">
            VX
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[14px] font-semibold tracking-tight text-foreground">
              Vexor
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              Debt workspace
            </p>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 py-4">
        <div className="flex flex-1 flex-col gap-6">
          {sections.map((section) => (
            <div key={section.title}>
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {section.title}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const { to, label, icon: Icon } = item
                  const active = linkActive(pathname, item)
                  return (
                    <li key={to}>
                      <Link
                        to={to}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors",
                          active
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <Icon
                          className="size-[18px] shrink-0"
                          strokeWidth={active ? 2 : 1.5}
                        />
                        <span className="truncate">{label}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-auto shrink-0 border-t border-border pt-4">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Shortcuts
          </p>
          <p className="mt-2 px-3 text-[11px] leading-relaxed text-muted-foreground">
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
              ⌘K
            </kbd>{" "}
            command palette
          </p>
        </div>
      </div>
    </nav>
  )
}

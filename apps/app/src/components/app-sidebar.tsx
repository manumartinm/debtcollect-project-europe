import { Link, useLocation } from "react-router"
import { FileUp, LayoutDashboard, List, PhoneCall, Settings } from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@workspace/ui/components/sidebar"

const items = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/upload", label: "Upload", icon: FileUp },
  { to: "/debtors", label: "Debtors", icon: List },
  { to: "/calls", label: "Transcripts", icon: PhoneCall },
  { to: "/settings", label: "Settings", icon: Settings },
]

export function AppSidebar() {
  const { pathname } = useLocation()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border/80 px-2 py-4">
        <div className="flex items-center gap-3 px-2">
          <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#6b73e6] to-[#5e6ad2] text-[11px] font-bold tracking-tight text-white shadow-[var(--shadow-clay-sm)] ring-1 ring-white/20">
            VX
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <p className="text-[13px] font-semibold leading-tight tracking-tight">
              Vexor
            </p>
            <p className="text-[11px] leading-tight text-muted-foreground">
              Last Human Industry
            </p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="gap-2 px-1">
        <SidebarGroup>
          <SidebarGroupLabel className="px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
            Workspace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map(({ to, label, icon: Icon }) => (
                <SidebarMenuItem key={to}>
                  <SidebarMenuButton
                    render={<Link to={to} />}
                    isActive={
                      to === "/"
                        ? pathname === "/"
                        : pathname === to || pathname.startsWith(`${to}/`)
                    }
                    tooltip={label}
                  >
                    <Icon />
                    <span>{label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}

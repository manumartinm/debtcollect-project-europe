import { Outlet } from "react-router"
import { User } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { cn } from "@workspace/ui/lib/utils"

import { CommandPalette } from "@/components/command-palette"
import { FloatingNav } from "@/components/floating-nav"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"

export function AppLayout() {
  return (
    <div className="min-h-screen bg-background">
      <header
        className={cn(
          "sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4",
          "md:pl-56 md:pr-8"
        )}
      >
        <div className="hidden min-w-0 flex-1 md:block" aria-hidden />
        <DropdownMenu>
          <DropdownMenuTrigger className="flex size-9 items-center justify-center rounded-full border-0 bg-transparent outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-ring">
            <Avatar className="size-8">
              <AvatarFallback className="bg-muted text-xs font-medium text-muted-foreground">
                VM
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">Demo User</span>
                <span className="text-xs font-normal text-muted-foreground">
                  collector@vexor.demo
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <User className="size-4" />
              Account (demo)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <main
        className={cn(
          "mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-8 md:pb-12 md:pl-56 md:pr-8 lg:pb-14"
        )}
      >
        <Outlet />
      </main>
      <FloatingNav />
      <MobileBottomNav />
      <CommandPalette />
    </div>
  )
}

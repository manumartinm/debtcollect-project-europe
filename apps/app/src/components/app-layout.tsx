import { Outlet, useNavigate } from "react-router"
import { LogOut, User } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { CommandPalette } from "@/components/command-palette"
import { FloatingNav } from "@/components/floating-nav"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"
import { useAuthSession, useSignOut } from "@/hooks/use-auth"

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export function AppLayout() {
  const { data: session } = useAuthSession()
  const signOut = useSignOut()
  const navigate = useNavigate()

  const user = session?.user
  const displayName = user?.name ?? "Demo User"
  const displayEmail = user?.email ?? "collector@vexor.demo"

  const handleSignOut = () => {
    signOut.mutate(undefined, { onSuccess: () => navigate("/signin") })
  }

  return (
    <div className="min-h-screen bg-background">
      <header
        className={cn(
          "sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4",
          "md:pl-56 md:pr-8",
        )}
      >
        <div className="hidden min-w-0 flex-1 md:block" aria-hidden />
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="size-9 shrink-0 rounded-full"
                aria-label="Open account menu"
              />
            }
          >
            <Avatar className="size-8">
              <AvatarFallback className="bg-muted text-xs font-medium text-muted-foreground">
                {initials(displayName)}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={6}
            className="z-200 w-56"
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-0.5 py-0.5">
                  <span className="text-sm font-medium text-foreground">
                    {displayName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {displayEmail}
                  </span>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2"
              onSelect={() => navigate("/settings")}
            >
              <User className="size-4 opacity-70" />
              Account
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2" onSelect={handleSignOut}>
              <LogOut className="size-4 opacity-70" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <main
        className={cn(
          "mx-auto w-full max-w-[min(100%,90rem)] flex-1 px-4 pb-28 pt-6 md:pb-12 md:pl-56 md:pr-10 lg:pb-14 lg:pt-8",
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

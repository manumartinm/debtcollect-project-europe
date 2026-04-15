import * as React from "react"
import { useNavigate } from "react-router"
import {
  Building2,
  FileUp,
  LayoutDashboard,
  List,
  Settings,
  Users,
} from "lucide-react"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@workspace/ui/components/command"
import { useDebtors } from "@/context/debtors-context"

export function CommandPalette() {
  const [open, setOpen] = React.useState(false)
  const navigate = useNavigate()
  const { debtors } = useDebtors()

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", down)
    return () => window.removeEventListener("keydown", down)
  }, [])

  const go = (path: string) => {
    setOpen(false)
    navigate(path)
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen} showCloseButton>
      <CommandInput placeholder="Search debtors, pages, actions…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Pages">
          <CommandItem
            onSelect={() => go("/")}
            className="gap-2"
          >
            <LayoutDashboard className="size-4" />
            Dashboard
          </CommandItem>
          <CommandItem onSelect={() => go("/upload")} className="gap-2">
            <FileUp className="size-4" />
            Upload CSV
          </CommandItem>
          <CommandItem onSelect={() => go("/debtors")} className="gap-2">
            <List className="size-4" />
            Debtors
          </CommandItem>
          <CommandItem onSelect={() => go("/settings")} className="gap-2">
            <Settings className="size-4" />
            Settings
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Debtors">
          {debtors.slice(0, 40).map((d) => (
            <CommandItem
              key={d.debtorId}
              value={`${d.name} ${d.caseRef} ${d.debtorId}`}
              onSelect={() => go(`/debtors/${encodeURIComponent(d.debtorId)}`)}
              className="gap-2"
            >
              <Users className="size-4 shrink-0" />
              <span className="truncate">{d.name}</span>
              <span className="ml-auto font-mono text-xs text-muted-foreground">
                {d.caseRef}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => go("/upload")} className="gap-2">
            <Building2 className="size-4" />
            Import portfolio
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}

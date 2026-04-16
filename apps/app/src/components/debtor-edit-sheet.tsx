import * as React from "react"
import { toast } from "sonner"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { useUpdateDebtor } from "@/hooks/use-debtors-queries"
import type { ApiDebtor } from "@/lib/api"
import { parseDebtAmountString } from "@/lib/debtor-traces"

export function DebtorEditSheet({
  debtor,
  open,
  onOpenChange,
}: {
  debtor: ApiDebtor
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const update = useUpdateDebtor()

  const [debtorName, setDebtorName] = React.useState(debtor.debtorName)
  const [country, setCountry] = React.useState(debtor.country)
  const [debtAmountStr, setDebtAmountStr] = React.useState(() =>
    String(parseDebtAmountString(debtor.debtAmount))
  )
  React.useEffect(() => {
    if (!open) return
    setDebtorName(debtor.debtorName)
    setCountry(debtor.country)
    setDebtAmountStr(String(parseDebtAmountString(debtor.debtAmount)))
  }, [open, debtor])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const normalized = debtAmountStr.replace(/\s/g, "").replace(",", ".")
    const n = Number.parseFloat(normalized)
    if (!Number.isFinite(n)) {
      toast.error("Enter a valid debt amount.")
      return
    }
    update.mutate(
      {
        id: debtor.id,
        patch: {
          debtorName,
          country,
          debtAmount: n,
        },
      },
      {
        onSuccess: () => {
          toast.success("Case updated.")
          onOpenChange(false)
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Could not save."),
      }
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton
        className="flex w-full flex-col gap-0 overflow-y-auto border-border p-0 sm:max-w-md"
      >
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <SheetHeader className="border-b border-border px-6 py-4 text-left">
            <SheetTitle className="text-base font-semibold">Edit case</SheetTitle>
            <SheetDescription className="text-left text-xs">
              Update portfolio fields. Case ref ({debtor.caseRef}) is fixed.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="debtorName">Debtor name</Label>
              <Input
                id="debtorName"
                value={debtorName}
                onChange={(e) => setDebtorName(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="debtAmount">Debt amount (EUR)</Label>
              <Input
                id="debtAmount"
                inputMode="decimal"
                value={debtAmountStr}
                onChange={(e) => setDebtAmountStr(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>
          <SheetFooter className="flex-row justify-end gap-2 border-t border-border bg-background px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? "Saving…" : "Save"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

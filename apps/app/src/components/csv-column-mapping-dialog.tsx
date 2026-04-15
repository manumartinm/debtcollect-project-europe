import * as React from "react"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

import {
  type CsvColumnMapping,
  type CsvTargetField,
  CSV_TARGET_FIELDS,
  guessColumnMapping,
  mappingIsValid,
} from "@/lib/csv-import"

const NONE = "__none__"

const TARGET_LABELS: Record<CsvTargetField, { label: string; hint?: string }> = {
  full_name: { label: "Full name", hint: "Required" },
  phone_number: { label: "Phone number" },
  address: { label: "Address" },
  email: { label: "Email" },
  tax_id: { label: "Tax ID" },
  debt_amount: { label: "Debt amount", hint: "Optional — defaults to 0" },
  country: { label: "Country", hint: "Optional — 2-letter code; default ES" },
}

type CsvColumnMappingDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  csvHeaders: string[]
  onConfirm: (mapping: CsvColumnMapping) => void
}

export function CsvColumnMappingDialog({
  open,
  onOpenChange,
  csvHeaders,
  onConfirm,
}: CsvColumnMappingDialogProps) {
  const [mapping, setMapping] = React.useState<CsvColumnMapping>({})

  React.useEffect(() => {
    if (open && csvHeaders.length > 0) {
      setMapping(guessColumnMapping(csvHeaders))
    }
  }, [open, csvHeaders])

  const setField = (field: CsvTargetField, csvHeader: string | undefined) => {
    setMapping((prev) => {
      const next = { ...prev }
      if (!csvHeader || csvHeader === NONE) {
        delete next[field]
      } else {
        next[field] = csvHeader
      }
      return next
    })
  }

  const handleConfirm = () => {
    if (!mappingIsValid(mapping)) return
    onConfirm(mapping)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Map CSV columns</DialogTitle>
          <DialogDescription>
            Choose which column from your file matches each field.{" "}
            <span className="font-medium text-foreground">Full name</span> is
            required. Case reference uses tax ID, then email, otherwise a
            generated id.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {CSV_TARGET_FIELDS.map((field) => {
            const { label, hint } = TARGET_LABELS[field]
            const value = mapping[field] ?? NONE
            return (
              <div key={field} className="grid gap-1.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {label}
                    {field === "full_name" ? (
                      <span className="text-destructive"> *</span>
                    ) : null}
                  </span>
                  {hint ? (
                    <span className="text-xs text-muted-foreground">{hint}</span>
                  ) : null}
                </div>
                <Select
                  value={value}
                  onValueChange={(v) =>
                    setField(field, v === NONE ? undefined : v)
                  }
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="— Not mapped —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>— Not mapped —</SelectItem>
                    {csvHeaders.map((h) => (
                      <SelectItem key={`${field}-${h}`} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )
          })}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!mappingIsValid(mapping)}
          >
            Apply mapping
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

import { Download } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@workspace/ui/components/button"
import type { ApiDebtor } from "@/lib/api"
import {
  enrichedFieldValue,
  flattenTraceSteps,
  parseDebtAmountString,
} from "@/lib/debtor-traces"

function escapeCell(v: string) {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`
  return v
}

function buildCsv(debtors: ApiDebtor[]) {
  const enriched = debtors.filter((d) => d.enrichmentStatus === "complete")
  const headers = [
    "case_ref",
    "country",
    "debt_amount",
    "call_outcome",
    "legal_outcome",
    "name",
    "leverage_score",
    "phone",
    "address",
    "employer",
    "assets",
    "social_hints",
    "sources_urls",
  ]
  const lines = [headers.join(",")]
  for (const d of enriched) {
    const urls = flattenTraceSteps(d)
      .flatMap((t) => t.sources.map((s) => s.url))
      .join(" | ")
    const row = [
      d.caseRef,
      d.country,
      String(parseDebtAmountString(d.debtAmount)),
      d.callOutcome,
      d.legalOutcome,
      d.debtorName,
      d.leverageScore,
      enrichedFieldValue(d, "phone") ?? "",
      enrichedFieldValue(d, "address") ?? "",
      enrichedFieldValue(d, "employer") ?? "",
      enrichedFieldValue(d, "assets") ?? "",
      enrichedFieldValue(d, "social_media_hints") ?? "",
      urls,
    ].map((x) => escapeCell(String(x)))
    lines.push(row.join(","))
  }
  return lines.join("\n")
}

export function ExportButton({ debtors }: { debtors: ApiDebtor[] }) {
  const count = debtors.filter((d) => d.enrichmentStatus === "complete").length

  const handleExport = () => {
    if (count === 0) {
      toast.message("No enriched debtors to export yet.")
      return
    }
    const csv = buildCsv(debtors)
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `vexor-enriched-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${count} enriched row${count === 1 ? "" : "s"}.`)
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-2"
      onClick={handleExport}
    >
      <Download className="size-4" />
      Export {count} enriched
    </Button>
  )
}

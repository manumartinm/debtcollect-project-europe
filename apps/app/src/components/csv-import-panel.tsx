import * as React from "react"
import Papa from "papaparse"
import { toast } from "sonner"

import { Button } from "@workspace/ui/components/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { cn } from "@workspace/ui/lib/utils"

import { CsvColumnMappingDialog } from "@/components/csv-column-mapping-dialog"
import { CsvDropzone } from "@/components/csv-dropzone"
import { SAMPLE_PORTFOLIO_CSV } from "@/data/sample-portfolio-csv"
import { useBulkCreateDebtors } from "@/hooks/use-debtors-queries"
import {
  guessColumnMapping,
  mappingIsValid,
  rowToBulkRow,
  type CsvBulkRow,
  type CsvColumnMapping,
} from "@/lib/csv-import"

type CsvImportPanelProps = {
  orgId: string | null
  /** Called after a successful import (e.g. navigate). */
  onImported?: () => void
  showSampleButtons?: boolean
  disabled?: boolean
}

export function CsvImportPanel({
  orgId,
  onImported,
  showSampleButtons = true,
  disabled = false,
}: CsvImportPanelProps) {
  const bulkMutation = useBulkCreateDebtors()
  const [rows, setRows] = React.useState<Record<string, string>[]>([])
  const [headers, setHeaders] = React.useState<string[]>([])
  const [mapping, setMapping] = React.useState<CsvColumnMapping | null>(null)
  const [mappingOpen, setMappingOpen] = React.useState(false)

  const busy = bulkMutation.isPending || disabled

  const invalid = React.useMemo(() => {
    if (!mapping || !rows.length) return new Set<number>()
    const bad = new Set<number>()
    rows.forEach((row, i) => {
      if (!rowToBulkRow(row, i, mapping)) bad.add(i)
    })
    return bad
  }, [rows, mapping])

  const openMappingForData = (
    data: Record<string, string>[],
    fields: string[] | undefined,
  ) => {
    setRows(data)
    setHeaders(fields ?? Object.keys(data[0] ?? {}))
    setMapping(null)
    setMappingOpen(true)
  }

  const parseFile = (file: File) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const data = res.data.filter((r) => Object.keys(r).some((k) => r[k]))
        if (data.length === 0) {
          toast.error("No data rows in CSV.")
          return
        }
        openMappingForData(data, res.meta.fields)
      },
      error: (err) => toast.error(err.message),
    })
  }

  const loadSampleCsvPreview = () => {
    Papa.parse<Record<string, string>>(SAMPLE_PORTFOLIO_CSV, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const data = res.data.filter((r) => Object.keys(r).some((k) => r[k]))
        openMappingForData(data, res.meta.fields)
        toast.message("Loaded demo CSV — confirm column mapping.")
      },
      error: (err: Error) => toast.error(err.message),
    })
  }

  const skipWithSampleData = () => {
    Papa.parse<Record<string, string>>(SAMPLE_PORTFOLIO_CSV, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const data = res.data.filter((r) => Object.keys(r).some((k) => r[k]))
        const hdrs = res.meta.fields ?? Object.keys(data[0] ?? {})
        const guessed = guessColumnMapping(hdrs)
        if (!mappingIsValid(guessed)) {
          openMappingForData(data, res.meta.fields)
          toast.message("Confirm column mapping for demo import.")
          return
        }
        setRows(data)
        setHeaders(hdrs)
        setMapping(guessed)
        void runImport(buildRows(data, guessed))
      },
      error: (err: Error) => toast.error(err.message),
    })
  }

  function buildRows(
    data: Record<string, string>[],
    m: CsvColumnMapping,
  ): CsvBulkRow[] {
    const out: CsvBulkRow[] = []
    data.forEach((row, i) => {
      const d = rowToBulkRow(row, i, m)
      if (d) out.push(d)
    })
    return out
  }

  const runImport = async (out: CsvBulkRow[]) => {
    if (!orgId) {
      toast.error("No active organization.")
      return
    }
    try {
      const res = await bulkMutation.mutateAsync({ orgId, rows: out })
      toast.success(`Imported ${res.imported} case(s).`)
      onImported?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed.")
    }
  }

  const importRows = () => {
    if (!mapping || !mappingIsValid(mapping)) {
      toast.error("Apply column mapping first (Full name is required).")
      return
    }
    const out = buildRows(rows, mapping)
    if (out.length === 0) {
      toast.error("Nothing valid to import.")
      return
    }
    void runImport(out)
  }

  const handleMappingConfirm = (m: CsvColumnMapping) => {
    setMapping(m)
    if (rows.some((_, i) => !rowToBulkRow(rows[i]!, i, m))) {
      toast.message("Some rows are missing a full name — they will be skipped.")
    }
  }

  const preview = rows.slice(0, 10)

  return (
    <>
      <CsvColumnMappingDialog
        open={mappingOpen}
        onOpenChange={setMappingOpen}
        csvHeaders={headers}
        onConfirm={handleMappingConfirm}
      />

      <div className="space-y-6">
        {showSampleButtons ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadSampleCsvPreview}
              disabled={busy}
            >
              Load sample CSV
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={skipWithSampleData}
              disabled={busy}
            >
              Import demo data
            </Button>
          </div>
        ) : null}

        <CsvDropzone onFile={parseFile} disabled={busy} />

        {rows.length > 0 && !mapping && !mappingOpen ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setMappingOpen(true)}
            disabled={busy}
          >
            Open column mapping
          </Button>
        ) : null}

        {mapping && preview.length > 0 ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                Preview ({preview.length} of {rows.length} rows)
                {invalid.size > 0 ? (
                  <span className="text-destructive">
                    {" "}
                    · {invalid.size} row(s) will be skipped
                  </span>
                ) : null}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMappingOpen(true)}
                  disabled={busy}
                >
                  Edit mapping
                </Button>
                <Button type="button" onClick={importRows} disabled={busy}>
                  {busy ? "Importing…" : "Import to workspace"}
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {headers.slice(0, 8).map((h) => (
                      <TableHead key={h}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((row, i) => (
                    <TableRow
                      key={i}
                      className={cn(invalid.has(i) && "bg-destructive/5")}
                    >
                      {headers.slice(0, 8).map((h) => (
                        <TableCell
                          key={h}
                          className="max-w-48 truncate font-mono text-xs"
                        >
                          {row[h] ?? ""}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {invalid.size > 0 ? (
              <p className="text-xs text-destructive">
                Highlighted rows have no value in the column mapped to{" "}
                <strong>full name</strong>.
              </p>
            ) : null}
          </div>
        ) : rows.length > 0 && !mapping ? (
          <p className="text-sm text-muted-foreground">
            Use the mapping dialog to assign columns.
          </p>
        ) : null}

        <p className="text-center text-sm text-muted-foreground">
          First row must be headers. After upload, map columns to: full name,
          phone, address, email, tax id — plus optional debt amount and country.
        </p>
      </div>
    </>
  )
}

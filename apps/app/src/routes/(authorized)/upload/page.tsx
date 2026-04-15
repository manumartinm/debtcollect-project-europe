import * as React from "react"
import { useNavigate } from "react-router"
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
import type { Debtor } from "@/data/mock"

import { CsvDropzone } from "@/components/csv-dropzone"
import { useDebtors } from "@/context/debtors-context"
import { SAMPLE_PORTFOLIO_CSV } from "@/data/sample-portfolio-csv"
import { rowToDebtor } from "@/lib/csv-import"

export default function UploadPage() {
  const navigate = useNavigate()
  const { appendDebtorsFromImport } = useDebtors()
  const [rows, setRows] = React.useState<Record<string, string>[]>([])
  const [headers, setHeaders] = React.useState<string[]>([])
  const [invalid, setInvalid] = React.useState<Set<number>>(new Set())
  const [busy, setBusy] = React.useState(false)

  const ingestRows = (
    data: Record<string, string>[],
    fields: string[] | undefined
  ) => {
    setRows(data)
    setHeaders(fields ?? Object.keys(data[0] ?? {}))
    const bad = new Set<number>()
    data.forEach((row, i) => {
      const d = rowToDebtor(row, i)
      if (!d) bad.add(i)
    })
    setInvalid(bad)
    if (bad.size)
      toast.message(`${bad.size} row(s) missing required numeric debt amount.`)
  }

  const parseFile = (file: File) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const data = res.data.filter((r) => Object.keys(r).some((k) => r[k]))
        ingestRows(data, res.meta.fields)
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
        ingestRows(data, res.meta.fields)
        toast.message("Loaded demo CSV into preview.")
      },
      error: (err: Error) => toast.error(err.message),
    })
  }

  const skipWithSampleData = () => {
    setBusy(true)
    Papa.parse<Record<string, string>>(SAMPLE_PORTFOLIO_CSV, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const data = res.data.filter((r) => Object.keys(r).some((k) => r[k]))
        const out: Debtor[] = []
        data.forEach((row, i) => {
          const d = rowToDebtor(row, i)
          if (d) out.push(d)
        })
        if (out.length === 0) {
          toast.error("Demo CSV failed to parse.")
          setBusy(false)
          return
        }
        appendDebtorsFromImport(out)
        toast.success(`Imported ${out.length} demo case(s).`)
        setBusy(false)
        navigate("/debtors")
      },
      error: (err: Error) => {
        toast.error(err.message)
        setBusy(false)
      },
    })
  }

  const importRows = () => {
    setBusy(true)
    const out: Debtor[] = []
    rows.forEach((row, i) => {
      const d = rowToDebtor(row, i)
      if (d) out.push(d)
    })
    if (out.length === 0) {
      toast.error("Nothing valid to import.")
      setBusy(false)
      return
    }
    appendDebtorsFromImport(out)
    toast.success(`Imported ${out.length} case(s).`)
    setBusy(false)
    navigate("/debtors")
  }

  const preview = rows.slice(0, 10)

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Upload portfolio
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          CSV with case id, country, debt amount, and optional outcomes. Rows
          without a valid debt amount are skipped.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
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
            Skip with demo data
          </Button>
        </div>
      </div>

      <CsvDropzone onFile={parseFile} disabled={busy} />

      {preview.length > 0 ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Preview ({preview.length} of {rows.length} rows)
            </p>
            <Button type="button" onClick={importRows} disabled={busy}>
              Import to workspace
            </Button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  {headers.slice(0, 6).map((h) => (
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
                    {headers.slice(0, 6).map((h) => (
                      <TableCell
                        key={h}
                        className="max-w-[12rem] truncate font-mono text-xs"
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
              Highlighted rows will not be imported until debt amount parses as
              a number.
            </p>
          ) : null}
        </div>
      ) : null}

      <p className="text-center text-sm text-muted-foreground">
        Keep column headers in the first row. Required: a numeric debt amount
        per row.
      </p>
    </div>
  )
}

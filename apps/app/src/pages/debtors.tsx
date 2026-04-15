import * as React from "react"
import { Link, useNavigate } from "react-router"

import { Button, buttonVariants } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { cn } from "@workspace/ui/lib/utils"

import { DebtorCardList } from "@/components/debtor-card-list"
import { DebtorTable } from "@/components/debtor-table"
import { EmptyState } from "@/components/empty-state"
import { ExportButton } from "@/components/export-button"
import { useDebtors } from "@/context/debtors-context"
import type { CaseStatus, Debtor } from "@/data/mock"
import { CASE_STATUS_LABELS } from "@/data/mock"
import { useMinLg } from "@/hooks/use-media"
import { Search, SlidersHorizontal, Upload } from "lucide-react"

const PAGE = 15

const COUNTRIES = ["all", "ES", "PT", "IT", "GR"] as const
const ENRICH = ["all", "pending", "complete", "failed"] as const
type SortKey = "debtAmount" | "caseStatus" | "none"

function sortRows(
  rows: Debtor[],
  key: SortKey,
  dir: "asc" | "desc"
): Debtor[] {
  if (key === "none") return rows
  const mul = dir === "asc" ? 1 : -1
  return [...rows].sort((a, b) => {
    if (key === "debtAmount") return (a.debtAmount - b.debtAmount) * mul
    return a.caseStatus.localeCompare(b.caseStatus) * mul
  })
}

export default function DebtorsPage() {
  const { debtors } = useDebtors()
  const navigate = useNavigate()
  const lg = useMinLg()

  const [q, setQ] = React.useState("")
  const [status, setStatus] = React.useState<string>("all")
  const [country, setCountry] = React.useState<string>("all")
  const [enrich, setEnrich] = React.useState<string>("all")
  const [filtersOpen, setFiltersOpen] = React.useState(false)
  const [page, setPage] = React.useState(0)
  const [sortKey, setSortKey] = React.useState<SortKey>("none")
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc")

  const filtered = React.useMemo(() => {
    return debtors.filter((d) => {
      const matchQ =
        !q.trim() ||
        d.name.toLowerCase().includes(q.toLowerCase()) ||
        d.caseId.toLowerCase().includes(q.toLowerCase())
      const matchS = status === "all" || d.caseStatus === status
      const matchC = country === "all" || d.country === country
      const matchE = enrich === "all" || d.enrichmentStatus === enrich
      return matchQ && matchS && matchC && matchE
    })
  }, [debtors, q, status, country, enrich])

  const sorted = React.useMemo(
    () => sortRows(filtered, sortKey, sortDir),
    [filtered, sortKey, sortDir]
  )

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE))
  const safePage = Math.min(page, pageCount - 1)

  const onSort = (k: SortKey) => {
    if (k === "none") return
    setSortKey((prev) => {
      if (prev === k) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"))
        return k
      }
      setSortDir("desc")
      return k
    })
  }

  const listStaggerKey = `${safePage}-${q}-${status}-${country}-${enrich}-${sortKey}-${sortDir}`

  if (debtors.length === 0) {
    return (
      <div
        className="vexor-fade-up"
        style={{ "--vexor-stagger": "0ms" } as React.CSSProperties}
      >
        <EmptyState
          icon={Upload}
          title="No cases yet"
          description="Upload a CSV to import your portfolio. You will be able to enrich each debtor and track status from here."
          actionLabel="Go to upload"
          onAction={() => navigate("/upload")}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Debtors</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {sorted.length} case{sorted.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportButton debtors={debtors} />
          <Link
            to="/upload"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Import CSV
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name or case ID…"
            className="h-11 pl-10"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setPage(0)
            }}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-11 gap-2 lg:hidden"
          onClick={() => setFiltersOpen((o) => !o)}
        >
          <SlidersHorizontal className="size-4" />
          Filters
        </Button>
      </div>

      <div
        className={cn(
          "grid gap-4 rounded-xl border border-border bg-muted/10 p-4 sm:grid-cols-2 lg:grid-cols-3",
          !filtersOpen && "hidden lg:grid"
        )}
      >
        <div className="space-y-2">
          <Label className="text-xs">Status</Label>
          <Select
            value={status}
            onValueChange={(v: string | null) => {
              if (v) {
                setStatus(v)
                setPage(0)
              }
            }}
          >
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {(Object.keys(CASE_STATUS_LABELS) as CaseStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {CASE_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Country</Label>
          <Select
            value={country}
            onValueChange={(v: string | null) => {
              if (v) {
                setCountry(v)
                setPage(0)
              }
            }}
          >
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c === "all" ? "All" : c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Enrichment</Label>
          <Select
            value={enrich}
            onValueChange={(v: string | null) => {
              if (v) {
                setEnrich(v)
                setPage(0)
              }
            }}
          >
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ENRICH.map((c) => (
                <SelectItem key={c} value={c}>
                  {c === "all" ? "All" : c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          No debtors match your filters.{" "}
          <button
            type="button"
            className="text-primary underline"
            onClick={() => {
              setQ("")
              setStatus("all")
              setCountry("all")
              setEnrich("all")
            }}
          >
            Clear filters
          </button>
        </div>
      ) : lg ? (
        <DebtorTable
          key={listStaggerKey}
          rows={sorted}
          page={safePage}
          pageSize={PAGE}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={onSort}
        />
      ) : (
        <DebtorCardList
          key={listStaggerKey}
          rows={sorted}
          page={safePage}
          pageSize={PAGE}
        />
      )}

      {sorted.length > 0 ? (
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            Page {safePage + 1} of {pageCount}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={safePage <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

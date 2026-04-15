import * as React from "react"
import { Link, useNavigate } from "react-router"
import { toast } from "sonner"

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
import { useOrg } from "@/context/org-context"
import type { ApiDebtor } from "@/lib/api"
import { ENRICHMENT_STATUS_LABEL } from "@/lib/enrichment-labels"
import { useSession } from "@/lib/auth-client"
import { parseDebtAmountString } from "@/lib/debtor-traces"
import {
  useDebtorsList,
  useEnrichDebtorsBatch,
  useSetDebtorStatus,
} from "@/hooks/use-debtors-queries"
import type { CaseStatus } from "@/types/debtor"
import { CASE_STATUS_LABELS } from "@/types/debtor"
import { useMinLg } from "@/hooks/use-media"
import { Search, Sparkles, Upload } from "lucide-react"

const PAGE = 15

const COUNTRIES = ["all", "ES", "PT", "IT", "GR"] as const
const ENRICH = [
  "all",
  "not_started",
  "pending",
  "running",
  "complete",
  "failed",
] as const
type SortKey = "debtAmount" | "caseStatus" | "none"

function sortRows(
  rows: ApiDebtor[],
  key: SortKey,
  dir: "asc" | "desc"
): ApiDebtor[] {
  if (key === "none") return rows
  const mul = dir === "asc" ? 1 : -1
  return [...rows].sort((a, b) => {
    if (key === "debtAmount")
      return (
        (parseDebtAmountString(a.debtAmount) -
          parseDebtAmountString(b.debtAmount)) *
        mul
      )
    return a.caseStatus.localeCompare(b.caseStatus) * mul
  })
}

function FilterSelect({
  id,
  label,
  value,
  onValueChange,
  children,
}: {
  id: string
  label: string
  value: string
  onValueChange: (v: string) => void
  children: React.ReactNode
}) {
  return (
    <div className="flex min-w-26 flex-1 flex-col gap-1 sm:min-w-30 sm:flex-none">
      <Label
        htmlFor={id}
        className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase"
      >
        {label}
      </Label>
      <Select value={value} onValueChange={(v) => onValueChange(v ?? "")}>
        <SelectTrigger id={id} className="h-9 w-full text-xs sm:text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  )
}

export default function DebtorsPage() {
  const { orgId, isLoading: orgLoading, orgs } = useOrg()
  const { data: session } = useSession()
  const author = session?.user?.name ?? "Collector"
  const {
    data: debtors = [],
    isLoading: debtorsLoading,
    isError,
    error,
  } = useDebtorsList(orgId ?? "")
  const setStatusMutation = useSetDebtorStatus()
  const enrichBatchMutation = useEnrichDebtorsBatch()
  const navigate = useNavigate()
  const lg = useMinLg()

  const [q, setQ] = React.useState("")
  const [status, setStatus] = React.useState<string>("all")
  const [country, setCountry] = React.useState<string>("all")
  const [enrich, setEnrich] = React.useState<string>("all")
  const [page, setPage] = React.useState(0)
  const [sortKey, setSortKey] = React.useState<SortKey>("none")
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc")
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(
    () => new Set()
  )

  const filtered = React.useMemo(() => {
    return debtors.filter((d) => {
      const matchQ =
        !q.trim() ||
        d.debtorName.toLowerCase().includes(q.toLowerCase()) ||
        d.caseRef.toLowerCase().includes(q.toLowerCase())
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

  const pageIds = React.useMemo(
    () =>
      sorted
        .slice(safePage * PAGE, safePage * PAGE + PAGE)
        .map((d) => d.id),
    [sorted, safePage]
  )

  React.useEffect(() => {
    setSelectedIds(new Set())
  }, [q, status, country, enrich])

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

  const toggleSelect = React.useCallback((debtorId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(debtorId)) next.delete(debtorId)
      else next.add(debtorId)
      return next
    })
  }, [])

  const toggleSelectPage = React.useCallback(
    (ids: string[], select: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (select) ids.forEach((id) => next.add(id))
        else ids.forEach((id) => next.delete(id))
        return next
      })
    },
    []
  )

  const applyBulkStatus = React.useCallback(
    async (st: CaseStatus) => {
      const ids = [...selectedIds]
      for (const id of ids) {
        await setStatusMutation.mutateAsync({
          id,
          status: st,
          note: "Bulk update",
          author,
        })
      }
      setSelectedIds(new Set())
    },
    [selectedIds, setStatusMutation, author]
  )

  const selectionProps = React.useMemo(
    () => ({
      selectedIds,
      onToggle: toggleSelect,
      onTogglePage: toggleSelectPage,
      pageIds,
    }),
    [selectedIds, toggleSelect, toggleSelectPage, pageIds]
  )

  const listStaggerKey = `${safePage}-${q}-${status}-${country}-${enrich}-${sortKey}-${sortDir}`

  const hasActiveFilters =
    q.trim() !== "" || status !== "all" || country !== "all" || enrich !== "all"

  if (orgLoading) {
    return (
      <p className="text-sm text-muted-foreground">Loading organization…</p>
    )
  }

  if (!orgId && orgs.length === 0) {
    return (
      <div className="vexor-fade-up">
        <EmptyState
          icon={Upload}
          title="No organization"
          description="Create an organization in the API or database first, then refresh. Debtors are scoped per organization."
          actionLabel="Open API docs"
          onAction={() =>
            window.open(
              `${import.meta.env.VITE_API_URL ?? "http://localhost:3000"}/api/docs`,
              "_blank"
            )
          }
        />
      </div>
    )
  }

  if (debtorsLoading) {
    return <p className="text-sm text-muted-foreground">Loading debtors…</p>
  }

  if (isError) {
    return (
      <p className="text-sm text-destructive">
        {(error as Error)?.message ?? "Failed to load debtors."}
      </p>
    )
  }

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
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Debtors</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {sorted.length} case{sorted.length === 1 ? "" : "s"}
            {selectedIds.size > 0 ? (
              <span className="text-foreground">
                {" "}
                · {selectedIds.size} selected
              </span>
            ) : null}
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

      {/* Filters: one horizontal row (wraps on narrow screens) */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1 lg:max-w-md">
          <Label
            htmlFor="debtor-search"
            className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase"
          >
            Search
          </Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="debtor-search"
              placeholder="Name or case ID…"
              className="h-9 pl-10 text-sm"
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setPage(0)
              }}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-2 sm:gap-3 lg:flex-1 lg:justify-end">
          <FilterSelect
            id="filter-status"
            label="Status"
            value={status}
            onValueChange={(v) => {
              setStatus(v)
              setPage(0)
            }}
          >
            <SelectItem value="all">All</SelectItem>
            {(Object.keys(CASE_STATUS_LABELS) as CaseStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {CASE_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </FilterSelect>
          <FilterSelect
            id="filter-country"
            label="Country"
            value={country}
            onValueChange={(v) => {
              setCountry(v)
              setPage(0)
            }}
          >
            {COUNTRIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c === "all" ? "All" : c}
              </SelectItem>
            ))}
          </FilterSelect>
          <FilterSelect
            id="filter-enrich"
            label="Enrichment"
            value={enrich}
            onValueChange={(v) => {
              setEnrich(v)
              setPage(0)
            }}
          >
            {ENRICH.map((c) => (
              <SelectItem key={c} value={c}>
                {c === "all"
                  ? "All"
                  : ENRICHMENT_STATUS_LABEL[
                      c as keyof typeof ENRICHMENT_STATUS_LABEL
                    ] ?? c}
              </SelectItem>
            ))}
          </FilterSelect>
          {hasActiveFilters ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 shrink-0 text-xs text-muted-foreground"
              onClick={() => {
                setQ("")
                setStatus("all")
                setCountry("all")
                setEnrich("all")
                setPage(0)
              }}
            >
              Reset filters
            </Button>
          ) : null}
        </div>
      </div>

      {selectedIds.size > 0 ? (
        <div
          className="rounded-lg border border-primary/25 bg-primary/5 px-4 py-4"
          role="region"
          aria-label="Bulk actions"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-6 sm:gap-y-3">
            <p className="text-sm font-semibold text-foreground sm:shrink-0 sm:pb-0.5">
              {selectedIds.size} selected
            </p>

            <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-[16rem]">
              <Label
                htmlFor="bulk-status"
                className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase"
              >
                Set case status
              </Label>
              <Select
                onValueChange={(v) => {
                  if (v) applyBulkStatus(v as CaseStatus)
                }}
              >
                <SelectTrigger
                  id="bulk-status"
                  className="h-10 w-full bg-background text-sm"
                >
                  <SelectValue placeholder="Choose status…" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CASE_STATUS_LABELS) as CaseStatus[]).map(
                    (s) => (
                      <SelectItem key={s} value={s}>
                        {CASE_STATUS_LABELS[s]}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-68">
              <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                Enrichment
              </span>
              <Button
                type="button"
                variant="default"
                className="h-10 w-full gap-2 font-medium shadow-sm sm:w-auto sm:min-w-54"
                title="Queue research for each selected case. Already-running enrichments are skipped."
                disabled={
                  enrichBatchMutation.isPending || selectedIds.size === 0
                }
                onClick={() => {
                  const ids = [...selectedIds]
                  enrichBatchMutation.mutate(ids, {
                    onSuccess: (res) => {
                      toast.success(
                        `Enrichment queued for ${res.started} case(s).`,
                      )
                      if (res.skipped.length > 0) {
                        toast.message(
                          `${res.skipped.length} skipped (already running).`,
                        )
                      }
                      if (res.errors.length > 0) {
                        toast.error(
                          `${res.errors.length} could not be queued — check the API.`,
                        )
                      }
                      setSelectedIds(new Set())
                    },
                    onError: (e) =>
                      toast.error(
                        e instanceof Error ? e.message : "Batch enrich failed",
                      ),
                  })
                }}
              >
                <Sparkles className="size-4 shrink-0" strokeWidth={1.75} />
                Run enrichment
              </Button>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 shrink-0 sm:self-end"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear selection
            </Button>
          </div>
        </div>
      ) : null}

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
          selection={selectionProps}
        />
      ) : (
        <DebtorCardList
          key={listStaggerKey}
          rows={sorted}
          page={safePage}
          pageSize={PAGE}
          selection={{
            selectedIds,
            onToggle: toggleSelect,
          }}
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

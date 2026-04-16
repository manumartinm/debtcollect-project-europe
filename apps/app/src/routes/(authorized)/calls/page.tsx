import * as React from "react"
import { Link, Navigate } from "react-router"
import { format } from "date-fns"
import { Phone, Search } from "lucide-react"

import { buttonVariants } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { cn } from "@workspace/ui/lib/utils"

import { EmptyState } from "@/components/empty-state"
import { useOrg } from "@/context/org-context"
import type { ApiCallTranscript } from "@/lib/api"
import { useTranscriptsList } from "@/hooks/use-transcripts-queries"

const PAGE_SIZE = 20

type SortKey = "started" | "duration" | "debtor" | "none"

function sortRows(
  rows: ApiCallTranscript[],
  key: SortKey,
  dir: "asc" | "desc"
): ApiCallTranscript[] {
  if (key === "none") return rows
  const mul = dir === "asc" ? 1 : -1
  return [...rows].sort((a, b) => {
    if (key === "started") {
      return (
        (new Date(a.callStartTime).getTime() -
          new Date(b.callStartTime).getTime()) *
        mul
      )
    }
    if (key === "duration") {
      const da = a.durationSeconds ?? 0
      const db = b.durationSeconds ?? 0
      return (da - db) * mul
    }
    const na = (a.debtor?.debtorName ?? "").toLowerCase()
    const nb = (b.debtor?.debtorName ?? "").toLowerCase()
    return na.localeCompare(nb) * mul
  })
}

export default function CallsPage() {
  const { orgId, orgs, isLoading: orgLoading } = useOrg()
  const {
    data: transcripts = [],
    isLoading,
    error,
  } = useTranscriptsList(orgId ?? "")

  const [q, setQ] = React.useState("")
  const [page, setPage] = React.useState(0)
  const [sortKey, setSortKey] = React.useState<SortKey>("started")
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc")

  const filtered = React.useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return transcripts
    return transcripts.filter((row) => {
      const name = (row.debtor?.debtorName ?? "").toLowerCase()
      const ref = (row.debtor?.caseRef ?? "").toLowerCase()
      return name.includes(t) || ref.includes(t) || row.id.toLowerCase().includes(t)
    })
  }, [transcripts, q])

  const sorted = React.useMemo(
    () => sortRows(filtered, sortKey, sortDir),
    [filtered, sortKey, sortDir]
  )

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const slice = sorted.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE
  )

  const onSort = (k: SortKey) => {
    if (sortKey === k) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(k)
      setSortDir(k === "debtor" ? "asc" : "desc")
    }
    setPage(0)
  }

  const headBtn = (k: SortKey, label: string) => (
    <button
      type="button"
      className="inline-flex items-center gap-1 font-medium hover:text-foreground"
      onClick={() => onSort(k)}
    >
      {label}
      {sortKey === k ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
    </button>
  )

  if (!orgLoading && orgs.length === 0) {
    return <Navigate to="/onboarding" replace />
  }

  if (orgLoading || isLoading) {
    return (
      <div className="space-y-4 py-4">
        <div className="h-8 w-56 animate-pulse rounded bg-muted" />
        <div className="h-10 max-w-md animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      </div>
    )
  }

  if (error) {
    return (
      <EmptyState
        title="Error loading calls"
        description={error instanceof Error ? error.message : "Something went wrong"}
      />
    )
  }

  if (transcripts.length === 0) {
    return (
      <EmptyState
        icon={Phone}
        title="No calls yet"
        description="Completed voice calls will appear in this directory with debtor, case ref, and links to each transcript."
      />
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Call log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {sorted.length} call{sorted.length !== 1 ? "s" : ""} in your organization
        </p>
      </div>

      <div className="flex min-w-0 flex-col gap-1 lg:max-w-md">
        <Label
          htmlFor="call-log-search"
          className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase"
        >
          Search
        </Label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="call-log-search"
            placeholder="Debtor name, case ref…"
            className="h-9 pl-10 text-sm"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setPage(0)
            }}
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-mono text-xs">
                {headBtn("started", "Started")}
              </TableHead>
              <TableHead>{headBtn("debtor", "Debtor")}</TableHead>
              <TableHead className="font-mono text-xs">Case ref</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>{headBtn("duration", "Duration")}</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {slice.map((row) => {
              const start = new Date(row.callStartTime)
              const dur =
                row.durationSeconds != null && row.durationSeconds > 0
                  ? `${Math.floor(row.durationSeconds / 60)}:${String(row.durationSeconds % 60).padStart(2, "0")}`
                  : "—"
              return (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-sm tabular-nums">
                    {format(start, "MMM d, yyyy HH:mm")}
                  </TableCell>
                  <TableCell className="font-medium">
                    {row.debtor?.debtorName ?? "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {row.debtor?.caseRef ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.debtor?.country ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">{dur}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Link
                        to={`/calls/${row.id}`}
                        className={buttonVariants({
                          variant: "ghost",
                          size: "sm",
                          className: "text-xs",
                        })}
                      >
                        Transcript
                      </Link>
                      {row.debtorId ? (
                        <Link
                          to={`/debtors/${encodeURIComponent(row.debtorId)}`}
                          className={buttonVariants({
                            variant: "outline",
                            size: "sm",
                            className: "text-xs",
                          })}
                        >
                          Debtor
                        </Link>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {pageCount > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>
            Page {safePage + 1} of {pageCount}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                safePage <= 0 && "pointer-events-none opacity-50"
              )}
              disabled={safePage <= 0}
              onClick={() => setPage(safePage - 1)}
            >
              Previous
            </button>
            <button
              type="button"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                safePage >= pageCount - 1 && "pointer-events-none opacity-50"
              )}
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage(safePage + 1)}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

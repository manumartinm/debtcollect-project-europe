import * as React from "react"
import { useNavigate } from "react-router"

import { Badge } from "@workspace/ui/components/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { cn } from "@workspace/ui/lib/utils"
import { DebtorActions } from "@/components/debtor-actions"
import { LeverageBadge } from "@/components/leverage-badge"
import type { ApiDebtor } from "@/lib/api"
import { ENRICHMENT_STATUS_LABEL } from "@/lib/enrichment-labels"
import { parseDebtAmountString } from "@/lib/debtor-traces"
import type { CaseStatus, LeverageLevel } from "@/types/debtor"
import { caseStatusLabel } from "@/types/debtor"

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-EU", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n)
}

export type DebtorTableSortKey = "debtAmount" | "caseStatus" | "none"

const SELECT_CHECKBOX_CLASS =
  "size-4 shrink-0 cursor-pointer rounded border border-input accent-primary"

export type DebtorTableProps = {
  rows: ApiDebtor[]
  page: number
  pageSize: number
  sortKey: DebtorTableSortKey
  sortDir: "asc" | "desc"
  onSort: (k: DebtorTableSortKey) => void
  selection?: {
    selectedIds: Set<string>
    onToggle: (debtorId: string) => void
    onTogglePage: (ids: string[], select: boolean) => void
    pageIds: string[]
  }
}

export function DebtorTable({
  rows,
  page,
  pageSize,
  sortKey,
  sortDir,
  onSort,
  selection,
}: DebtorTableProps) {
  const navigate = useNavigate()
  const slice = rows.slice(page * pageSize, page * pageSize + pageSize)

  const headerCheckboxRef = React.useRef<HTMLInputElement>(null)
  const pageIds = selection?.pageIds ?? []
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selection?.selectedIds.has(id))
  const somePageSelected = pageIds.some((id) => selection?.selectedIds.has(id))

  React.useEffect(() => {
    const el = headerCheckboxRef.current
    if (!el) return
    el.indeterminate = somePageSelected && !allPageSelected
  }, [somePageSelected, allPageSelected])

  const headBtn = (k: DebtorTableSortKey, label: string) => (
    <button
      type="button"
      className="inline-flex items-center gap-1 font-medium hover:text-foreground"
      onClick={() => onSort(k)}
    >
      {label}
      {sortKey === k ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
    </button>
  )

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            {selection ? (
              <TableHead className="w-10 pr-0">
                <input
                  ref={headerCheckboxRef}
                  type="checkbox"
                  className={SELECT_CHECKBOX_CLASS}
                  checked={allPageSelected}
                  onChange={() =>
                    selection.onTogglePage(pageIds, !allPageSelected)
                  }
                  aria-label="Select all on this page"
                />
              </TableHead>
            ) : null}
            <TableHead className="font-mono text-xs">Case ref</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Country</TableHead>
            <TableHead>{headBtn("debtAmount", "Debt")}</TableHead>
            <TableHead>Call</TableHead>
            <TableHead>Legal</TableHead>
            <TableHead>{headBtn("caseStatus", "Status")}</TableHead>
            <TableHead>Leverage</TableHead>
            <TableHead>Enrichment</TableHead>
            <TableHead className="w-[132px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {slice.map((d, index) => {
            const isSelected = selection?.selectedIds.has(d.id) ?? false
            return (
              <TableRow
                key={d.id}
                data-state={isSelected ? "selected" : undefined}
                style={
                  {
                    "--vexor-stagger": `${index * 32}ms`,
                  } as React.CSSProperties
                }
                className="vexor-fade-up cursor-pointer"
                onClick={() => {
                  navigate(`/debtors/${encodeURIComponent(d.id)}`)
                }}
              >
                {selection ? (
                  <TableCell
                    className="w-10 pr-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      className={SELECT_CHECKBOX_CLASS}
                      checked={isSelected}
                      onChange={() => selection.onToggle(d.id)}
                      aria-label={`Select ${d.debtorName}`}
                    />
                  </TableCell>
                ) : null}
                <TableCell className="font-mono text-xs">{d.caseRef}</TableCell>
                <TableCell className="font-medium">{d.debtorName}</TableCell>
                <TableCell>{d.country}</TableCell>
                <TableCell>
                  {formatMoney(parseDebtAmountString(d.debtAmount))}
                </TableCell>
                <TableCell className="max-w-[8rem] truncate text-xs text-muted-foreground">
                  {d.callOutcome}
                </TableCell>
                <TableCell className="max-w-[8rem] truncate text-xs text-muted-foreground">
                  {d.legalOutcome}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-normal">
                    {caseStatusLabel(d.caseStatus)}
                  </Badge>
                </TableCell>
                <TableCell>
                  {d.enrichmentStatus === "not_started" ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    <LeverageBadge score={d.leverageScore as LeverageLevel} />
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className="font-normal text-xs"
                  >
                    {ENRICHMENT_STATUS_LABEL[
                      d.enrichmentStatus as keyof typeof ENRICHMENT_STATUS_LABEL
                    ] ?? d.enrichmentStatus}
                  </Badge>
                </TableCell>
                <TableCell
                  className="text-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  <DebtorActions debtor={d} />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

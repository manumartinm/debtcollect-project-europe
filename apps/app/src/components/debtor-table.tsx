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
import { LeverageBadge } from "@/components/leverage-badge"
import type { Debtor } from "@/data/mock"
import { CASE_STATUS_LABELS } from "@/data/mock"

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-EU", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n)
}

type SortKey = "debtAmount" | "caseStatus" | "none"

export function DebtorTable({
  rows,
  page,
  pageSize,
  sortKey,
  sortDir,
  onSort,
}: {
  rows: Debtor[]
  page: number
  pageSize: number
  sortKey: SortKey
  sortDir: "asc" | "desc"
  onSort: (k: SortKey) => void
}) {
  const navigate = useNavigate()
  const slice = rows.slice(page * pageSize, page * pageSize + pageSize)

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

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="font-mono text-xs">Case ID</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Country</TableHead>
            <TableHead>{headBtn("debtAmount", "Debt")}</TableHead>
            <TableHead>Call</TableHead>
            <TableHead>Legal</TableHead>
            <TableHead>{headBtn("caseStatus", "Status")}</TableHead>
            <TableHead>Leverage</TableHead>
            <TableHead>Enrichment</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {slice.map((d, index) => {
            return (
              <TableRow
                key={d.caseId}
                style={
                  {
                    "--vexor-stagger": `${index * 32}ms`,
                  } as React.CSSProperties
                }
                className="vexor-fade-up cursor-pointer"
                onClick={() => {
                  navigate(`/debtors/${encodeURIComponent(d.caseId)}`)
                }}
              >
                <TableCell className="font-mono text-xs">{d.caseId}</TableCell>
                <TableCell className="font-medium">{d.name}</TableCell>
                <TableCell>{d.country}</TableCell>
                <TableCell>{formatMoney(d.debtAmount)}</TableCell>
                <TableCell className="max-w-[8rem] truncate text-xs text-muted-foreground">
                  {d.callOutcome}
                </TableCell>
                <TableCell className="max-w-[8rem] truncate text-xs text-muted-foreground">
                  {d.legalOutcome}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-normal">
                    {CASE_STATUS_LABELS[d.caseStatus]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <LeverageBadge score={d.leverageScore} />
                </TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className="font-normal capitalize text-xs"
                  >
                    {d.enrichmentStatus}
                  </Badge>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

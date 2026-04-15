import * as React from "react"
import { useNavigate } from "react-router"

import { Badge } from "@workspace/ui/components/badge"
import { Card } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"

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

export function DebtorCardList({
  rows,
  page,
  pageSize,
}: {
  rows: Debtor[]
  page: number
  pageSize: number
}) {
  const navigate = useNavigate()
  const slice = rows.slice(page * pageSize, page * pageSize + pageSize)

  return (
    <ul className="space-y-3">
      {slice.map((d, index) => (
        <li key={d.caseId}>
          <Card
            role="button"
            tabIndex={0}
            style={
              {
                "--vexor-stagger": `${index * 40}ms`,
              } as React.CSSProperties
            }
            className={cn(
              "vexor-fade-up cursor-pointer border-transparent p-4 shadow-[var(--shadow-clay-sm)] ring-1 ring-black/[0.05] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-clay)] active:translate-y-0"
            )}
            onClick={() =>
              navigate(`/debtors/${encodeURIComponent(d.caseId)}`)
            }
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ")
                navigate(`/debtors/${encodeURIComponent(d.caseId)}`)
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{d.name}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {d.caseId} · {d.country}
                </p>
              </div>
              <p className="shrink-0 text-sm font-semibold tabular-nums">
                {formatMoney(d.debtAmount)}
              </p>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-normal">
                {CASE_STATUS_LABELS[d.caseStatus]}
              </Badge>
              <LeverageBadge score={d.leverageScore} />
            </div>
          </Card>
        </li>
      ))}
    </ul>
  )
}

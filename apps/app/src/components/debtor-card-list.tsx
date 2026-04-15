import * as React from "react"
import { useNavigate } from "react-router"

import { Badge } from "@workspace/ui/components/badge"
import { Card } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"

import { LeverageBadge } from "@/components/leverage-badge"
import type { ApiDebtor } from "@/lib/api"
import { ENRICHMENT_STATUS_LABEL } from "@/lib/enrichment-labels"
import { parseDebtAmountString } from "@/lib/debtor-traces"
import type { CaseStatus, LeverageLevel } from "@/types/debtor"
import { CASE_STATUS_LABELS } from "@/types/debtor"

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
  selection,
}: {
  rows: ApiDebtor[]
  page: number
  pageSize: number
  selection?: {
    selectedIds: Set<string>
    onToggle: (debtorId: string) => void
  }
}) {
  const navigate = useNavigate()
  const slice = rows.slice(page * pageSize, page * pageSize + pageSize)

  return (
    <ul className="space-y-3">
      {slice.map((d, index) => {
        const isSelected = selection?.selectedIds.has(d.id) ?? false
        return (
          <li key={d.id}>
            <Card
              role="button"
              tabIndex={0}
              style={
                {
                  "--vexor-stagger": `${index * 40}ms`,
                } as React.CSSProperties
              }
              className={cn(
                "vexor-fade-up cursor-pointer border-transparent p-4 shadow-[var(--shadow-clay-sm)] ring-1 ring-black/[0.05] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-clay)] active:translate-y-0",
                isSelected && "ring-2 ring-primary/30 bg-primary/[0.03]"
              )}
              onClick={() =>
                navigate(`/debtors/${encodeURIComponent(d.id)}`)
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ")
                  navigate(`/debtors/${encodeURIComponent(d.id)}`)
              }}
            >
              <div className="flex items-start gap-3">
                {selection ? (
                  <div
                    className="pt-0.5"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      className="size-4 cursor-pointer rounded border-input accent-primary"
                      checked={isSelected}
                      onChange={() => selection.onToggle(d.id)}
                      aria-label={`Select ${d.debtorName}`}
                    />
                  </div>
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{d.debtorName}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {d.caseRef} · {d.country}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold tabular-nums">
                      {formatMoney(parseDebtAmountString(d.debtAmount))}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="font-normal">
                      {CASE_STATUS_LABELS[d.caseStatus as CaseStatus]}
                    </Badge>
                    <Badge variant="secondary" className="font-normal text-xs">
                      {ENRICHMENT_STATUS_LABEL[
                        d.enrichmentStatus as keyof typeof ENRICHMENT_STATUS_LABEL
                      ] ?? d.enrichmentStatus}
                    </Badge>
                    {d.enrichmentStatus === "not_started" ? (
                      <span className="text-xs text-muted-foreground">Leverage —</span>
                    ) : (
                      <LeverageBadge score={d.leverageScore as LeverageLevel} />
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </li>
        )
      })}
    </ul>
  )
}

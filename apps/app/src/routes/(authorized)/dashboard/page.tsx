import * as React from "react"
import { Link, Navigate, useNavigate } from "react-router"
import { ArrowRight, Sparkles, Upload } from "lucide-react"

import { buttonVariants } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"
import { cn } from "@workspace/ui/lib/utils"

import { EmptyState } from "@/components/empty-state"
import { StatsCards } from "@/components/stats-cards"
import { useOrg } from "@/context/org-context"
import { useDebtorsList } from "@/hooks/use-debtors-queries"
import { parseDebtAmountString } from "@/lib/debtor-traces"
import { caseStatusLabel, type LeverageLevel } from "@/types/debtor"

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-EU", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n)
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { orgId, orgs, isLoading: orgLoading } = useOrg()
  const { data: debtors = [], isLoading, isError } = useDebtorsList(orgId ?? "")

  if (!orgLoading && orgs.length === 0) {
    return <Navigate to="/onboarding" replace />
  }

  if (orgLoading || isLoading) {
    return (
      <p className="text-sm text-muted-foreground">Loading dashboard…</p>
    )
  }

  if (isError) {
    return (
      <p className="text-sm text-destructive">Could not load portfolio data.</p>
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
          title="Upload your first portfolio"
          description="Import a CSV of cases. We will enrich each row with sourced public signals so you can call with leverage — not guesswork."
          actionLabel="Upload CSV"
          onAction={() => navigate("/upload")}
        />
      </div>
    )
  }

  const totalDebt = debtors.reduce(
    (a, d) => a + parseDebtAmountString(d.debtAmount),
    0
  )
  const inProgress = debtors.filter((d) =>
    ["new", "reviewing", "called", "negotiating"].includes(d.caseStatus)
  ).length

  const lev: Record<LeverageLevel, number> = {
    none: 0,
    low: 0,
    medium: 0,
    high: 0,
  }
  for (const d of debtors) {
    lev[d.leverageScore as LeverageLevel] += 1
  }

  const recent = debtors
    .flatMap((d) =>
      (d.statusEvents ?? []).map((e) => ({
        ...e,
        debtorId: d.id,
        name: d.debtorName,
      }))
    )
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 8)

  return (
    <div className="space-y-8">
      <div
        className="vexor-fade-up flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
        style={{ "--vexor-stagger": "0ms" } as React.CSSProperties}
      >
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Portfolio overview and recent collector activity.
          </p>
        </div>
        <Link
          to="/upload"
          className={cn(buttonVariants({ className: "gap-2 self-start" }))}
        >
          <Upload className="size-4" />
          Upload CSV
        </Link>
      </div>

      <StatsCards
        items={[
          { label: "Debtors", value: String(debtors.length) },
          {
            label: "Total exposure",
            value: formatMoney(totalDebt),
          },
          {
            label: "Recovery rate",
            value: "—",
            hint: "Connect analytics to populate",
          },
          { label: "In progress", value: String(inProgress) },
        ]}
      />

      <div
        className="vexor-fade-up grid gap-6 lg:grid-cols-2"
        style={{ "--vexor-stagger": "70ms" } as React.CSSProperties}
      >
        <Card className="border-border/80 shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Leverage distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(
              [
                ["none", "None"],
                ["low", "Low"],
                ["medium", "Medium"],
                ["high", "High"],
              ] as const
            ).map(([k, label]) => {
              const n = lev[k]
              const pct = debtors.length ? (n / debtors.length) * 100 : 0
              return (
                <div key={k} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium">{n}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary/70 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Status mix</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(
              debtors.reduce<Record<string, number>>((acc, d) => {
                acc[d.caseStatus] = (acc[d.caseStatus] ?? 0) + 1
                return acc
              }, {})
            )
              .sort((a, b) => b[1] - a[1])
              .slice(0, 6)
              .map(([status, n]) => {
                const pct = debtors.length ? (n / debtors.length) * 100 : 0
                return (
                  <div key={status} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">
                        {caseStatusLabel(status)}
                      </span>
                      <span className="font-medium">{n}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-foreground/20"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
          </CardContent>
        </Card>
      </div>

      <Card
        className="vexor-fade-up border-border/80 shadow-none"
        style={{ "--vexor-stagger": "130ms" } as React.CSSProperties}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Recent activity</CardTitle>
          <Link
            to="/debtors"
            className={cn(
              buttonVariants({
                variant: "ghost",
                size: "sm",
                className: "gap-1 text-muted-foreground",
              })
            )}
          >
            View all
            <ArrowRight className="size-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No status events yet.</p>
          ) : (
            <ul className="space-y-3">
              {recent.map((e) => (
                <li key={e.id} className="flex gap-3 text-sm">
                  <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p>
                      <Link
                        to={`/debtors/${encodeURIComponent(e.debtorId)}`}
                        className="font-medium text-foreground hover:underline"
                      >
                        {e.name}
                      </Link>{" "}
                      <span className="text-muted-foreground">—</span>{" "}
                      {caseStatusLabel(e.status)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(e.occurredAt).toLocaleString()} · {e.author}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Separator />

      <div
        className="vexor-fade-up rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center"
        style={{ "--vexor-stagger": "190ms" } as React.CSSProperties}
      >
        <p className="text-sm font-medium text-foreground">
          Workflow: Upload → Enrich → Act
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Every claim stays tied to a public source. Gaps are explicit.
        </p>
      </div>
    </div>
  )
}

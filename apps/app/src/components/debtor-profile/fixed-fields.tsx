import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"

import type { Debtor } from "@/data/mock"

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-EU", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n)
}

export function FixedFields({ debtor }: { debtor: Debtor }) {
  return (
    <Card className="border-border bg-card shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Case file</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs text-muted-foreground">Case ref</p>
          <p className="font-mono text-sm font-medium">{debtor.caseRef}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Country</p>
          <p className="text-sm font-medium">{debtor.country}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Debt amount</p>
          <p className="text-sm font-semibold tabular-nums">
            {formatMoney(debtor.debtAmount)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Name (portfolio)</p>
          <p className="text-sm font-medium">{debtor.name}</p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-xs text-muted-foreground">Call outcome (CSV)</p>
          <p className="text-sm text-foreground">{debtor.callOutcome}</p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-xs text-muted-foreground">Legal / asset report (CSV)</p>
          <p className="text-sm text-foreground">{debtor.legalOutcome}</p>
        </div>
      </CardContent>
    </Card>
  )
}

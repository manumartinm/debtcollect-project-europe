import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"

import type { ApiDebtor } from "@/lib/api"
import { parseDebtAmountString } from "@/lib/debtor-traces"

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-EU", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n)
}

export function FixedFields({ debtor }: { debtor: ApiDebtor }) {
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
            {formatMoney(parseDebtAmountString(debtor.debtAmount))}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Name (portfolio)</p>
          <p className="text-sm font-medium">{debtor.debtorName}</p>
        </div>
      </CardContent>
    </Card>
  )
}

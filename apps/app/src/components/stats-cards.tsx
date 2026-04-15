import * as React from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"

export function StatsCards({
  items,
}: {
  items: { label: string; value: string; hint?: string }[]
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item, index) => (
        <Card
          key={item.label}
          style={
            {
              "--vexor-stagger": `${index * 45}ms`,
            } as React.CSSProperties
          }
          className={cn(
            "vexor-fade-up border-transparent bg-card/80 transition-all duration-300 hover:-translate-y-px hover:bg-card"
          )}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
              {item.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">
              {item.value}
            </p>
            {item.hint ? (
              <p className="mt-1 text-xs text-muted-foreground">{item.hint}</p>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

import { LeverageBadge } from "@/components/leverage-badge"
import type { LeverageLevel } from "@/data/mock"
import { leverageExplanation } from "@/data/mock"

export function LeverageIndicator({ score }: { score: LeverageLevel }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Leverage
        </span>
        <LeverageBadge score={score} />
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {leverageExplanation(score)}
      </p>
    </div>
  )
}

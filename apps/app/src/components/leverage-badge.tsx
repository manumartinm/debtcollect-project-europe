import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import type { LeverageLevel } from "@/data/mock"

const styles: Record<
  LeverageLevel,
  { label: string; className: string }
> = {
  none: {
    label: "None",
    className:
      "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-100",
  },
  low: {
    label: "Low",
    className:
      "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-50",
  },
  medium: {
    label: "Medium",
    className:
      "border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-50",
  },
  high: {
    label: "High",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-50",
  },
}

export function LeverageBadge({
  score,
  className,
}: {
  score: LeverageLevel
  className?: string
}) {
  const s = styles[score]
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", s.className, className)}
    >
      {s.label}
    </Badge>
  )
}

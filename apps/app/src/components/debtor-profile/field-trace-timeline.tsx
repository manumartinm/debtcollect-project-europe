import {
  Search,
  ScanEye,
  GitCompareArrows,
  CheckCircle2,
  CircleDot,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  ShieldX,
} from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"

import type { ApiTraceStep } from "@/lib/api"

const ACTION_META: Record<
  string,
  { icon: typeof Search; color: string; label: string }
> = {
  search: {
    icon: Search,
    color: "text-blue-500 bg-blue-500/10 border-blue-500/20",
    label: "Search",
  },
  analyze: {
    icon: ScanEye,
    color: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    label: "Analyze",
  },
  "cross-reference": {
    icon: GitCompareArrows,
    color: "text-violet-500 bg-violet-500/10 border-violet-500/20",
    label: "Cross-reference",
  },
  verify: {
    icon: GitCompareArrows,
    color: "text-violet-500 bg-violet-500/10 border-violet-500/20",
    label: "Verify",
  },
  conclude: {
    icon: CheckCircle2,
    color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    label: "Conclude",
  },
}

const FALLBACK_META = {
  icon: CircleDot,
  color: "text-muted-foreground bg-muted/50 border-border",
  label: "Step",
}

const CONFIDENCE_META: Record<
  string,
  { icon: typeof ShieldCheck; color: string; label: string }
> = {
  high: {
    icon: ShieldCheck,
    color: "text-emerald-600 dark:text-emerald-400",
    label: "High confidence",
  },
  medium: {
    icon: ShieldAlert,
    color: "text-amber-600 dark:text-amber-400",
    label: "Medium confidence",
  },
  low: {
    icon: ShieldQuestion,
    color: "text-orange-600 dark:text-orange-400",
    label: "Low confidence",
  },
  none: {
    icon: ShieldX,
    color: "text-muted-foreground",
    label: "No confidence",
  },
}

function TimelineNode({
  step,
  isLast,
}: {
  step: ApiTraceStep
  isLast: boolean
}) {
  const actionKey = step.action.toLowerCase().replace(/\s+/g, "-")
  const meta = ACTION_META[actionKey] ?? FALLBACK_META
  const Icon = meta.icon
  const conf = CONFIDENCE_META[step.confidence] ?? CONFIDENCE_META.none
  const ConfIcon = conf.icon

  return (
    <div className="relative flex gap-3">
      {/* Vertical line */}
      {!isLast && (
        <div className="absolute top-8 bottom-0 left-[15px] w-px bg-border" />
      )}

      {/* Icon circle */}
      <div
        className={cn(
          "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border",
          meta.color,
        )}
      >
        <Icon className="size-3.5" strokeWidth={2} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 space-y-2 pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-foreground">
            {meta.label}
          </span>
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {step.agentName}
          </span>
          <div className={cn("flex items-center gap-0.5", conf.color)}>
            <ConfIcon className="size-3" strokeWidth={2} />
            <span className="text-[10px] font-medium">{conf.label}</span>
          </div>
        </div>

        <p className="text-[13px] leading-relaxed text-foreground">
          {step.reasoning}
        </p>

        {step.finding && (
          <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Finding
            </p>
            <p className="mt-0.5 text-[13px] text-foreground">
              {step.finding}
            </p>
          </div>
        )}

        {step.sources.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {step.sources.map((s) => (
              <a
                key={s.id}
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
              >
                <ExternalLink className="size-2.5 shrink-0" />
                <span className="max-w-32 truncate">{s.name}</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export type FieldTraceTimelineProps = {
  fieldLabel: string
  fieldValue: string
  steps: ApiTraceStep[]
}

export function FieldTraceTimeline({
  fieldLabel,
  fieldValue,
  steps,
}: FieldTraceTimelineProps) {
  const sorted = [...steps].sort((a, b) => a.stepNumber - b.stepNumber)

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {fieldLabel}
        </p>
        <p className="text-sm font-medium text-foreground">{fieldValue}</p>
        <p className="text-[11px] text-muted-foreground">
          {sorted.length} step{sorted.length !== 1 ? "s" : ""} in reasoning
          chain
        </p>
      </div>

      <div>
        {sorted.map((step, i) => (
          <TimelineNode
            key={step.id}
            step={step}
            isLast={i === sorted.length - 1}
          />
        ))}
      </div>
    </div>
  )
}

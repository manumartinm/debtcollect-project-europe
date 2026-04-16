import {
  FileText,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  Quote,
} from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"

import type { ApiTraceStep } from "@/lib/api"

const CONFIDENCE_META: Record<
  string,
  { icon: typeof ShieldCheck; color: string; bg: string; label: string }
> = {
  high: {
    icon: ShieldCheck,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    label: "High",
  },
  medium: {
    icon: ShieldAlert,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
    label: "Medium",
  },
  low: {
    icon: ShieldQuestion,
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-500/10 border-orange-500/20",
    label: "Low",
  },
  none: {
    icon: ShieldQuestion,
    color: "text-muted-foreground",
    bg: "bg-muted/50 border-border",
    label: "None",
  },
}

function prettyCitationLabel(url: string): string {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, "")
    if (host.includes("apify.com")) return "Apify run"
    if (host.includes("courtlistener.com")) return "CourtListener"
    if (host.includes("linkedin.com")) return "LinkedIn"
    if (host.includes("instagram.com")) return "Instagram"
    if (host.includes("twitter.com") || host.includes("x.com")) return "X / Twitter"
    if (host.includes("google.com")) return "Google"
    return host
  } catch {
    return url.slice(0, 30)
  }
}

function ClaimCard({
  step,
  index,
  isLast,
}: {
  step: ApiTraceStep
  index: number
  isLast: boolean
}) {
  const claim = step.claimContent ?? step.reasoning
  const citations = step.linkedCitations?.length
    ? step.linkedCitations
    : step.sources.map((s) => s.url)
  const confKey = (step.claimConfidence || step.confidence || "none").toLowerCase()
  const conf = CONFIDENCE_META[confKey] ?? CONFIDENCE_META.none
  const ConfIcon = conf.icon

  return (
    <div className="relative flex gap-3">
      {!isLast && (
        <div className="absolute top-8 bottom-0 left-[15px] w-px bg-border" />
      )}

      <div
        className={cn(
          "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border",
          conf.bg,
          conf.color,
        )}
      >
        <span className="text-xs font-bold">{index + 1}</span>
      </div>

      <div className="min-w-0 flex-1 space-y-2.5 pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className={cn("flex items-center gap-1", conf.color)}>
            <ConfIcon className="size-3.5" strokeWidth={2} />
            <span className="text-[11px] font-semibold">{conf.label} confidence</span>
          </div>
        </div>

        <div className="relative rounded-lg border border-border bg-muted/30 px-3.5 py-2.5">
          <Quote className="absolute top-2 left-2 size-3 text-muted-foreground/30" />
          <p className="pl-3 text-[13px] leading-relaxed text-foreground">
            {claim}
          </p>
        </div>

        {citations.length > 0 && (
          <div className="space-y-1">
            <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              <FileText className="size-3" />
              Citations ({citations.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {citations.map((url, i) => (
                <a
                  key={`${url}-${i}`}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
                >
                  <ExternalLink className="size-2.5 shrink-0" />
                  <span className="max-w-40 truncate">
                    {prettyCitationLabel(url)}
                  </span>
                </a>
              ))}
            </div>
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
  const hasClaims = sorted.some((s) => s.claimContent || s.linkedCitations?.length)

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {fieldLabel}
        </p>
        <p className="text-sm font-medium text-foreground">{fieldValue}</p>
        <p className="text-[11px] text-muted-foreground">
          {sorted.length} evidence claim{sorted.length !== 1 ? "s" : ""}
          {hasClaims ? " with linked citations" : ""}
        </p>
      </div>

      <div>
        {sorted.map((step, i) => (
          <ClaimCard
            key={step.id}
            step={step}
            index={i}
            isLast={i === sorted.length - 1}
          />
        ))}
      </div>
    </div>
  )
}

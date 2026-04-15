import { Sparkles } from "lucide-react"

import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"

import type { ApiDebtor, ApiTraceStep } from "@/lib/api"
import type { EnrichmentStatus } from "@/types/debtor"

const FIELDS: { api: string; label: string }[] = [
  { api: "phone", label: "Phone" },
  { api: "address", label: "Address" },
  { api: "employer", label: "Employer" },
  { api: "income_bracket", label: "Income bracket" },
  { api: "assets", label: "Assets (public sweep)" },
  { api: "social_media_hints", label: "Social / open web" },
]

function fieldValue(debtor: ApiDebtor, api: string): string {
  const v = debtor.enrichedFields.find((f) => f.fieldName === api)?.value
  if (v === undefined || v === null || v === "") return "Not found"
  return String(v)
}

function traceForField(
  debtor: ApiDebtor,
  api: string
): ApiTraceStep | undefined {
  const ef = debtor.enrichedFields.find((f) => f.fieldName === api)
  const steps = ef?.traceSteps ?? []
  if (steps.length === 0) return undefined
  return steps[steps.length - 1]
}

function EnrichedFieldBlock({
  label,
  value,
  trace,
  onOpenTrace,
}: {
  label: string
  value: string
  trace?: ApiTraceStep
  onOpenTrace?: (step: ApiTraceStep) => void
}) {
  const muted = value === "Not found" || value === "Unknown"

  return (
    <div className="relative rounded-xl border border-border bg-card px-4 py-3 pr-12">
      {trace && onOpenTrace ? (
        <button
          type="button"
          aria-label="Open agent trace for this field"
          title="Open agent trace"
          className="absolute top-2 right-2 inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
          onClick={() => onOpenTrace(trace)}
        >
          <Sparkles className="size-4" strokeWidth={1.75} />
        </button>
      ) : null}
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 pr-1 text-sm",
          muted ? "text-muted-foreground" : "text-foreground"
        )}
      >
        {value}
      </p>
    </div>
  )
}

export function DynamicFields({
  debtor,
  onOpenTrace,
}: {
  debtor: ApiDebtor
  onOpenTrace?: (step: ApiTraceStep) => void
}) {
  const st = debtor.enrichmentStatus as EnrichmentStatus
  const loading = st === "pending" || st === "running"

  if (loading) {
    return (
      <section className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Enrichment</h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {st === "running"
              ? "Enrichment is running on the server."
              : "Waiting for enrichment — processing may be automatic or queued."}
          </p>
        </div>
        <div className="space-y-3 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {FIELDS.map(({ label }) => (
              <div key={label} className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (st === "failed") {
    return (
      <section className="rounded-xl border border-destructive/30 bg-card px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Enrichment</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Last enrichment run failed. Retry from your backend or support tools.
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Enriched signals</h2>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          Sparkle icon opens the agent trace for that field when available.
        </p>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2">
        {FIELDS.map(({ api, label }) => (
          <EnrichedFieldBlock
            key={api}
            label={label}
            value={fieldValue(debtor, api)}
            trace={traceForField(debtor, api)}
            onOpenTrace={onOpenTrace}
          />
        ))}
      </div>
    </section>
  )
}

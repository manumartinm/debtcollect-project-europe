import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"

import type { AiTraceStep, Debtor, EnrichedFields } from "@/data/mock"
import { traceForEnrichedField } from "@/data/mock"

const FIELD_LIST: { key: keyof EnrichedFields; label: string }[] = [
  { key: "phone", label: "Phone" },
  { key: "address", label: "Address" },
  { key: "employer", label: "Employer" },
  { key: "incomeBracket", label: "Income bracket" },
  { key: "assets", label: "Assets (public sweep)" },
  { key: "socialMediaHints", label: "Social / open web" },
]

function formatFieldValue(key: keyof EnrichedFields, e: EnrichedFields): string {
  const v = e[key]
  if (v === undefined || v === null) return "Not found"
  return String(v)
}

function EnrichedFieldBlock({
  label,
  value,
  trace,
  onOpenTrace,
}: {
  label: string
  value: string
  trace?: AiTraceStep
  onOpenTrace?: (step: AiTraceStep) => void
}) {
  const muted = value === "Not found" || value === "Unknown"

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-sm",
          muted ? "text-muted-foreground" : "text-foreground"
        )}
      >
        {value}
      </p>
      {trace && onOpenTrace ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3 h-8 w-full border-primary/20 text-xs text-primary hover:bg-primary/5"
          onClick={() => onOpenTrace(trace)}
        >
          View agent trace
        </Button>
      ) : null}
    </div>
  )
}

export function DynamicFields({
  debtor,
  onRunEnrichment,
  running,
  onOpenTrace,
}: {
  debtor: Debtor
  onRunEnrichment: () => void
  running: boolean
  onOpenTrace?: (step: AiTraceStep) => void
}) {
  const loading =
    debtor.enrichmentStatus === "pending" ||
    debtor.enrichmentStatus === "running" ||
    running

  if (loading) {
    return (
      <section className="rounded-xl border border-border bg-card">
        <div className="flex flex-row flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Enrichment</h2>
          <Button
            type="button"
            size="sm"
            disabled={running || debtor.enrichmentStatus === "running"}
            onClick={onRunEnrichment}
          >
            {running || debtor.enrichmentStatus === "running"
              ? "Enriching…"
              : "Run enrichment"}
          </Button>
        </div>
        <div className="space-y-3 p-4">
          <p className="text-sm text-muted-foreground">
            Run enrichment to populate fields and attach an agent trace to each signal.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {FIELD_LIST.map(({ label }) => (
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

  const e = debtor.enriched ?? {}
  const traces = debtor.traces

  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Enriched signals</h2>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          Opens the trace detail in a side panel (same as the timeline).
        </p>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2">
        {FIELD_LIST.map(({ key, label }) => (
          <EnrichedFieldBlock
            key={key}
            label={label}
            value={formatFieldValue(key, e)}
            trace={traceForEnrichedField(traces, key)}
            onOpenTrace={onOpenTrace}
          />
        ))}
      </div>
    </section>
  )
}

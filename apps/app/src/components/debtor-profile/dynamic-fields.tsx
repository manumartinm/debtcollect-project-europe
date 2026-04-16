import { Bot } from "lucide-react"

import { Skeleton } from "@workspace/ui/components/skeleton"
import { Tooltip, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { TooltipRich } from "@/components/tooltip-rich"
import { cn } from "@workspace/ui/lib/utils"

import type { ApiDebtor, ApiEnrichedField } from "@/lib/api"
import type { EnrichmentStatus } from "@/types/debtor"

const FIELDS: { api: string; label: string }[] = [
  { api: "phone", label: "Phone" },
  { api: "address", label: "Address" },
  { api: "email", label: "Email" },
  { api: "date_of_birth", label: "Date of birth" },
  { api: "employer", label: "Employer" },
  { api: "income_bracket", label: "Income bracket" },
  { api: "assets", label: "Assets" },
  { api: "property_ownership", label: "Property ownership" },
  { api: "bankruptcy_status", label: "Bankruptcy status" },
  { api: "litigation_history", label: "Litigation history" },
  { api: "business_affiliations", label: "Business affiliations" },
  { api: "relatives_associates", label: "Relatives / associates" },
  { api: "social_media_hints", label: "Social / open web" },
  { api: "tax_id", label: "Tax ID" },
]

export type FieldTracePayload = {
  fieldLabel: string
  fieldValue: string
  field: ApiEnrichedField
}

function fieldValue(debtor: ApiDebtor, api: string): string {
  const v = debtor.enrichedFields.find((f) => f.fieldName === api)?.value
  if (v === undefined || v === null || v === "") return "Not found"
  return String(v)
}

function enrichedField(
  debtor: ApiDebtor,
  api: string,
): ApiEnrichedField | undefined {
  return debtor.enrichedFields.find((f) => f.fieldName === api)
}

function EnrichedFieldBlock({
  label,
  value,
  field,
  onOpenTrace,
}: {
  label: string
  value: string
  field?: ApiEnrichedField
  onOpenTrace?: (payload: FieldTracePayload) => void
}) {
  const muted = value === "Not found" || value === "Unknown"
  const hasTrace = field && field.traceSteps.length > 0
  const stepCount = field?.traceSteps.length ?? 0

  return (
    <div className="relative rounded-xl border border-border bg-card px-4 py-3 pr-12">
      {hasTrace && onOpenTrace ? (
        <Tooltip>
          <TooltipTrigger
            type="button"
            aria-label={`Open reasoning trace (${stepCount} steps)`}
            className="absolute top-2 right-2 inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
            onClick={() =>
              onOpenTrace({ fieldLabel: label, fieldValue: value, field: field! })
            }
          >
            <Bot className="size-4" strokeWidth={1.75} />
            {stepCount > 1 && (
              <span className="absolute -top-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
                {stepCount}
              </span>
            )}
            <span className="sr-only">Open reasoning trace</span>
          </TooltipTrigger>
          <TooltipRich side="left" title="AI reasoning trace" className="max-w-[220px]">
            See the {stepCount}-step reasoning chain: how this value was
            searched, analyzed, cross-referenced, and concluded.
          </TooltipRich>
        </Tooltip>
      ) : null}
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 pr-1 text-sm",
          muted ? "text-muted-foreground" : "text-foreground",
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
  onOpenTrace?: (payload: FieldTracePayload) => void
}) {
  const st = debtor.enrichmentStatus as EnrichmentStatus
  const hasStoredFields = debtor.enrichedFields.length > 0

  if ((st === "not_started" || st === "pending") && !hasStoredFields) {
    return (
      <section className="rounded-xl border border-dashed border-border bg-card/50 px-4 py-6 text-center">
        <p className="text-sm text-muted-foreground">
          Enriched signals appear after you run enrichment for this case.
        </p>
      </section>
    )
  }

  const loading = st === "running"

  if (loading) {
    return (
      <section className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Enrichment</h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Enrichment is running on the server.
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

  const signalsGrid = (
    <div className="grid gap-3 p-4 sm:grid-cols-2">
      {FIELDS.map(({ api, label }) => (
        <EnrichedFieldBlock
          key={api}
          label={label}
          value={fieldValue(debtor, api)}
          field={enrichedField(debtor, api)}
          onOpenTrace={onOpenTrace}
        />
      ))}
    </div>
  )

  if (st === "failed") {
    const err = debtor.enrichmentError?.trim()
    return (
      <div className="space-y-4">
        <section className="rounded-xl border border-destructive/30 bg-card px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Enrichment</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Last enrichment run failed. Use{" "}
            <span className="font-medium text-foreground">Run enrichment</span>{" "}
            on this case to retry.
          </p>
          {err ? (
            <pre className="mt-3 max-h-40 overflow-auto rounded-md border border-border bg-muted/40 px-3 py-2 text-left font-mono text-[11px] leading-relaxed text-foreground/90 whitespace-pre-wrap wrap-break-word">
              {err}
            </pre>
          ) : null}
        </section>
        <section className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">
              Enriched signals
            </h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Values already stored for this case (previous successful steps or
              manual edits).
            </p>
          </div>
          {signalsGrid}
        </section>
      </div>
    )
  }

  const headerNote =
    st === "not_started" || st === "pending"
      ? "Stored enrichment data for this case — run enrichment again to refresh."
      : "Click the bot icon on any field to see the full AI reasoning trace."

  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">
          Enriched signals
        </h2>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          {headerNote}
        </p>
      </div>
      {signalsGrid}
    </section>
  )
}

import * as React from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router"
import { toast } from "sonner"

import { Badge } from "@workspace/ui/components/badge"
import { buttonVariants } from "@workspace/ui/components/button"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { cn } from "@workspace/ui/lib/utils"

import { DebtorActions } from "@/components/debtor-actions"
import { DebtorEditSheet } from "@/components/debtor-edit-sheet"
import { CallInsights } from "@/components/debtor-profile/call-insights"
import { DebtorCallsSection } from "@/components/debtor-profile/debtor-calls"
import { DynamicFields, type FieldTracePayload } from "@/components/debtor-profile/dynamic-fields"
import { FieldTraceTimeline } from "@/components/debtor-profile/field-trace-timeline"
import { FixedFields } from "@/components/debtor-profile/fixed-fields"
import { LeverageIndicator } from "@/components/debtor-profile/leverage-indicator"
import { StatusTimeline } from "@/components/debtor-profile/status-timeline"
import type { ApiDebtor } from "@/lib/api"
import { useSession } from "@/lib/auth-client"
import { parseDebtAmountString } from "@/lib/debtor-traces"
import { useDebtorEnrichmentRealtime } from "@/hooks/use-debtor-enrichment-realtime"
import {
  useDebtor,
  useEnrichedFields,
  useSetDebtorStatus,
} from "@/hooks/use-debtors-queries"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { ArrowLeft } from "lucide-react"
import type { CaseStatus, EnrichmentStatus, LeverageLevel } from "@/types/debtor"
import { caseStatusLabel } from "@/types/debtor"

const ENRICH_LABELS: Record<EnrichmentStatus, string> = {
  not_started: "Not started",
  pending: "Pending",
  running: "Running",
  complete: "Complete",
  failed: "Failed",
}

function formatDebtEur(n: number) {
  return new Intl.NumberFormat("en-EU", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n)
}

const leadTabTriggerClass =
  "h-auto rounded-none border-0 bg-transparent px-2 py-1.5 text-[11px] font-medium text-muted-foreground shadow-none data-active:bg-transparent data-active:text-foreground data-active:shadow-none sm:px-3 sm:text-xs"

export default function DebtorProfilePage() {
  const { debtorId: raw } = useParams()
  const debtorIdParam = raw ? decodeURIComponent(raw) : ""
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: session } = useSession()
  const author = session?.user?.name ?? "Collector"

  /** Set when POST /enrich returns `runId` + `publicAccessToken` — enables Trigger.dev Realtime instead of polling. */
  const [enrichmentRealtime, setEnrichmentRealtime] = React.useState<{
    runId: string
    publicAccessToken: string
  } | null>(null)

  const skipRunningPoll = !!(
    enrichmentRealtime?.runId && enrichmentRealtime.publicAccessToken
  )

  const { data: debtor, isLoading, isError, error } = useDebtor(debtorIdParam, {
    skipRunningPoll,
  })
  const { data: enrichedFieldsByDebtorId } = useEnrichedFields(debtorIdParam, {
    skipRunningPoll,
  })
  const setStatusMutation = useSetDebtorStatus()

  useDebtorEnrichmentRealtime({
    debtorId: debtorIdParam,
    runId: enrichmentRealtime?.runId ?? null,
    publicAccessToken: enrichmentRealtime?.publicAccessToken ?? null,
    enabled:
      !!debtorIdParam &&
      !!enrichmentRealtime?.runId &&
      !!enrichmentRealtime?.publicAccessToken,
    onRunSettled: () => setEnrichmentRealtime(null),
  })

  React.useEffect(() => {
    if (debtor?.enrichmentStatus !== "running") setEnrichmentRealtime(null)
  }, [debtor?.enrichmentStatus])

  const [tracePayload, setTracePayload] =
    React.useState<FieldTracePayload | null>(null)
  const [editOpen, setEditOpen] = React.useState(false)

  React.useEffect(() => {
    if (searchParams.get("edit") !== "1") return
    setEditOpen(true)
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        p.delete("edit")
        return p
      },
      { replace: true }
    )
  }, [searchParams, setSearchParams])

  const openTraceDetail = React.useCallback((payload: FieldTracePayload) => {
    setTracePayload(payload)
  }, [])

  const handleStatusChange = React.useCallback(
    (status: CaseStatus, note: string) => {
      if (!debtor) return
      setStatusMutation.mutate(
        {
          id: debtor.id,
          status,
          note: note || undefined,
          author,
        },
        {
          onSuccess: () => toast.success("Status updated."),
          onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
        }
      )
    },
    [debtor, author, setStatusMutation]
  )

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (tracePayload) {
          setTracePayload(null)
          return
        }
        navigate("/debtors")
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [navigate, tracePayload])

  /** Prefer `GET /debtors/:id/enriched-fields` when loaded — detail payload can omit nested rows in some cases. Must run before any early return (Rules of Hooks). */
  const displayDebtor = React.useMemo((): ApiDebtor | null => {
    if (!debtor) return null
    const merged =
      enrichedFieldsByDebtorId !== undefined
        ? enrichedFieldsByDebtorId
        : debtor.enrichedFields
    return { ...debtor, enrichedFields: merged }
  }, [debtor, enrichedFieldsByDebtorId])

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4 pt-1 text-center text-muted-foreground">
        Loading case…
      </div>
    )
  }

  if (isError || !debtor || !displayDebtor) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4 pt-1 text-center">
        <p className="text-muted-foreground">
          {isError
            ? (error as Error)?.message ?? "Could not load case."
            : "Case not found."}
        </p>
        <Link
          to="/debtors"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Back to debtors
        </Link>
      </div>
    )
  }

  const lev = displayDebtor.leverageScore as LeverageLevel
  const enrichSt = displayDebtor.enrichmentStatus as EnrichmentStatus
  /** Show tabs (incl. enriched signals) whenever there is stored enrichment data, even if status is still not_started/pending (e.g. import or out-of-sync). */
  const isMinimalProfile =
    (enrichSt === "not_started" || enrichSt === "pending") &&
    displayDebtor.enrichedFields.length === 0

  const fieldsColumn = (
    <div className="space-y-6">
      <FixedFields debtor={displayDebtor} />
      <DynamicFields debtor={displayDebtor} onOpenTrace={openTraceDetail} />
      <StatusTimeline debtor={displayDebtor} onStatusChange={handleStatusChange} />
    </div>
  )

  const insightsColumn = (
    <div className="space-y-6">
      <LeverageIndicator score={lev} />
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground">
          Insights & key points
        </h2>
        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
          What to follow on the call — posture, facts, and compliance anchors.
          Not legal advice.
        </p>
        <div className="mt-5">
          <CallInsights debtor={displayDebtor} />
        </div>
      </div>
    </div>
  )

  const callsColumn = (
    <DebtorCallsSection
      debtorId={displayDebtor.id}
      orgId={displayDebtor.orgId}
      debtorName={displayDebtor.debtorName}
    />
  )

  const leadTabs = (
    <Tabs defaultValue="insights" className="w-full min-w-0">
      <TabsList
        variant="line"
        className="mb-0 h-auto w-full min-w-0 justify-start gap-4 border-b border-border bg-transparent p-0 shadow-none"
      >
        <TabsTrigger
          value="insights"
          className={cn(leadTabTriggerClass, "data-active:font-semibold")}
        >
          Insights
        </TabsTrigger>
        <TabsTrigger value="fields" className={leadTabTriggerClass}>
          Fields
        </TabsTrigger>
        <TabsTrigger value="calls" className={leadTabTriggerClass}>
          Calls
        </TabsTrigger>
      </TabsList>
      <TabsContent value="insights" className="mt-5 min-w-0 outline-none">
        {insightsColumn}
      </TabsContent>
      <TabsContent value="fields" className="mt-5 min-w-0 outline-none">
        {fieldsColumn}
      </TabsContent>
      <TabsContent value="calls" className="mt-5 min-w-0 outline-none">
        {callsColumn}
      </TabsContent>
    </Tabs>
  )

  const minimalBody = (
    <div className="space-y-6">
      <FixedFields debtor={displayDebtor} />
      <StatusTimeline debtor={displayDebtor} onStatusChange={handleStatusChange} />
      <DebtorCallsSection
        debtorId={displayDebtor.id}
        orgId={displayDebtor.orgId}
        debtorName={displayDebtor.debtorName}
      />
      <p className="text-sm leading-relaxed text-muted-foreground">
        Enrichment is off until you run it. You can still update case status and
        notes above. Start enrichment to load signals, leverage, and call
        insights.
      </p>
    </div>
  )

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl space-y-6 pt-1 pb-24 lg:pb-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <Link
            to="/debtors"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "h-8 gap-1 px-0 text-muted-foreground"
            )}
          >
            <ArrowLeft className="size-4" />
            Debtors
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {displayDebtor.debtorName}
          </h1>
          <p className="font-mono text-xs text-muted-foreground">
            {displayDebtor.caseRef}
          </p>
          <dl className="mt-3 grid max-w-full grid-cols-2 gap-x-4 gap-y-2 border-b border-border pb-4 sm:grid-cols-4 lg:flex lg:flex-wrap lg:gap-x-8 lg:gap-y-2">
            <div className="min-w-0">
              <dt className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                Debt
              </dt>
              <dd className="mt-0.5 text-sm font-semibold text-foreground tabular-nums">
                {formatDebtEur(parseDebtAmountString(displayDebtor.debtAmount))}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                Country
              </dt>
              <dd className="mt-0.5 text-sm font-medium text-foreground">
                {displayDebtor.country}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                Case status
              </dt>
              <dd className="mt-0.5">
                <Badge variant="secondary" className="text-[11px] font-normal">
                  {caseStatusLabel(displayDebtor.caseStatus)}
                </Badge>
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                Enrichment
              </dt>
              <dd className="mt-0.5">
                <Badge variant="outline" className="text-[11px] font-normal">
                  {ENRICH_LABELS[enrichSt]}
                </Badge>
              </dd>
            </div>
          </dl>
        </div>
        <DebtorActions
          debtor={displayDebtor}
          className="shrink-0 self-start pt-0.5"
          onEdit={() => setEditOpen(true)}
          onDeleted={() => navigate("/debtors")}
          onEnrichRealtime={({ runId, publicAccessToken }) =>
            setEnrichmentRealtime({ runId, publicAccessToken })
          }
        />
      </div>

      <div className="w-full min-w-0">
        {isMinimalProfile ? minimalBody : leadTabs}
      </div>

      <DebtorEditSheet
        debtor={displayDebtor}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <Sheet
        open={tracePayload !== null}
        onOpenChange={(open) => {
          if (!open) setTracePayload(null)
        }}
      >
        <SheetContent
          side="right"
          showCloseButton
          className="w-full gap-0 overflow-y-auto border-border p-0 sm:max-w-lg"
        >
          {tracePayload ? (
            <>
              <SheetHeader className="border-b border-border px-6 py-4 text-left">
                <SheetTitle className="text-base leading-snug font-semibold">
                  Enrichment detail
                </SheetTitle>
              </SheetHeader>
              <div className="space-y-6 px-6 py-5">
                <div className="space-y-1">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Field
                  </p>
                  <p className="text-sm font-medium text-foreground">
                    {tracePayload.fieldLabel}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {tracePayload.field.fieldName}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Value
                  </p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    {tracePayload.fieldValue}
                  </p>
                </div>
                <div className="space-y-2 border-t border-border pt-5">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Reasoning trace
                  </p>
                  <FieldTraceTimeline
                    fieldLabel={tracePayload.fieldLabel}
                    fieldValue={tracePayload.fieldValue}
                    steps={tracePayload.field.traceSteps ?? []}
                    showFieldSummary={false}
                  />
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}

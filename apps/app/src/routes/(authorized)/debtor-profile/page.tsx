import * as React from "react"
import { Link, useNavigate, useParams } from "react-router"
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

import { AgentTimeline } from "@/components/debtor-profile/agent-timeline"
import { CallInsights } from "@/components/debtor-profile/call-insights"
import { DynamicFields } from "@/components/debtor-profile/dynamic-fields"
import { TraceStepDetail } from "@/components/debtor-profile/trace-step-detail"
import { FixedFields } from "@/components/debtor-profile/fixed-fields"
import { LeverageIndicator } from "@/components/debtor-profile/leverage-indicator"
import { StatusTimeline } from "@/components/debtor-profile/status-timeline"
import type { ApiTraceStep } from "@/lib/api"
import { useSession } from "@/lib/auth-client"
import { flattenTraceSteps, parseDebtAmountString } from "@/lib/debtor-traces"
import { useDebtor, useSetDebtorStatus } from "@/hooks/use-debtors-queries"
import { useMinLg } from "@/hooks/use-media"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { ArrowLeft } from "lucide-react"
import type { CaseStatus, EnrichmentStatus, LeverageLevel } from "@/types/debtor"
import { CASE_STATUS_LABELS } from "@/types/debtor"

const ENRICH_LABELS: Record<EnrichmentStatus, string> = {
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
  "h-auto rounded-none border-0 bg-transparent px-2 py-1.5 text-[11px] font-medium text-muted-foreground shadow-none data-active:bg-transparent data-active:text-foreground data-active:shadow-none dark:data-active:bg-transparent sm:px-3 sm:text-xs"

export default function DebtorProfilePage() {
  const { debtorId: raw } = useParams()
  const debtorIdParam = raw ? decodeURIComponent(raw) : ""
  const navigate = useNavigate()
  const lg = useMinLg()
  const { data: session } = useSession()
  const author = session?.user?.name ?? "Collector"

  const { data: debtor, isLoading, isError, error } = useDebtor(debtorIdParam)
  const setStatusMutation = useSetDebtorStatus()

  const [traceSheetStep, setTraceSheetStep] =
    React.useState<ApiTraceStep | null>(null)

  const openTraceDetail = React.useCallback((step: ApiTraceStep) => {
    setTraceSheetStep(step)
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
        if (traceSheetStep) {
          setTraceSheetStep(null)
          return
        }
        navigate("/debtors")
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [navigate, traceSheetStep])

  if (isLoading) {
    return (
      <div className="space-y-4 text-center text-muted-foreground">
        Loading case…
      </div>
    )
  }

  if (isError || !debtor) {
    return (
      <div className="space-y-4 text-center">
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

  const traces = flattenTraceSteps(debtor)
  const lev = debtor.leverageScore as LeverageLevel
  const enrichSt = debtor.enrichmentStatus as EnrichmentStatus

  const tracePanel = (
    <AgentTimeline
      steps={traces}
      emptyMessage={
        enrichSt === "pending"
          ? "No enrichment data yet — traces appear when enrichment completes."
          : undefined
      }
      onOpenStep={openTraceDetail}
    />
  )

  const traceSidebar = (
    <aside className="min-w-0 rounded-xl border border-border bg-card p-4 lg:border-0 lg:bg-transparent lg:p-0">
      <div className="sticky top-20 space-y-3">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          AI agent trace
        </h2>
        <p className="hidden text-[11px] leading-snug text-muted-foreground lg:block">
          Pipeline steps. Use{" "}
          <span className="font-medium">Open trace details</span> or field
          sparkles for the full step.
        </p>
        {tracePanel}
      </div>
    </aside>
  )

  const fieldsColumn = (
    <div className="space-y-6">
      <FixedFields debtor={debtor} />
      <DynamicFields debtor={debtor} onOpenTrace={openTraceDetail} />
      <StatusTimeline debtor={debtor} onStatusChange={handleStatusChange} />
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
          <CallInsights debtor={debtor} />
        </div>
      </div>
    </div>
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
      </TabsList>
      <TabsContent value="insights" className="mt-5 min-w-0 outline-none">
        {insightsColumn}
      </TabsContent>
      <TabsContent value="fields" className="mt-5 min-w-0 outline-none">
        {fieldsColumn}
      </TabsContent>
    </Tabs>
  )

  return (
    <div className="w-full min-w-0 space-y-6 pt-1 pb-24 lg:pb-8">
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
            {debtor.debtorName}
          </h1>
          <p className="font-mono text-xs text-muted-foreground">
            {debtor.caseRef}
          </p>
          <dl className="mt-3 grid max-w-full grid-cols-2 gap-x-4 gap-y-2 border-b border-border pb-4 sm:grid-cols-4 lg:flex lg:flex-wrap lg:gap-x-8 lg:gap-y-2">
            <div className="min-w-0">
              <dt className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                Debt
              </dt>
              <dd className="mt-0.5 text-sm font-semibold text-foreground tabular-nums">
                {formatDebtEur(parseDebtAmountString(debtor.debtAmount))}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                Country
              </dt>
              <dd className="mt-0.5 text-sm font-medium text-foreground">
                {debtor.country}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                Case status
              </dt>
              <dd className="mt-0.5">
                <Badge variant="secondary" className="text-[11px] font-normal">
                  {CASE_STATUS_LABELS[debtor.caseStatus as CaseStatus]}
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
      </div>

      {!lg ? (
        <Tabs defaultValue="insights" className="w-full min-w-0">
          <TabsList
            variant="line"
            className="mb-0 h-auto w-full min-w-0 justify-start gap-2 border-b border-border bg-transparent p-0 shadow-none sm:gap-5"
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
            <TabsTrigger value="trace" className={leadTabTriggerClass}>
              Trace
            </TabsTrigger>
          </TabsList>
          <TabsContent value="insights" className="mt-4 min-w-0">
            {insightsColumn}
          </TabsContent>
          <TabsContent value="fields" className="mt-4 min-w-0">
            {fieldsColumn}
          </TabsContent>
          <TabsContent value="trace" className="mt-4 min-w-0">
            {traceSidebar}
          </TabsContent>
        </Tabs>
      ) : (
        <div className="grid w-full min-w-0 gap-8 lg:grid-cols-5 lg:gap-10">
          <div className="min-w-0 space-y-0 lg:col-span-3">{leadTabs}</div>
          <div className="min-w-0 lg:col-span-2">{traceSidebar}</div>
        </div>
      )}

      <Sheet
        open={traceSheetStep !== null}
        onOpenChange={(open) => {
          if (!open) setTraceSheetStep(null)
        }}
      >
        <SheetContent
          side="right"
          showCloseButton
          className="w-full gap-0 overflow-y-auto border-border p-0 sm:max-w-lg"
        >
          {traceSheetStep ? (
            <>
              <SheetHeader className="border-b border-border px-6 py-4 text-left">
                <SheetTitle className="text-base leading-snug font-semibold">
                  Step {traceSheetStep.stepNumber} · {traceSheetStep.agentName}
                </SheetTitle>
              </SheetHeader>
              <div className="px-6 py-4">
                <TraceStepDetail step={traceSheetStep} />
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}

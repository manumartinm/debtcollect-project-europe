import * as React from "react"
import { Link, useNavigate, useParams } from "react-router"
import { toast } from "sonner"

import { buttonVariants } from "@workspace/ui/components/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { cn } from "@workspace/ui/lib/utils"

import { AgentTimeline } from "@/components/debtor-profile/agent-timeline"
import { DynamicFields } from "@/components/debtor-profile/dynamic-fields"
import { TraceStepDetail } from "@/components/debtor-profile/trace-step-detail"
import { FixedFields } from "@/components/debtor-profile/fixed-fields"
import { LeverageIndicator } from "@/components/debtor-profile/leverage-indicator"
import { StatusTimeline } from "@/components/debtor-profile/status-timeline"
import { useDebtors } from "@/context/debtors-context"
import {
  buildEnrichedFromTraces,
  computeLeverageFromTraces,
  type CaseStatus,
} from "@/data/mock"
import { useEnrichmentRun } from "@/hooks/use-enrichment-sim"
import { useMinLg } from "@/hooks/use-media"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import type { AiTraceStep } from "@/data/mock"
import { ArrowLeft } from "lucide-react"

export default function DebtorProfilePage() {
  const { caseId: raw } = useParams()
  const caseId = raw ? decodeURIComponent(raw) : ""
  const navigate = useNavigate()
  const { debtors, runEnrichmentState, setCaseStatus } = useDebtors()
  const lg = useMinLg()
  const { run, running } = useEnrichmentRun()
  const [traceSheetStep, setTraceSheetStep] = React.useState<AiTraceStep | null>(null)

  const openTraceDetail = React.useCallback((step: AiTraceStep) => {
    setTraceSheetStep(step)
  }, [])

  const debtor = debtors.find((d) => d.caseId === caseId)

  const startEnrichment = React.useCallback(() => {
    if (!debtor || debtor.enrichmentStatus !== "pending" || running) return
    const template = debtor.traceTemplate
    runEnrichmentState(debtor.caseId, { enrichmentStatus: "running", traces: [] })

    run(
      template,
      (partial) => {
        runEnrichmentState(debtor.caseId, { traces: partial })
      },
      () => {
        const traces = template
        const enriched = buildEnrichedFromTraces(traces)
        const leverageScore = computeLeverageFromTraces(traces)
        const withFindings = traces.filter((t) => t.finding).length
        runEnrichmentState(debtor.caseId, {
          enrichmentStatus: "complete",
          traces,
          enriched,
          leverageScore,
          enrichmentConfidence: 0.62,
        })
        toast.success(
          `Enrichment complete — ${withFindings} of ${traces.length} steps returned a finding.`
        )
      }
    )
  }, [debtor, run, runEnrichmentState, running])

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (traceSheetStep) {
          setTraceSheetStep(null)
          return
        }
        navigate("/debtors")
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "e") {
        e.preventDefault()
        startEnrichment()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [navigate, startEnrichment, traceSheetStep])

  if (!debtor) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-muted-foreground">Case not found.</p>
        <Link to="/debtors" className={cn(buttonVariants({ variant: "outline" }))}>
          Back to debtors
        </Link>
      </div>
    )
  }

  const tracePanel = (
    <AgentTimeline
      steps={debtor.traces}
      emptyMessage={
        debtor.enrichmentStatus === "pending"
          ? "No enrichment data yet — click Run enrichment to start."
          : undefined
      }
      onOpenStep={openTraceDetail}
    />
  )

  const mainCol = (
    <div className="space-y-6">
      <LeverageIndicator score={debtor.leverageScore} />
      <FixedFields debtor={debtor} />
      <DynamicFields
        debtor={debtor}
        running={running}
        onRunEnrichment={startEnrichment}
        onOpenTrace={openTraceDetail}
      />
      <StatusTimeline
        debtor={debtor}
        onStatusChange={(status: CaseStatus, note: string) =>
          setCaseStatus(debtor.caseId, status, note || undefined)
        }
      />
    </div>
  )

  const traceSidebar = (
    <aside className="rounded-xl border border-border bg-card p-4 lg:border-0 lg:bg-transparent lg:p-0">
      <div className="sticky top-20 space-y-3">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          AI agent trace
        </h2>
        <p className="hidden text-[11px] leading-snug text-muted-foreground lg:block">
          Click a step or use View agent trace to open the detail panel on the right.
        </p>
        {tracePanel}
      </div>
    </aside>
  )

  return (
    <div className="space-y-6 pb-24 lg:pb-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
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
            {debtor.name}
          </h1>
          <p className="font-mono text-xs text-muted-foreground">{debtor.caseId}</p>
        </div>
        {debtor.enrichmentStatus === "pending" ? (
          <p className="text-xs text-muted-foreground">
            <kbd className="rounded border border-border bg-muted px-1 font-mono text-[11px]">
              ⌘E
            </kbd>{" "}
            run enrichment ·{" "}
            <kbd className="rounded border border-border bg-muted px-1 font-mono text-[11px]">
              Esc
            </kbd>{" "}
            back
          </p>
        ) : null}
      </div>

      {!lg ? (
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-muted/80 p-1">
            <TabsTrigger value="profile" className="rounded-lg text-xs">
              Profile
            </TabsTrigger>
            <TabsTrigger value="trace" className="rounded-lg text-xs">
              AI trace
            </TabsTrigger>
          </TabsList>
          <TabsContent value="profile" className="mt-4">
            {mainCol}
          </TabsContent>
          <TabsContent value="trace" className="mt-4">
            {traceSidebar}
          </TabsContent>
        </Tabs>
      ) : (
        <div className="grid gap-8 lg:grid-cols-5">
          <div className="space-y-6 lg:col-span-3">{mainCol}</div>
          <div className="lg:col-span-2">{traceSidebar}</div>
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
                <SheetTitle className="text-base font-semibold leading-snug">
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

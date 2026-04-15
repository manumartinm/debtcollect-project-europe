import { Button } from "@workspace/ui/components/button"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { cn } from "@workspace/ui/lib/utils"

import type { ApiTraceStep } from "@/lib/api"

export function AgentTimeline({
  steps,
  emptyMessage,
  onOpenStep,
}: {
  steps: ApiTraceStep[]
  emptyMessage?: string
  /** Opens the trace detail panel on the right (Sheet) instead of inline expand. */
  onOpenStep?: (step: ApiTraceStep) => void
}) {
  if (steps.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
        {emptyMessage ??
          "No enrichment data yet — traces appear when the pipeline writes enriched fields."}
      </div>
    )
  }

  return (
    <ScrollArea className="h-[min(70vh,520px)] pr-3">
      <ol className="relative space-y-0 border-l border-border pl-5">
        {steps.map((step) => {
          return (
            <li key={step.id} className="pb-6 last:pb-2">
              <div className="absolute -left-[5px] mt-1.5 size-2.5 rounded-full border-2 border-background bg-primary" />
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Step {step.stepNumber}
                  </span>
                  <span
                    className={cn(
                      "rounded-md border px-2 py-0.5 text-[11px] font-medium",
                      "border-primary/20 bg-primary/8 text-primary"
                    )}
                  >
                    {step.agentName}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{step.action}</span>
                </div>
                <p className="text-sm font-medium text-foreground">
                  {(step.action.slice(0, 1).toUpperCase() + step.action.slice(1)) +
                    " — trace"}
                </p>
                <p className="line-clamp-3 text-xs text-muted-foreground">{step.reasoning}</p>
                {onOpenStep ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 w-full border-primary/20 text-xs text-primary hover:bg-primary/5 sm:w-auto"
                    onClick={() => onOpenStep(step)}
                  >
                    Open trace details
                  </Button>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>
    </ScrollArea>
  )
}

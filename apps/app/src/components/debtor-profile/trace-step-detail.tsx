import { cn } from "@workspace/ui/lib/utils"

import type { ApiTraceStep } from "@/lib/api"

/** Full detail for one trace step — used in the right Sheet and elsewhere. */
export function TraceStepDetail({ step }: { step: ApiTraceStep }) {
  return (
    <div className="space-y-4 text-[13px] leading-relaxed">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
          {step.agentName}
        </span>
        <span className="text-muted-foreground">Step {step.stepNumber}</span>
        <span className="text-muted-foreground">· {step.action}</span>
      </div>
      <p className="text-foreground">{step.reasoning}</p>
      {step.sources.length > 0 ? (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Sources
          </p>
          <ul className="mt-1 space-y-0.5">
            {step.sources.map((s) => (
              <li key={s.id}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline-offset-2 hover:underline"
                >
                  {s.name}
                </a>
                <span className="text-muted-foreground"> ({s.type})</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div>
        <span className="text-muted-foreground">Finding: </span>
        <span className={cn(!step.finding && "italic text-muted-foreground")}>
          {step.finding ?? "No results"}
        </span>
      </div>
      <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
        <span>Confidence: {step.confidence}</span>
        <span>·</span>
        <span>{(step.durationMs / 1000).toFixed(1)}s</span>
      </div>
    </div>
  )
}

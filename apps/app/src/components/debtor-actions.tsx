import * as React from "react"
import { useNavigate } from "react-router"
import { toast } from "sonner"

import { Button, buttonVariants } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Tooltip, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { TooltipRich } from "@/components/tooltip-rich"
import { cn } from "@workspace/ui/lib/utils"
import { Pencil, Phone, Trash2, Wand2 } from "lucide-react"

import {
  useAiCallDebtor,
  useDeleteDebtor,
  useEnrichDebtor,
} from "@/hooks/use-debtors-queries"
import type { ApiDebtor } from "@/lib/api"
import type { EnrichmentStatus } from "@/types/debtor"

const iconSize = "icon-sm" as const
const glyph = "size-3.5"

function truncateTooltip(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim()
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`
}

export type DebtorActionsProps = {
  debtor: ApiDebtor
  className?: string
  /** When set (e.g. on profile), Edit opens this instead of navigating with ?edit=1 */
  onEdit?: () => void
  /** Called after successful delete (e.g. navigate away from profile) */
  onDeleted?: () => void
  /** After enrich starts — subscribe with Trigger.dev Realtime (`useRealtimeRun`). */
  onEnrichRealtime?: (p: { runId: string; publicAccessToken: string }) => void
}

export function DebtorActions({
  debtor,
  className,
  onEdit,
  onDeleted,
  onEnrichRealtime,
}: DebtorActionsProps) {
  const navigate = useNavigate()
  const enrichMutation = useEnrichDebtor()
  const deleteMutation = useDeleteDebtor()
  const aiCallMutation = useAiCallDebtor()
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [aiCallOpen, setAiCallOpen] = React.useState(false)
  const [aiCallPhase, setAiCallPhase] = React.useState<
    "idle" | "dialing" | "in-progress" | "done"
  >("idle")

  const enrichSt = debtor.enrichmentStatus as EnrichmentStatus
  const canEnrich =
    enrichSt === "not_started" ||
    enrichSt === "pending" ||
    enrichSt === "failed"

  const handleEdit = () => {
    if (onEdit) {
      onEdit()
      return
    }
    navigate(`/debtors/${encodeURIComponent(debtor.id)}?edit=1`)
  }

  const handleEnrich = () => {
    if (!canEnrich) return
    enrichMutation.mutate(debtor.id, {
      onSuccess: (data) => {
        toast.success("Enrichment started — this may take a few minutes.")
        if (data.runId && data.publicAccessToken) {
          onEnrichRealtime?.({
            runId: data.runId,
            publicAccessToken: data.publicAccessToken,
          })
        }
      },
      onError: (e) =>
        toast.error(
          e instanceof Error ? e.message : "Could not start enrichment"
        ),
    })
  }

  const handleAiCall = () => {
    setAiCallPhase("dialing")
    aiCallMutation.mutate(debtor.id, {
      onSuccess: () => {
        setAiCallPhase("in-progress")
        setTimeout(() => {
          setAiCallPhase("done")
          toast.success("AI agent completed the call successfully.")
        }, 6000)
      },
      onError: (e) => {
        setAiCallPhase("idle")
        toast.error(
          e instanceof Error ? e.message : "Could not start AI call"
        )
      },
    })
  }

  const handleDelete = () => {
    deleteMutation.mutate(debtor.id, {
      onSuccess: () => {
        toast.success("Case deleted.")
        setDeleteOpen(false)
        onDeleted?.()
      },
      onError: (e) =>
        toast.error(e instanceof Error ? e.message : "Could not delete"),
    })
  }

  const stopRow = (e: React.SyntheticEvent) => e.stopPropagation()

  const enrichDisabled = !canEnrich || enrichMutation.isPending

  const enrichTooltip =
    enrichSt === "failed"
      ? {
          title: "Retry enrichment",
          body: debtor.enrichmentError?.trim()
            ? `Last error: ${truncateTooltip(debtor.enrichmentError.trim(), 120)}`
            : "Run the research pipeline again after the last run failed.",
        }
      : canEnrich && !enrichMutation.isPending
        ? {
            title: "Run enrichment",
            body: "Start automated research: signals, leverage, and call insights (not the field-level AI trace).",
          }
        : enrichMutation.isPending
          ? {
              title: "Starting…",
              body: "Sending the enrichment job to the server.",
            }
          : enrichSt === "running"
            ? {
                title: "Enrichment in progress",
                body: "Research is running. Refresh in a few minutes.",
              }
            : {
                title: "Enrichment unavailable",
                body: "This case is already enriched or queued. Open a field to view its agent trace.",
              }

  return (
    <>
      <div
        className={cn(
          "flex items-center justify-end gap-0.5",
          className
        )}
        onClick={stopRow}
        onKeyDown={stopRow}
        role="group"
        aria-label="Case actions"
      >
        <Tooltip>
          <TooltipTrigger
            type="button"
            className={cn(
              buttonVariants({ variant: "ghost", size: iconSize }),
              "cursor-pointer shrink-0",
            )}
            onClick={handleEdit}
          >
            <Pencil className={glyph} strokeWidth={1.75} />
            <span className="sr-only">Edit case</span>
          </TooltipTrigger>
          <TooltipRich side="top" title="Edit case">
            Change debtor name, country, and debt amount.
          </TooltipRich>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            type="button"
            className={cn(
              buttonVariants({
                variant:
                  canEnrich && !enrichMutation.isPending ? "default" : "outline",
                size: iconSize,
              }),
              "shrink-0",
              !enrichDisabled && "cursor-pointer shadow-sm",
              enrichMutation.isPending &&
                "cursor-wait opacity-90 ring-2 ring-primary/20",
              enrichDisabled &&
                !enrichMutation.isPending &&
                "cursor-not-allowed border border-dashed border-muted-foreground/35 bg-muted/50 text-muted-foreground opacity-55 grayscale"
            )}
            aria-disabled={enrichDisabled}
            onClick={() => {
              if (enrichDisabled) return
              handleEnrich()
            }}
          >
            <Wand2 className={glyph} strokeWidth={1.75} />
            <span className="sr-only">{enrichTooltip.title}</span>
          </TooltipTrigger>
          <TooltipRich side="top" title={enrichTooltip.title}>
            {enrichTooltip.body}
          </TooltipRich>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            type="button"
            className={cn(
              buttonVariants({ variant: "outline", size: iconSize }),
              "cursor-pointer shrink-0 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700",
            )}
            onClick={() => {
              setAiCallPhase("idle")
              setAiCallOpen(true)
            }}
          >
            <Phone className={glyph} strokeWidth={1.75} />
            <span className="sr-only">AI agent call</span>
          </TooltipTrigger>
          <TooltipRich side="top" title="AI agent call">
            Send an AI voice agent to call the debtor on your behalf.
          </TooltipRich>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            type="button"
            className={cn(
              buttonVariants({ variant: "ghost", size: iconSize }),
              "cursor-pointer shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive",
            )}
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className={glyph} strokeWidth={1.75} />
            <span className="sr-only">Delete case</span>
          </TooltipTrigger>
          <TooltipRich side="top" title="Delete case">
            Remove this debtor from the portfolio. This cannot be undone.
          </TooltipRich>
        </Tooltip>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent showCloseButton className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this case?</DialogTitle>
            <DialogDescription>
              {debtor.debtorName} ({debtor.caseRef}) will be removed permanently.
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={handleDelete}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={aiCallOpen}
        onOpenChange={(open) => {
          if (!open) {
            setAiCallOpen(false)
            setAiCallPhase("idle")
          }
        }}
      >
        <DialogContent showCloseButton className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {aiCallPhase === "idle" && "Send AI agent call"}
              {aiCallPhase === "dialing" && "Dialing…"}
              {aiCallPhase === "in-progress" && "Call in progress"}
              {aiCallPhase === "done" && "Call completed"}
            </DialogTitle>
            <DialogDescription>
              {aiCallPhase === "idle" && (
                <>
                  An AI voice agent will call{" "}
                  <span className="font-medium text-foreground">
                    {debtor.debtorName}
                  </span>{" "}
                  to discuss case {debtor.caseRef}. The agent will follow your
                  configured collection strategy.
                </>
              )}
              {aiCallPhase === "dialing" && (
                <span className="flex items-center gap-2">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                  </span>
                  Connecting to {debtor.debtorName}…
                </span>
              )}
              {aiCallPhase === "in-progress" && (
                <span className="flex items-center gap-2">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                  </span>
                  AI agent is speaking with the debtor. This may take a few minutes.
                </span>
              )}
              {aiCallPhase === "done" &&
                "The AI agent completed the call. A summary will appear in the call insights section shortly."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            {aiCallPhase === "idle" && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAiCallOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={handleAiCall}
                >
                  <Phone className="mr-1.5 size-3.5" />
                  Start call
                </Button>
              </>
            )}
            {aiCallPhase === "done" && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAiCallOpen(false)
                  setAiCallPhase("idle")
                }}
              >
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

import { Link } from "react-router"
import { format } from "date-fns"
import { Phone } from "lucide-react"

import { buttonVariants } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import { EmptyState } from "@/components/empty-state"
import { useTranscriptsByDebtor } from "@/hooks/use-transcripts-queries"

function formatDuration(seconds: number | null) {
  if (seconds == null || seconds <= 0) return "—"
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

type Props = {
  debtorId: string
  orgId: string
  debtorName: string
}

export function DebtorCallsSection({ debtorId, orgId, debtorName }: Props) {
  const { data: calls = [], isLoading, error } = useTranscriptsByDebtor(
    debtorId,
    orgId
  )

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-6 w-40 animate-pulse rounded bg-muted" />
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <EmptyState
        title="Could not load calls"
        description={
          error instanceof Error ? error.message : "Something went wrong"
        }
      />
    )
  }

  if (calls.length === 0) {
    return (
      <EmptyState
        icon={Phone}
        title="No calls yet"
        description={`Voice calls with ${debtorName} will show transcripts here.`}
      />
    )
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/80 shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Call history</CardTitle>
          <CardDescription>
            Call transcripts for this case ({calls.length} call
            {calls.length !== 1 ? "s" : ""})
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {calls.map((call) => {
            const start = new Date(call.callStartTime)
            return (
              <div
                key={call.id}
                className="rounded-xl border border-border/80 bg-muted/20 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">
                      {format(start, "MMM d, yyyy · HH:mm")}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Duration {formatDuration(call.durationSeconds)}
                    </p>
                  </div>
                  <Link
                    to={`/calls/${call.id}`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    Open transcript
                  </Link>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}

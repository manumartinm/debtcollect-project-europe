import { useParams, Link } from "react-router"
import { format, formatDuration, intervalToDuration } from "date-fns"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { buttonVariants } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"

import { useTranscript } from "@/hooks/use-transcripts-queries"
import { EmptyState } from "@/components/empty-state"
import { ArrowLeft, Phone } from "lucide-react"

export default function CallDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: transcript, isLoading, error } = useTranscript(id ?? "")

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 py-8">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 animate-pulse rounded bg-muted" />
          <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        </div>
        <div className="space-y-4">
          {[...Array(10)].map((_, i) => (
            <div
              key={i}
              className="h-20 w-full animate-pulse rounded bg-muted"
            />
          ))}
        </div>
      </div>
    )
  }

  if (error || !transcript) {
    return (
      <div className="mx-auto max-w-4xl py-8">
        <Link
          to="/calls"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-4")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to calls
        </Link>
        <EmptyState
          title="Call not found"
          description={error instanceof Error ? error.message : "The requested call transcript could not be found."}
          icon={Phone}
        />
      </div>
    )
  }

  const callStartDate = new Date(transcript.callStartTime)
  const callEndDate = new Date(transcript.callEndTime)
  const duration =
    transcript.durationSeconds &&
    formatDuration(
      intervalToDuration({
        start: 0,
        end: transcript.durationSeconds * 1000,
      }),
      { format: ["minutes", "seconds"] }
    )

  // Parse transcript lines
  const transcriptLines = transcript.transcript.split("\n").filter((line) => line.trim())

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link to="/calls" className={buttonVariants({ variant: "ghost", size: "sm" })}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to calls
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {transcript.debtor?.debtorName || "Call Transcript"}
        </h1>
        {transcript.debtor?.caseRef && (
          <p className="mt-1 text-sm text-muted-foreground">
            Case: {transcript.debtor.caseRef}
          </p>
        )}
        {transcript.debtorId ? (
          <p className="mt-2">
            <Link
              to={`/debtors/${encodeURIComponent(transcript.debtorId)}`}
              className={buttonVariants({
                variant: "link",
                size: "sm",
                className: "h-auto p-0",
              })}
            >
              Open debtor profile
            </Link>
          </p>
        ) : null}
      </div>

      <Card className="border-border/80 shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Call Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Start Time</p>
              <p className="mt-1 text-sm font-medium">
                {format(callStartDate, "MMM d, yyyy HH:mm:ss")}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">End Time</p>
              <p className="mt-1 text-sm font-medium">
                {format(callEndDate, "HH:mm:ss")}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Duration</p>
              <p className="mt-1 text-sm font-medium">{duration || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Created</p>
              <p className="mt-1 text-sm font-medium">
                {format(new Date(transcript.createdAt), "MMM d, yyyy")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Transcript</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 font-mono text-sm">
            {transcriptLines.map((line, index) => {
              const isAgent = line.toUpperCase().startsWith("[AGENT]")
              const isUser = line.toUpperCase().startsWith("[USER]")

              return (
                <div
                  key={index}
                  className={`rounded-lg px-3 py-2 ${
                    isAgent
                      ? "border-l-4 border-blue-500 bg-blue-50"
                      : isUser
                        ? "border-l-4 border-green-500 bg-green-50"
                        : "border-l-4 border-muted bg-muted/50"
                  }`}
                >
                  {isAgent && <Badge variant="secondary" className="mb-1">Agent</Badge>}
                  {isUser && <Badge variant="outline" className="mb-1">Debtor</Badge>}
                  <p className="break-words text-foreground">
                    {isAgent || isUser ? line.slice(line.indexOf("]") + 2) : line}
                  </p>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

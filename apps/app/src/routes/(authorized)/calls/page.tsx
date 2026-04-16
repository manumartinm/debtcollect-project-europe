import * as React from "react"
import { Link, Navigate } from "react-router"
import { format } from "date-fns"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"

import { useOrg } from "@/context/org-context"
import { useTranscriptsList } from "@/hooks/use-transcripts-queries"
import { EmptyState } from "@/components/empty-state"
import { Phone } from "lucide-react"

export default function CallsPage() {
  const { orgId, orgs, isLoading: orgLoading } = useOrg()
  const { data: transcripts = [], isLoading, error } = useTranscriptsList(orgId ?? "")

  if (!orgLoading && orgs.length === 0) {
    return <Navigate to="/onboarding" replace />
  }

  if (orgLoading || isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 py-8">
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 w-full animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl py-8">
        <EmptyState
          title="Error loading calls"
          description={error instanceof Error ? error.message : "Something went wrong"}
        />
      </div>
    )
  }

  if (!transcripts || transcripts.length === 0) {
    return (
      <div className="mx-auto max-w-6xl py-8">
        <EmptyState
          title="No calls yet"
          description="Call transcripts will appear here after voice calls are completed."
          icon={Phone}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Call Transcripts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          View and manage voice call transcripts
        </p>
      </div>

      <Card className="border-border/80 shadow-none">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">
            {transcripts.length} call{transcripts.length !== 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Debtor</TableHead>
                  <TableHead>Case Ref</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transcripts.map((transcript) => {
                  const callDate = new Date(transcript.callStartTime)
                  const duration = transcript.durationSeconds
                    ? `${Math.floor(transcript.durationSeconds / 60)}:${String(transcript.durationSeconds % 60).padStart(2, "0")}`
                    : "—"

                  return (
                    <TableRow key={transcript.id}>
                      <TableCell className="font-medium">
                        {transcript.debtor?.debtorName || "Unknown"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {transcript.debtor?.caseRef || "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(callDate, "MMM d, yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="text-sm">{duration}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                        >
                          <Link to={`/calls/${transcript.id}`}>
                            View
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

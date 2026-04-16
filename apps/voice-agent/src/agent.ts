import { llm, voice } from '@livekit/agents';
import { z } from 'zod';

const CASE_STATUSES = [
  'new',
  'reviewing',
  'called',
  'negotiating',
  'payment_plan',
  'settled',
  'unresponsive',
  'legal',
] as const;

const CALL_OUTCOMES = [
  'unknown',
  'no_answer',
  'wrong_number',
  'callback_requested',
  'promise_to_pay',
  'payment_plan_discussed',
  'dispute_raised',
  'refused',
  'settled',
] as const;

type CaseStatus = (typeof CASE_STATUSES)[number];
type CallOutcome = (typeof CALL_OUTCOMES)[number];

export type DebtorRecord = {
  id: string;
  orgId: string;
  caseRef: string;
  assignedTo: string | null;
  debtorName: string;
  country: string;
  debtAmount: string;
  callOutcome: CallOutcome;
  legalOutcome: string;
  caseStatus: CaseStatus;
  enrichmentStatus: 'not_started' | 'pending' | 'running' | 'complete' | 'failed';
  enrichmentError: string | null;
  enrichmentConfidence: number | null;
  leverageScore: 'none' | 'low' | 'medium' | 'high';
  createdAt: string;
  updatedAt: string;
};

export type CollectorProfile = {
  collectorName: string;
  collectorRole: string;
  organizationName: string;
  locale: string;
  escalationPolicy: string;
};

export type DebtCollectionContext = {
  collector: CollectorProfile;
  debtor: DebtorRecord;
  enrichmentFields: Record<string, string | null>;
};

export type TranscriptMessage = {
  role: 'agent' | 'user';
  content: string;
  timestamp: Date;
};

async function sendTranscriptToAPI(
  context: DebtCollectionContext,
  callStartTime: Date,
  callEndTime: Date,
): Promise<void> {
  try {
    const apiUrl = process.env.API_URL || 'http://localhost:3000';
    
    // Create a placeholder transcript for now
    // In production, this would be populated from the actual conversation
    const transcript = `[AGENT]: Call initiated - Greeting debtor\n[DEBTOR]: <conversation would be recorded here>`;

    const durationSeconds = Math.floor(
      (callEndTime.getTime() - callStartTime.getTime()) / 1000,
    );

    const payload = {
      debtorId: context.debtor.id,
      orgId: context.debtor.orgId,
      transcript,
      callStartTime: callStartTime.toISOString(),
      callEndTime: callEndTime.toISOString(),
      durationSeconds,
    };

    const response = await fetch(`${apiUrl}/api/transcripts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(
        `Failed to send transcript: ${response.status} ${response.statusText}`,
      );
      const errorText = await response.text();
      console.error('Error details:', errorText);
    } else {
      console.log('Transcript successfully sent to API');
      const data = await response.json();
      console.log('Transcript saved:', data);
    }
  } catch (error) {
    console.error('Error sending transcript to API:', error);
  }
}

export class Agent extends voice.Agent {
  private callStartTime: Date = new Date();

  constructor(private readonly context: DebtCollectionContext) {
    let currentStatus: CaseStatus = context.debtor.caseStatus;
    let currentCallOutcome: CallOutcome = context.debtor.callOutcome;

    super({
      instructions: buildInstructions(context),
      tools: {
        getCaseSummary: llm.tool({
          description:
            'Get a compact snapshot of the current debtor case, including status, outcome, and enrichment fields.',
          parameters: z.object({}),
          execute: async () => {
            return buildCaseSummary(context, currentStatus, currentCallOutcome);
          },
        }),
        updateCaseStatus: llm.tool({
          description:
            'Update the debtor case status in the agent working memory. Use this after the user confirms a progression or resolution step.',
          parameters: z.object({
            newStatus: z.enum(CASE_STATUSES),
            reason: z
              .string()
              .max(280)
              .optional()
              .describe('Short rationale for the status change.'),
          }),
          execute: async ({ newStatus, reason }) => {
            const previousStatus = currentStatus;
            currentStatus = newStatus;
            this.context.debtor.caseStatus = newStatus;

            return `Case status updated from ${previousStatus} to ${newStatus}${reason ? ` (reason: ${reason})` : ''}.`;
          },
        }),
        updateCallOutcome: llm.tool({
          description:
            'Update the latest call outcome in agent working memory after each conversation outcome is clear.',
          parameters: z.object({
            outcome: z.enum(CALL_OUTCOMES),
            note: z
              .string()
              .max(280)
              .optional()
              .describe('Optional detail about how the outcome was determined.'),
          }),
          execute: async ({ outcome, note }) => {
            const previousOutcome = currentCallOutcome;
            currentCallOutcome = outcome;
            this.context.debtor.callOutcome = outcome;

            return `Call outcome updated from ${previousOutcome} to ${outcome}${note ? ` (note: ${note})` : ''}.`;
          },
        }),
      },
    });

    this.callStartTime = new Date();
  }

  async endCall(): Promise<void> {
    const callEndTime = new Date();
    await sendTranscriptToAPI(this.context, this.callStartTime, callEndTime);
  }
}

function serializeEnrichmentFields(fields: Record<string, string | null>): string {
  const entries = Object.entries(fields);
  if (entries.length === 0) {
    return 'No enrichment fields available.';
  }

  return entries
    .map(([key, value]) => `${key}: ${value && value.trim().length > 0 ? value : 'unknown'}`)
    .join('\n');
}

function buildInstructions(context: DebtCollectionContext): string {
  const { collector, debtor, enrichmentFields } = context;

  return `You are a debt collection voice agent representing ${collector.organizationName}.
The user is interacting with you by voice. Speak naturally, confidently, and with empathy.

Agent behavior:
- Keep responses concise, clear, and action-oriented.
- Verify key details before proposing next steps.
- Focus on debt resolution options such as settlement, payment plans, and callback scheduling.
- Stay professional and non-threatening. Never provide legal advice beyond case process updates.
- If data is missing, say so explicitly and continue with the best available information.

Collector profile:
- name: ${collector.collectorName}
- role: ${collector.collectorRole}
- locale: ${collector.locale}
- escalation policy: ${collector.escalationPolicy}

Debtor case context:
- debtor_id: ${debtor.id}
- organization_id: ${debtor.orgId}
- case_ref: ${debtor.caseRef}
- assigned_to: ${debtor.assignedTo ?? 'unassigned'}
- debtor_name: ${debtor.debtorName}
- country: ${debtor.country}
- debt_amount: ${debtor.debtAmount}
- case_status: ${debtor.caseStatus}
- call_outcome: ${debtor.callOutcome}
- legal_outcome: ${debtor.legalOutcome}
- enrichment_status: ${debtor.enrichmentStatus}
- enrichment_error: ${debtor.enrichmentError ?? 'none'}
- enrichment_confidence: ${debtor.enrichmentConfidence ?? 'unknown'}
- leverage_score: ${debtor.leverageScore}
- created_at: ${debtor.createdAt}
- updated_at: ${debtor.updatedAt}

Enrichment fields (includes standard and additional fields):
${serializeEnrichmentFields(enrichmentFields)}

Use the available tools when the user asks to update case metadata.`;
}

function buildCaseSummary(
  context: DebtCollectionContext,
  status: CaseStatus,
  callOutcome: CallOutcome,
): string {
  const { debtor, enrichmentFields } = context;

  return [
    `Case ${debtor.caseRef} for ${debtor.debtorName}`,
    `status=${status}`,
    `call_outcome=${callOutcome}`,
    `debt_amount=${debtor.debtAmount}`,
    `country=${debtor.country}`,
    `enrichment_status=${debtor.enrichmentStatus}`,
    `leverage_score=${debtor.leverageScore}`,
    `enrichment_fields:\n${serializeEnrichmentFields(enrichmentFields)}`,
  ].join('\n');
}

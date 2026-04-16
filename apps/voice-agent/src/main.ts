import {
  type JobContext,
  type JobProcess,
  ServerOptions,
  cli,
  defineAgent,
  inference,
  voice,
} from '@livekit/agents';
import * as livekit from '@livekit/agents-plugin-livekit';
import * as silero from '@livekit/agents-plugin-silero';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { Agent, type DebtCollectionContext } from './agent';

dotenv.config({ path: '.env.local' });

const requiredEnvVars = ['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET'] as const;
const missingEnvVars = requiredEnvVars.filter((name) => !process.env[name]?.trim());

if (missingEnvVars.length > 0) {
  console.warn(
    `Skipping voice-agent dev startup: missing ${missingEnvVars.join(', ')}. ` +
      'Set them in apps/voice-agent/.env.local to run the LiveKit worker.',
  );
  process.exit(0);
}

const callContext: DebtCollectionContext = {
  collector: {
    collectorName: 'Alex Rivera',
    collectorRole: 'senior_collector',
    organizationName: 'Atlas Recovery Group',
    locale: 'en-US',
    escalationPolicy:
      'Escalate to legal queue only after repeated non-response or explicit refusal to negotiate.',
  },
  debtor: {
    id: 'debtor-421',
    orgId: 'org-17',
    caseRef: 'C-421',
    assignedTo: 'agent-18',
    debtorName: 'Jordan Miller',
    country: 'US',
    debtAmount: '12.8k',
    callOutcome: 'unknown',
    legalOutcome: 'unknown',
    caseStatus: 'reviewing',
    enrichmentStatus: 'complete',
    enrichmentError: null,
    enrichmentConfidence: 0.8,
    leverageScore: 'medium',
    createdAt: '2026-04-02',
    updatedAt: '2026-04-15',
  },
  enrichmentFields: {
    phone: '202-555-0142',
    address: '1324 Elm St, Arlington, VA',
    employer: 'Northline Logistics',
    assets: 'Vehicle lien on file, no real-estate records',
    social_media_hints: 'Recently active, likely still employed',
    income_bracket: '55-75k',
    email: 'j.miller@examplemail.com',
    tax_id: null,
    preferred_contact_window: 'Weekdays 17:00-20:00 local time',
    hardship_signal: 'Medical bills mentioned in prior conversation',
  },
};

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    proc.userData.vad = await silero.VAD.load();
  },
  entry: async (ctx: JobContext) => {
    const session = new voice.AgentSession({
      stt: new inference.STT({
        model: 'deepgram/nova-3',
        language: 'multi',
      }),

      llm: new inference.LLM({
        model: 'openai/gpt-4.1-mini',
      }),

      tts: new inference.TTS({
        model: 'cartesia/sonic-3',
        voice: '9626c31c-bec5-4cca-baa8-f8ba9e84c8bc',
      }),

      turnDetection: new livekit.turnDetector.MultilingualModel(),
      vad: ctx.proc.userData.vad! as silero.VAD,
    });

    await session.start({
      agent: new Agent(callContext),
      room: ctx.room,
    });

    await ctx.connect();

    session.generateReply({
      instructions:
        'Greet the debtor professionally, confirm identity with care, and offer constructive repayment options.',
    });
  },
});

cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(import.meta.url),
  }),
);

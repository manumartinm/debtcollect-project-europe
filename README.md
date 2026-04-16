# DeepCollect

DeepCollect is an AI-assisted debt recovery platform designed to turn silent cases into actionable conversations.

It is part of "The Last Human Industry", the Vexor x Project Europe Barcelona Hackathon Challenge.

It combines portfolio ingestion, automated background research, and voice operations in one workflow:

1. Import debtor portfolios from CSV (including Excel-exported files).
2. Run background enrichment pipelines that gather public signals.
3. Use that context to guide AI-assisted collection calls.
4. Track outcomes, transcripts, and status changes in real time.

## Product Vision

Debt collection teams usually lose time because they start with too little context. We decided to build a system that creates leverage before the first call.

Instead of just showing a debtor row, DeepCollect builds an operational briefing:

- Who this person might be in the real world
- What signals support that view
- How confident we are
- What angle a collector should take next

The goal is simple: improve recovery decisions by improving information quality and call timing.

## What The Platform Consists Of

- apps/app: operator-facing interface for upload, case review, insights, and call operations
- apps/api: core backend for case management, orgs/auth, enrichment orchestration, and trace persistence
- apps/voice-agent: voice worker that executes debt-collection conversations with case context
- packages/ui: shared design system and UI primitives

## Platform Workflow

1. Portfolio import
- Teams upload a CSV portfolio.
- Fields are mapped once and normalized into cases.

2. Background enrichment pipelines
- Cases enter asynchronous research pipelines.
- Multiple data branches run in parallel and consolidate into structured signals.
- Output includes evidence trails, citations, and confidence.

3. Case intelligence for collectors
- Each debtor profile shows actionable enriched signals.
- Every important claim can be traced back to a source.
- If no reliable data is found, the system clearly says so.

4. Voice collection workflow
- AI voice agents can run collection calls with case-specific context.
- Calls generate transcripts and timeline artifacts for review.
- Case status progresses as conversations move forward.

## Signal Coverage

Enrichment covers a broad set of public-data categories, including:

- Web discovery and identity signals
- Social profile indicators
- Court and docket information
- Bankruptcy-related records
- Business affiliations and entities
- Lien and property-related signals

All findings are designed to be inspectable and source-backed.

## Key Features

- Collecting defensible, cited signals from public sources.
- Running background pipelines so collectors stay focused on high-value actions.
- Showing transparent reasoning traces for enriched fields.
- Being honest when no usable data is found.
- Turning enrichment output into practical call strategy and case movement.

## Organizations, Security, and Auditability

- Session-based auth and organization-scoped workspaces.
- Membership and role model for team collaboration.
- Status history and trace records for full case auditability.
- Transcript history for post-call review and quality control.

## Tech Stack

- Frontend: React + Vite
- Backend: TypeScript API + relational data model
- Pipelines: asynchronous background task orchestration
- Voice: real-time voice agent infrastructure

## Local Development

Requirements:

- Node.js 20+
- pnpm 9+
- Postgres

Install dependencies:

```bash
pnpm install
```

Create env files from examples:

- apps/api/.env from apps/api/.env.example
- apps/app/.env from apps/app/.env.example
- apps/voice-agent/.env.local from apps/voice-agent/.env.example

Run backend:

```bash
cd apps/api
pnpm db:migrate
pnpm dev
```

Run frontend:

```bash
cd apps/app
pnpm dev
```

Run background pipeline worker:

```bash
cd apps/api
pnpm trigger:dev
```

Run voice agent:

```bash
cd apps/voice-agent
pnpm dev
```

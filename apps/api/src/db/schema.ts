import { sql } from 'drizzle-orm'
import { relations } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  numeric,
  pgTable,
  jsonb,
  real,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

// ---------------------------------------------------------------------------
// Auth (better-auth)
// ---------------------------------------------------------------------------

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
})

// ---------------------------------------------------------------------------
// Organizations
// ---------------------------------------------------------------------------

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(members),
  debtors: many(debtors),
}))

// ---------------------------------------------------------------------------
// Members (user <-> org)
// ---------------------------------------------------------------------------

export const members = pgTable(
  'members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('collector'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('members_org_user_uniq').on(t.orgId, t.userId),
    check('members_role_check', sql`${t.role} IN ('admin', 'collector', 'viewer')`),
  ],
)

export const membersRelations = relations(members, ({ one }) => ({
  organization: one(organizations, {
    fields: [members.orgId],
    references: [organizations.id],
  }),
  user: one(user, {
    fields: [members.userId],
    references: [user.id],
  }),
}))

// ---------------------------------------------------------------------------
// Debtors
// ---------------------------------------------------------------------------

export const debtors = pgTable(
  'debtors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    caseRef: text('case_ref').notNull(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    assignedTo: text('assigned_to').references(() => user.id, { onDelete: 'set null' }),
    debtorName: text('debtor_name').notNull(),
    country: text('country').notNull(),
    debtAmount: numeric('debt_amount', { precision: 12, scale: 2 }).notNull(),
    callOutcome: text('call_outcome').notNull().default('unknown'),
    legalOutcome: text('legal_outcome').notNull().default('unknown'),
    caseStatus: text('case_status').notNull().default('new'),
    enrichmentStatus: text('enrichment_status').notNull().default('not_started'),
    /** Last pipeline failure (API or Trigger task); cleared on new run or success. */
    enrichmentError: text('enrichment_error'),
    enrichmentConfidence: real('enrichment_confidence'),
    leverageScore: text('leverage_score').notNull().default('none'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('debtors_org_case_ref_unique').on(t.orgId, t.caseRef),
    index('debtors_org_status_idx').on(t.orgId, t.caseStatus),
    index('debtors_org_country_idx').on(t.orgId, t.country),
    index('debtors_org_enrichment_idx').on(t.orgId, t.enrichmentStatus),
    check(
      'debtors_case_status_check',
      sql`${t.caseStatus} IN ('new', 'reviewing', 'called', 'negotiating', 'payment_plan', 'settled', 'unresponsive', 'legal')`,
    ),
    check(
      'debtors_enrichment_status_check',
      sql`${t.enrichmentStatus} IN ('not_started', 'pending', 'running', 'complete', 'failed')`,
    ),
    check(
      'debtors_leverage_check',
      sql`${t.leverageScore} IN ('none', 'low', 'medium', 'high')`,
    ),
  ],
)

export const debtorsRelations = relations(debtors, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [debtors.orgId],
    references: [organizations.id],
  }),
  assignee: one(user, {
    fields: [debtors.assignedTo],
    references: [user.id],
  }),
  enrichedFields: many(enrichedFields),
  statusEvents: many(statusEvents),
}))

// ---------------------------------------------------------------------------
// Enriched fields (one row per field per debtor)
// ---------------------------------------------------------------------------

export const enrichedFields = pgTable(
  'enriched_fields',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    debtorId: uuid('debtor_id')
      .notNull()
      .references(() => debtors.id, { onDelete: 'cascade' }),
    fieldName: text('field_name').notNull(),
    value: text('value'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('enriched_fields_debtor_field_uniq').on(t.debtorId, t.fieldName),
    check(
      'enriched_fields_name_check',
      sql`${t.fieldName} IN ('phone', 'address', 'employer', 'assets', 'social_media_hints', 'income_bracket', 'email', 'tax_id', 'bankruptcy_status', 'litigation_history', 'property_ownership', 'business_affiliations', 'relatives_associates', 'date_of_birth')`,
    ),
  ],
)

export const enrichedFieldsRelations = relations(enrichedFields, ({ one, many }) => ({
  debtor: one(debtors, {
    fields: [enrichedFields.debtorId],
    references: [debtors.id],
  }),
  traceSteps: many(fieldTraceSteps),
}))

// ---------------------------------------------------------------------------
// Field trace steps
// ---------------------------------------------------------------------------

export const fieldTraceSteps = pgTable(
  'field_trace_steps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    enrichedFieldId: uuid('enriched_field_id')
      .notNull()
      .references(() => enrichedFields.id, { onDelete: 'cascade' }),
    stepNumber: integer('step_number').notNull(),
    agentName: text('agent_name').notNull(),
    action: text('action').notNull(),
    reasoning: text('reasoning').notNull(),
    finding: text('finding'),
    confidence: text('confidence').notNull().default('none'),
    claimContent: text('claim_content'),
    linkedCitations: jsonb('linked_citations').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    claimConfidence: text('claim_confidence').notNull().default('none'),
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
    durationMs: integer('duration_ms').notNull().default(0),
  },
  (t) => [
    index('field_trace_steps_field_step_idx').on(t.enrichedFieldId, t.stepNumber),
    check(
      'field_trace_steps_confidence_check',
      sql`${t.confidence} IN ('high', 'medium', 'low', 'none')`,
    ),
    check(
      'field_trace_steps_claim_confidence_check',
      sql`${t.claimConfidence} IN ('high', 'medium', 'low', 'none')`,
    ),
  ],
)

export const fieldTraceStepsRelations = relations(fieldTraceSteps, ({ one, many }) => ({
  enrichedField: one(enrichedFields, {
    fields: [fieldTraceSteps.enrichedFieldId],
    references: [enrichedFields.id],
  }),
  sources: many(fieldTraceSources),
}))

export const fieldTraceSources = pgTable('field_trace_sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  stepId: uuid('step_id')
    .notNull()
    .references(() => fieldTraceSteps.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  url: text('url').notNull(),
  type: text('type').notNull(),
})

export const fieldTraceSourcesRelations = relations(fieldTraceSources, ({ one }) => ({
  step: one(fieldTraceSteps, {
    fields: [fieldTraceSources.stepId],
    references: [fieldTraceSteps.id],
  }),
}))

// ---------------------------------------------------------------------------
// Status events (audit log)
// ---------------------------------------------------------------------------

export const statusEvents = pgTable(
  'status_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    debtorId: uuid('debtor_id')
      .notNull()
      .references(() => debtors.id, { onDelete: 'cascade' }),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    status: text('status').notNull(),
    note: text('note'),
    author: text('author').notNull(),
  },
  (t) => [
    index('status_events_debtor_time_idx').on(t.debtorId, t.occurredAt),
    check(
      'status_events_status_check',
      sql`${t.status} IN ('new', 'reviewing', 'called', 'negotiating', 'payment_plan', 'settled', 'unresponsive', 'legal')`,
    ),
  ],
)

export const statusEventsRelations = relations(statusEvents, ({ one }) => ({
  debtor: one(debtors, {
    fields: [statusEvents.debtorId],
    references: [debtors.id],
  }),
}))

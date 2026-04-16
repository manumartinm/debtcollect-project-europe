import { eq, and, asc, desc } from 'drizzle-orm'
import { db } from '../db/client.js'
import {
  debtors,
  enrichedFields,
  fieldTraceSteps,
  fieldTraceSources,
  statusEvents,
} from '../db/schema.js'

function debtorWithRelations() {
  return {
    enrichedFields: {
      with: {
        traceSteps: {
          orderBy: [asc(fieldTraceSteps.stepNumber)],
          with: {
            sources: true as const,
          },
        },
      },
    },
    statusEvents: {
      orderBy: [desc(statusEvents.occurredAt)],
    },
  }
}

export class DebtorModel {
  static async findAllByOrg(orgId: string) {
    return db.query.debtors.findMany({
      where: eq(debtors.orgId, orgId),
      with: debtorWithRelations(),
    })
  }

  static async findById(id: string) {
    return db.query.debtors.findFirst({
      where: eq(debtors.id, id),
      with: debtorWithRelations(),
    })
  }

  /** Resolve by business case reference (human-readable; routes use debtor UUID). */
  static async findByCaseRef(caseRef: string) {
    return db.query.debtors.findFirst({
      where: eq(debtors.caseRef, caseRef),
      with: debtorWithRelations(),
    })
  }

  static async create(body: Record<string, unknown>) {
    const {
      caseRef,
      orgId,
      debtorName,
      country,
      debtAmount,
      callOutcome,
      legalOutcome,
    } = body as {
      caseRef: string
      orgId: string
      debtorName: string
      country: string
      debtAmount: number
      callOutcome?: string
      legalOutcome?: string
    }

    const [row] = await db
      .insert(debtors)
      .values({
        caseRef,
        orgId,
        debtorName,
        country,
        debtAmount: String(debtAmount),
        callOutcome: callOutcome ?? 'unknown',
        legalOutcome: legalOutcome ?? 'unknown',
        enrichmentStatus: 'not_started',
      })
      .returning({ id: debtors.id })

    return DebtorModel.findById(row.id)
  }

  static async bulkCreate(
    orgId: string,
    rows: Array<{
      caseRef: string
      debtorName: string
      country: string
      debtAmount: number
      callOutcome?: string
      legalOutcome?: string
      /** Stored in `enriched_fields` (allowed field_name values only). */
      enriched?: Partial<
        Record<'phone' | 'address' | 'email' | 'tax_id', string>
      >
    }>,
  ) {
    const inserted: { id: string }[] = []
    for (const r of rows) {
      const [row] = await db
        .insert(debtors)
        .values({
          caseRef: r.caseRef,
          orgId,
          debtorName: r.debtorName,
          country: r.country,
          debtAmount: String(r.debtAmount),
          callOutcome: r.callOutcome ?? 'unknown',
          legalOutcome: r.legalOutcome ?? 'unknown',
          enrichmentStatus: 'not_started',
        })
        .returning({ id: debtors.id })

      const e = r.enriched
      if (e) {
        const entries: Array<[string, string]> = []
        if (e.phone?.trim()) entries.push(['phone', e.phone.trim()])
        if (e.address?.trim()) entries.push(['address', e.address.trim()])
        if (e.email?.trim()) entries.push(['email', e.email.trim()])
        if (e.tax_id?.trim()) entries.push(['tax_id', e.tax_id.trim()])
        for (const [fieldName, value] of entries) {
          await db.insert(enrichedFields).values({
            debtorId: row.id,
            fieldName,
            value,
          })
        }
      }

      inserted.push(row)
    }
    return inserted
  }

  static async update(id: string, patch: Record<string, unknown>) {
    const allowed = [
      'debtorName',
      'country',
      'debtAmount',
      'callOutcome',
      'legalOutcome',
      'caseStatus',
      'enrichmentStatus',
      'enrichmentError',
      'enrichmentConfidence',
      'leverageScore',
      'assignedTo',
    ] as const
    const data: Record<string, unknown> = { updatedAt: new Date() }
    for (const key of allowed) {
      if (key in patch && patch[key] !== undefined) {
        if (key === 'debtAmount') {
          data[key] = String(patch[key])
        } else {
          data[key] = patch[key]
        }
      }
    }
    if (Object.keys(data).length <= 1) return DebtorModel.findById(id)

    const [row] = await db.update(debtors).set(data).where(eq(debtors.id, id)).returning({ id: debtors.id })
    if (!row) return null
    return DebtorModel.findById(row.id)
  }

  static async delete(id: string) {
    const [row] = await db.delete(debtors).where(eq(debtors.id, id)).returning({ id: debtors.id })
    return row ?? null
  }
}

export class StatusEventModel {
  static async findByDebtor(debtorId: string) {
    return db.query.statusEvents.findMany({
      where: eq(statusEvents.debtorId, debtorId),
      orderBy: [desc(statusEvents.occurredAt)],
    })
  }

  static async setStatus(
    debtorId: string,
    status: string,
    note: string | undefined,
    author: string,
  ) {
    const debtor = await db.query.debtors.findFirst({
      where: eq(debtors.id, debtorId),
      columns: { id: true },
    })
    if (!debtor) return null

    return db.transaction(async (tx) => {
      await tx
        .update(debtors)
        .set({ caseStatus: status, updatedAt: new Date() })
        .where(eq(debtors.id, debtorId))

      const [event] = await tx
        .insert(statusEvents)
        .values({
          debtorId,
          status,
          note: note ?? null,
          author,
        })
        .returning()

      return event
    })
  }
}

export type TraceStepInput = {
  stepNumber: number
  agentName: string
  action: string
  reasoning: string
  finding: string | null
  confidence: string
  durationMs: number
  sources?: Array<{ name: string; url: string; type: string }>
}

export class EnrichedFieldModel {
  static async findByDebtor(debtorId: string) {
    return db.query.enrichedFields.findMany({
      where: eq(enrichedFields.debtorId, debtorId),
      with: {
        traceSteps: {
          orderBy: [asc(fieldTraceSteps.stepNumber)],
          with: {
            sources: true as const,
          },
        },
      },
    })
  }

  static async upsert(
    debtorId: string,
    fieldName: string,
    value: string | null,
    traceStepsInput?: TraceStepInput[],
  ) {
    const debtor = await db.query.debtors.findFirst({
      where: eq(debtors.id, debtorId),
      columns: { id: true },
    })
    if (!debtor) return null

    return db.transaction(async (tx) => {
      const existingRows = await tx
        .select({ id: enrichedFields.id })
        .from(enrichedFields)
        .where(and(eq(enrichedFields.debtorId, debtorId), eq(enrichedFields.fieldName, fieldName)))
        .limit(1)
      const existing = existingRows[0]

      let fieldId: string
      if (existing) {
        await tx.delete(fieldTraceSteps).where(eq(fieldTraceSteps.enrichedFieldId, existing.id))
        await tx
          .update(enrichedFields)
          .set({ value })
          .where(eq(enrichedFields.id, existing.id))
        fieldId = existing.id
      } else {
        const [created] = await tx
          .insert(enrichedFields)
          .values({ debtorId, fieldName, value })
          .returning({ id: enrichedFields.id })
        fieldId = created.id
      }

      if (traceStepsInput?.length) {
        for (const step of traceStepsInput) {
          const [s] = await tx
            .insert(fieldTraceSteps)
            .values({
              enrichedFieldId: fieldId,
              stepNumber: step.stepNumber,
              agentName: step.agentName,
              action: step.action,
              reasoning: step.reasoning,
              finding: step.finding,
              confidence: step.confidence,
              durationMs: step.durationMs,
            })
            .returning({ id: fieldTraceSteps.id })

          const sources = step.sources ?? []
          if (sources.length) {
            await tx.insert(fieldTraceSources).values(
              sources.map((src) => ({
                stepId: s.id,
                name: src.name,
                url: src.url,
                type: src.type,
              })),
            )
          }
        }
      }

      const full = await db.query.enrichedFields.findFirst({
        where: eq(enrichedFields.id, fieldId),
        with: {
          traceSteps: {
            orderBy: [asc(fieldTraceSteps.stepNumber)],
            with: {
              sources: true as const,
            },
          },
        },
      })
      return full ?? null
    })
  }
}

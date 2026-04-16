import type { Context } from 'hono'
import { formatEnrichmentFailure } from '../lib/enrichment-error.js'
import { triggerDebtorEnrichment } from '../lib/enrich-trigger.js'
import {
  DebtorModel,
  StatusEventModel,
  EnrichedFieldModel,
} from '../models/debtor.model.js'

function paramId(c: Context): string {
  return c.req.param('id')!
}

export class DebtorController {
  static async list(c: Context) {
    const orgId = c.req.query('orgId')
    if (!orgId) return c.json({ error: 'orgId is required' }, 400)

    const rows = await DebtorModel.findAllByOrg(orgId)
    return c.json(rows)
  }

  /** GET /by-case-ref/:caseRef — load debtor by case reference (human-readable id in URLs). */
  static async getByCaseRef(c: Context) {
    const raw = c.req.param('caseRef')
    const caseRef = raw ? decodeURIComponent(raw) : ''
    if (!caseRef) return c.json({ error: 'caseRef is required' }, 400)

    const row = await DebtorModel.findByCaseRef(caseRef)
    if (!row) return c.json({ error: 'Not found' }, 404)
    return c.json(row)
  }

  static async getById(c: Context) {
    const row = await DebtorModel.findById(paramId(c))
    if (!row) return c.json({ error: 'Not found' }, 404)
    return c.json(row)
  }

  static async create(c: Context) {
    const body = await c.req.json()
    const { caseRef, orgId, debtorName, country, debtAmount } = body

    if (!caseRef || !orgId || !debtorName || !country || debtAmount == null) {
      return c.json(
        {
          error:
            'Missing required fields: caseRef, orgId, debtorName, country, debtAmount',
        },
        400,
      )
    }

    const row = await DebtorModel.create(body)
    return c.json(row, 201)
  }

  static async bulkCreate(c: Context) {
    const { orgId, rows } = await c.req.json()

    if (!orgId || !rows?.length) {
      return c.json({ error: 'orgId and rows[] required' }, 400)
    }

    const inserted = await DebtorModel.bulkCreate(orgId, rows)
    return c.json({ imported: inserted.length }, 201)
  }

  static async update(c: Context) {
    const row = await DebtorModel.update(paramId(c), await c.req.json())
    if (!row) return c.json({ error: 'Not found' }, 404)
    return c.json(row)
  }

  static async remove(c: Context) {
    const row = await DebtorModel.delete(paramId(c))
    if (!row) return c.json({ error: 'Not found' }, 404)
    return c.json({ deleted: true })
  }

  /** POST /:id/enrich — start enrichment pipeline (manual). */
  static async startEnrich(c: Context) {
    const id = paramId(c)
    const debtor = await DebtorModel.findById(id)
    if (!debtor) return c.json({ error: 'Not found' }, 404)
    if (debtor.enrichmentStatus === 'running') {
      return c.json({ error: 'Enrichment already running' }, 409)
    }

    await DebtorModel.update(id, {
      enrichmentStatus: 'running',
      enrichmentError: null,
    })

    try {
      const run = await triggerDebtorEnrichment({ debtorId: debtor.id })
      const fresh = await DebtorModel.findById(id)
      return c.json({
        runId: run.id,
        publicAccessToken: run.publicAccessToken,
        debtor: fresh,
      })
    } catch (e) {
      const detail = formatEnrichmentFailure(e)
      await DebtorModel.update(id, {
        enrichmentStatus: 'failed',
        enrichmentError: `Failed to start enrichment: ${detail}`,
      })
      return c.json({ error: `Failed to start enrichment: ${detail}` }, 500)
    }
  }

  /** POST /:id/ai-call — fake AI agent call (demo). */
  static async startAiCall(c: Context) {
    const id = paramId(c)
    const debtor = await DebtorModel.findById(id)
    if (!debtor) return c.json({ error: 'Not found' }, 404)

    const callId = crypto.randomUUID()
    return c.json({
      callId,
      debtorId: debtor.id,
      status: 'initiated',
      message: `AI agent call initiated for ${debtor.debtorName}`,
    })
  }

  /** POST /enrich-batch — start enrichment for many debtors (manual). */
  static async enrichBatch(c: Context) {
    const body = await c.req.json()
    const debtorIds: unknown = body?.debtorIds
    if (!Array.isArray(debtorIds) || debtorIds.length === 0) {
      return c.json({ error: 'debtorIds[] required' }, 400)
    }

    const started: string[] = []
    const skipped: string[] = []
    const errors: Array<{ id: string; error: string }> = []

    for (const raw of debtorIds) {
      const id = typeof raw === 'string' ? raw : ''
      if (!id) continue

      const debtor = await DebtorModel.findById(id)
      if (!debtor) {
        errors.push({ id, error: 'Not found' })
        continue
      }
      if (debtor.enrichmentStatus === 'running') {
        skipped.push(id)
        continue
      }

      await DebtorModel.update(id, {
        enrichmentStatus: 'running',
        enrichmentError: null,
      })
      try {
        await triggerDebtorEnrichment({ debtorId: debtor.id })
        started.push(id)
      } catch (e) {
        const detail = formatEnrichmentFailure(e)
        await DebtorModel.update(id, {
          enrichmentStatus: 'failed',
          enrichmentError: `Failed to start enrichment: ${detail}`,
        })
        errors.push({ id, error: detail })
      }
    }

    return c.json({ started: started.length, skipped, errors })
  }
}

export class StatusEventController {
  static async setStatus(c: Context) {
    const { status, note, author } = await c.req.json()

    if (!status || !author) {
      return c.json({ error: 'status and author required' }, 400)
    }

    const event = await StatusEventModel.setStatus(
      paramId(c),
      status,
      note,
      author,
    )
    if (!event) return c.json({ error: 'Not found' }, 404)
    return c.json(event, 201)
  }

  static async list(c: Context) {
    const rows = await StatusEventModel.findByDebtor(paramId(c))
    return c.json(rows)
  }
}

export class EnrichedFieldController {
  static async list(c: Context) {
    const rows = await EnrichedFieldModel.findByDebtor(paramId(c))
    return c.json(rows)
  }

  static async upsert(c: Context) {
    const id = paramId(c)
    const { fieldName, value, traceSteps } = await c.req.json()

    if (!fieldName) {
      return c.json({ error: 'fieldName required' }, 400)
    }

    const field = await EnrichedFieldModel.upsert(id, fieldName, value, traceSteps)
    return c.json(field, 201)
  }
}

import type { Context } from 'hono'
import { TranscriptModel } from '../models/transcript.model.js'

export class TranscriptController {
  static async list(c: Context) {
    const orgId = c.req.query('orgId')
    if (!orgId) return c.json({ error: 'orgId is required' }, 400)

    try {
      const rows = await TranscriptModel.findAllByOrg(orgId)
      return c.json(rows)
    } catch (error) {
      console.error('Error listing transcripts:', error)
      return c.json({ error: 'Failed to list transcripts' }, 500)
    }
  }

  static async getById(c: Context) {
    const id = c.req.param('id')
    if (!id) return c.json({ error: 'id is required' }, 400)

    try {
      const row = await TranscriptModel.findById(id)
      if (!row) return c.json({ error: 'Transcript not found' }, 404)
      return c.json(row)
    } catch (error) {
      console.error('Error fetching transcript:', error)
      return c.json({ error: 'Failed to fetch transcript' }, 500)
    }
  }

  static async getByDebtor(c: Context) {
    const debtorId = c.req.param('debtorId')
    if (!debtorId) return c.json({ error: 'debtorId is required' }, 400)

    try {
      const rows = await TranscriptModel.findByDebtor(debtorId)
      return c.json(rows)
    } catch (error) {
      console.error('Error fetching debtor transcripts:', error)
      return c.json({ error: 'Failed to fetch debtor transcripts' }, 500)
    }
  }

  static async create(c: Context) {
    try {
      const body = await c.req.json()

      const { debtorId, orgId, transcript, callStartTime, callEndTime, durationSeconds } = body

      if (!debtorId || !orgId || !transcript || !callStartTime || !callEndTime) {
        return c.json(
          {
            error:
              'Missing required fields: debtorId, orgId, transcript, callStartTime, callEndTime',
          },
          400,
        )
      }

      const row = await TranscriptModel.create({
        debtorId,
        orgId,
        transcript,
        callStartTime,
        callEndTime,
        durationSeconds,
      })

      return c.json(row, 201)
    } catch (error) {
      console.error('Error creating transcript:', error)
      return c.json({ error: 'Failed to create transcript' }, 500)
    }
  }
}

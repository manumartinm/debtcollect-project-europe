import { eq, desc } from 'drizzle-orm'
import { db } from '../db/client.js'
import { callTranscripts } from '../db/schema.js'

export class TranscriptModel {
  static async findAllByOrg(orgId: string) {
    return db.query.callTranscripts.findMany({
      where: eq(callTranscripts.orgId, orgId),
      orderBy: [desc(callTranscripts.callStartTime)],
      with: {
        debtor: true,
      },
    })
  }

  static async findById(id: string) {
    return db.query.callTranscripts.findFirst({
      where: eq(callTranscripts.id, id),
      with: {
        debtor: true,
        organization: true,
      },
    })
  }

  static async findByDebtor(debtorId: string) {
    return db.query.callTranscripts.findMany({
      where: eq(callTranscripts.debtorId, debtorId),
      orderBy: [desc(callTranscripts.callStartTime)],
    })
  }

  static async create(body: Record<string, unknown>) {
    const {
      debtorId,
      orgId,
      transcript,
      callStartTime,
      callEndTime,
      durationSeconds,
    } = body as {
      debtorId: string
      orgId: string
      transcript: string
      callStartTime: string | Date
      callEndTime: string | Date
      durationSeconds?: number
    }

    if (!debtorId || !orgId || !transcript || !callStartTime || !callEndTime) {
      throw new Error(
        'Missing required fields: debtorId, orgId, transcript, callStartTime, callEndTime',
      )
    }

    const [row] = await db
      .insert(callTranscripts)
      .values({
        debtorId,
        orgId,
        transcript,
        callStartTime: new Date(callStartTime),
        callEndTime: new Date(callEndTime),
        durationSeconds,
      })
      .returning({ id: callTranscripts.id })

    return TranscriptModel.findById(row.id)
  }
}

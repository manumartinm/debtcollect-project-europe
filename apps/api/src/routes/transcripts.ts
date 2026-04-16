import { Hono } from 'hono'
import { TranscriptController } from '../controllers/transcript.controller.js'

export const transcriptsRouter = new Hono()

transcriptsRouter.get('/', TranscriptController.list)
transcriptsRouter.post('/', TranscriptController.create)
transcriptsRouter.get('/:id', TranscriptController.getById)
transcriptsRouter.get('/debtor/:debtorId', TranscriptController.getByDebtor)

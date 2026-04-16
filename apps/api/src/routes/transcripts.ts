import { Hono } from 'hono'
import { TranscriptController } from '../controllers/transcript.controller.js'

export const transcriptsRouter = new Hono()

transcriptsRouter.get('/', TranscriptController.list)
transcriptsRouter.post('/', TranscriptController.create)
/** Must be registered before `/:id` so `debtor` is not captured as an id. */
transcriptsRouter.get('/debtor/:debtorId', TranscriptController.getByDebtor)
transcriptsRouter.get('/:id', TranscriptController.getById)

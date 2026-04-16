import { Hono } from 'hono'
import {
  DebtorController,
  StatusEventController,
  EnrichedFieldController,
} from '../controllers/debtor.controller.js'

export const debtorsRouter = new Hono()

debtorsRouter.get('/', DebtorController.list)
debtorsRouter.post('/', DebtorController.create)
debtorsRouter.post('/bulk', DebtorController.bulkCreate)
debtorsRouter.post('/enrich-batch', DebtorController.enrichBatch)

debtorsRouter.get('/by-case-ref/:caseRef', DebtorController.getByCaseRef)

debtorsRouter.get('/:id/status-events', StatusEventController.list)
debtorsRouter.post('/:id/status', StatusEventController.setStatus)
debtorsRouter.get('/:id/enriched-fields', EnrichedFieldController.list)
debtorsRouter.post('/:id/enriched-fields', EnrichedFieldController.upsert)
debtorsRouter.post('/:id/enrich', DebtorController.startEnrich)
debtorsRouter.post('/:id/ai-call', DebtorController.startAiCall)

debtorsRouter.get('/:id', DebtorController.getById)
debtorsRouter.patch('/:id', DebtorController.update)
debtorsRouter.delete('/:id', DebtorController.remove)

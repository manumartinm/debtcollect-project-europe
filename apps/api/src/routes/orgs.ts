import { Hono } from 'hono'
import { OrganizationController, MemberController } from '../controllers/org.controller.js'

export const orgsRouter = new Hono()

orgsRouter.get('/', OrganizationController.list)
orgsRouter.get('/mine', OrganizationController.listMine)
orgsRouter.post('/', OrganizationController.create)

orgsRouter.get('/:orgId/members', MemberController.list)
orgsRouter.post('/:orgId/members', MemberController.add)
orgsRouter.patch('/:orgId/members/:memberId', MemberController.updateRole)
orgsRouter.delete('/:orgId/members/:memberId', MemberController.remove)

orgsRouter.get('/:id', OrganizationController.getById)
orgsRouter.patch('/:id', OrganizationController.update)

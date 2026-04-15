import type { Context } from 'hono'
import { OrganizationModel, MemberModel } from '../models/org.model.js'

function paramOrgId(c: Context): string {
  return c.req.param('orgId')!
}

function paramMemberId(c: Context): string {
  return c.req.param('memberId')!
}

export class OrganizationController {
  static async list(c: Context) {
    const rows = await OrganizationModel.findAll()
    return c.json(rows)
  }

  static async getById(c: Context) {
    const id = c.req.param('id')!
    const row = await OrganizationModel.findById(id)
    if (!row) return c.json({ error: 'Not found' }, 404)
    return c.json(row)
  }

  static async create(c: Context) {
    const body = await c.req.json()
    const { name, slug } = body
    if (!name || !slug) {
      return c.json({ error: 'name and slug required' }, 400)
    }
    const existing = await OrganizationModel.findBySlug(slug)
    if (existing) {
      return c.json({ error: 'slug already taken' }, 409)
    }
    const row = await OrganizationModel.create({ name, slug })
    return c.json(row, 201)
  }

  static async update(c: Context) {
    const id = c.req.param('id')!
    const patch = await c.req.json()
    const row = await OrganizationModel.update(id, patch)
    if (!row) return c.json({ error: 'Not found' }, 404)
    return c.json(row)
  }
}

export class MemberController {
  static async list(c: Context) {
    const rows = await MemberModel.findByOrgWithUser(paramOrgId(c))
    return c.json(rows)
  }

  static async add(c: Context) {
    const { userId, role } = await c.req.json()
    if (!userId) {
      return c.json({ error: 'userId required' }, 400)
    }
    try {
      const row = await MemberModel.add(
        paramOrgId(c),
        userId,
        role ?? 'collector',
      )
      return c.json(row, 201)
    } catch {
      return c.json({ error: 'Could not add member' }, 400)
    }
  }

  static async updateRole(c: Context) {
    const { role } = await c.req.json()
    if (!role) return c.json({ error: 'role required' }, 400)
    const row = await MemberModel.updateRole(
      paramOrgId(c),
      paramMemberId(c),
      role,
    )
    if (!row) return c.json({ error: 'Not found' }, 404)
    return c.json(row)
  }

  static async remove(c: Context) {
    const row = await MemberModel.remove(paramOrgId(c), paramMemberId(c))
    if (!row) return c.json({ error: 'Not found' }, 404)
    return c.json({ deleted: true })
  }
}

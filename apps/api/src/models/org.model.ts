import { eq, and } from 'drizzle-orm'
import { db } from '../db/client.js'
import { organizations, members, user } from '../db/schema.js'

export class OrganizationModel {
  static async findAll() {
    return db.select().from(organizations)
  }

  /** Organizations the user belongs to (via members). */
  static async findByUserId(userId: string) {
    const rows = await db
      .select({ org: organizations })
      .from(members)
      .innerJoin(organizations, eq(organizations.id, members.orgId))
      .where(eq(members.userId, userId))
    return rows.map((r) => r.org)
  }

  static async findById(id: string) {
    const [row] = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1)
    return row ?? null
  }

  static async findBySlug(slug: string) {
    const [row] = await db.select().from(organizations).where(eq(organizations.slug, slug)).limit(1)
    return row ?? null
  }

  static async create(data: { name: string; slug: string }) {
    const [row] = await db.insert(organizations).values(data).returning()
    return row
  }

  static async update(id: string, patch: Partial<{ name: string; slug: string }>) {
    const [row] = await db
      .update(organizations)
      .set(patch)
      .where(eq(organizations.id, id))
      .returning()
    return row ?? null
  }
}

export class MemberModel {
  static async findByOrgWithUser(orgId: string) {
    const rows = await db
      .select({
        id: members.id,
        orgId: members.orgId,
        userId: members.userId,
        role: members.role,
        createdAt: members.createdAt,
        userName: user.name,
        userEmail: user.email,
        userImage: user.image,
      })
      .from(members)
      .innerJoin(user, eq(members.userId, user.id))
      .where(eq(members.orgId, orgId))

    return rows.map((r) => ({
      id: r.id,
      orgId: r.orgId,
      userId: r.userId,
      role: r.role as 'admin' | 'collector' | 'viewer',
      createdAt: r.createdAt,
      user: {
        id: r.userId,
        name: r.userName,
        email: r.userEmail,
        image: r.userImage,
      },
    }))
  }

  static async add(orgId: string, userId: string, role: string) {
    const [row] = await db
      .insert(members)
      .values({ orgId, userId, role })
      .returning()
    return row
  }

  static async updateRole(orgId: string, memberId: string, role: string) {
    const [row] = await db
      .update(members)
      .set({ role })
      .where(and(eq(members.id, memberId), eq(members.orgId, orgId)))
      .returning()
    return row ?? null
  }

  static async remove(orgId: string, memberId: string) {
    const [row] = await db
      .delete(members)
      .where(and(eq(members.id, memberId), eq(members.orgId, orgId)))
      .returning({ id: members.id })
    return row ?? null
  }
}

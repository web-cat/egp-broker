import prisma from '@@/lib/prisma'
import type { UserRow } from '@@/shared/models/user'

/**
 * Validates and retrieves all users, formatted as strict UserRows.
 */
export async function getAllUsers(): Promise<UserRow[]> {
    const users = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' }
    })

    return users.map((u) => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        globalRole: u.globalRole,
        avatarUrl: u.avatarUrl,
        createdAt: u.createdAt.toISOString(),
        emailVerified: u.emailVerified
    }))
}

/**
 * Retrieves a single user by ID, formatted as strict UserRow.
 */
export async function getUser(id: string): Promise<UserRow | null> {
    const u = await prisma.user.findUnique({
        where: { id }
    })

    if (!u) return null

    return {
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        globalRole: u.globalRole,
        avatarUrl: u.avatarUrl,
        createdAt: u.createdAt.toISOString(),
        emailVerified: u.emailVerified
    }
}

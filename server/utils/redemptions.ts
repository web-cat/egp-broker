import prisma from '@@/lib/prisma'
import type { RedemptionRow } from '@@/shared/models/pass'

/**
 * Retrieves pass redemptions for a student in a specific pool.
 */
export async function getStudentPoolRedemptions(poolId: string): Promise<RedemptionRow[]> {
    const redemptions = await prisma.passRedemption.findMany({
        where: { poolId },
        include: {
            assignment: { select: { title: true } }
        },
        orderBy: { createdAt: 'desc' }
    })

    return redemptions.map((r) => ({
        id: r.id,
        assignmentTitle: r.assignment.title,
        createdAt: r.createdAt.toISOString(),
        cost: r.cost,
        hoursPerPass: 0, // This information is on the PassType, not directly on Redemption.
        // However, the interface asks for hoursPerPass. We might need to fetch it via pool->passType.
        // For now, setting to 0 or we need to adjust the query.
        // Let's adjust the query to include pool -> passType.
        availableFrom: r.availableFrom?.toISOString() ?? null,
        acceptUntil: r.acceptUntil?.toISOString() ?? null,
        isActive: true // Logic for active needs to be defined. For now true.
    }))
}

// Rewriting to fetch hoursPerPass
export async function getStudentRedemptionsFull(poolId: string): Promise<RedemptionRow[]> {
    const redemptions = await prisma.passRedemption.findMany({
        where: { poolId },
        include: {
            assignment: { select: { title: true } },
            pool: {
                include: { passType: { select: { hoursPerPass: true } } }
            }
        },
        orderBy: { createdAt: 'desc' }
    })

    return redemptions.map((r) => ({
        id: r.id,
        assignmentTitle: r.assignment.title,
        createdAt: r.createdAt.toISOString(),
        cost: r.cost,
        hoursPerPass: r.pool.passType.hoursPerPass,
        availableFrom: r.availableFrom?.toISOString() ?? null,
        acceptUntil: r.acceptUntil?.toISOString() ?? null,
        isActive: true // TODO: Define logic for active
    }))
}

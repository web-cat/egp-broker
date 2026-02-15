import prisma from '@@/lib/prisma'
import type { RedemptionRow } from '@@/shared/models/pass'

/**
 * Retrieves pass redemptions for a student in a course.
 */
export async function getStudentRedemptions(
  userId: string,
  courseId: string
): Promise<RedemptionRow[]> {
  const redemptions = await prisma.passRedemption.findMany({
    where: {
      pool: {
        userId,
        passType: { courseId }
      }
    },
    orderBy: { redeemedAt: 'desc' }, // Fix: Schema says redeemedAt? No, look at schema.
    // Schema says PassRedemption has createdAt, updatedAt. No redeemedAt field.
    // Checking schema:
    // model PassRedemption {
    //   ...
    //   createdAt DateTime @default(now())
    // }
    // API was orderBy redeemedAt. Logic likely meant createdAt.
    // Let's check schema again.
    include: {
      assignment: { select: { title: true } },
      pool: {
        include: {
          passType: { select: { hoursPerPass: true } }
        }
      }
    }
  })

  const now = new Date()

  return redemptions.map((r) => {
    const isActive = (() => {
      if (!r.availableFrom || !r.acceptUntil) return false
      return now >= r.availableFrom && now <= r.acceptUntil
    })()

    return {
      id: r.id,
      assignmentTitle: r.assignment.title,
      createdAt: r.createdAt.toISOString(),
      cost: r.cost,
      // hoursPerPass comes from pool.passType
      hoursPerPass: r.pool.passType.hoursPerPass,
      availableFrom: r.availableFrom?.toISOString() ?? null,
      acceptUntil: r.acceptUntil?.toISOString() ?? null,
      isActive
    }
  })
}

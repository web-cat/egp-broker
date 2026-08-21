import prisma from '@@/server/utils/db'
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
    orderBy: { createdAt: 'desc' },
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

  return redemptions.map((r: any) => {
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

/**
 * Redeems a pass for a student on an assignment.
 */
export async function redeemPass(
  userId: string,
  assignmentId: string,
  passTypeId: string,
  promptResponses?: Record<string, any>
) {
  return await prisma.$transaction(async (tx) => {
    // 1. Get pool and verify balance
    const pool = await tx.studentPassPool.findUnique({
      where: { userId_passTypeId: { userId, passTypeId } },
      include: { passType: true }
    })

    if (!pool || pool.balance <= 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Insufficient pass balance'
      })
    }

    // 2. Get assignment and verify eligibility
    const assignment = await tx.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        passEligibilities: {
          where: { passTypeId }
        }
      }
    })

    if (!assignment || assignment.passEligibilities.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Assignment is not eligible for this pass type'
      })
    }

    // 3. Calculate new dates
    // For now, we only extend the due date and acceptUntil by hoursPerPass.
    // In a more complex system, we might have different logic for availableFrom etc.
    const hours = pool.passType.hoursPerPass
    const msToAdd = hours * 60 * 60 * 1000

    const currentDueDate = assignment.dueDate || new Date()
    const currentAcceptUntil = assignment.acceptUntil || currentDueDate

    const newDueDate = new Date(currentDueDate.getTime() + msToAdd)
    const newAcceptUntil = new Date(currentAcceptUntil.getTime() + msToAdd)

    // 4. Create redemption record
    const redemption = await tx.passRedemption.create({
      data: {
        poolId: pool.id,
        assignmentId,
        cost: 1,
        dueDate: newDueDate,
        acceptUntil: newAcceptUntil,
        promptResponsesJson: (promptResponses as any) || undefined
      }
    })

    // 5. Deduct pass from pool
    await tx.studentPassPool.update({
      where: { id: pool.id },
      data: { balance: { decrement: 1 } }
    })

    return redemption
  })
}

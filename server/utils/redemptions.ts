import { createError } from 'h3'
import prisma from '@@/server/utils/db'
import type { RedemptionRow } from '@@/shared/models/pass'
import { calculatePassExtension } from '@@/shared/utils/extension'
import { resolveStudentEffectiveDates } from '@@/server/utils/overrides'
import { notifyPassRedemption } from '@@/server/services/alert.service'

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
      dueDate: r.dueDate?.toISOString() ?? null,
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
  let alertData: {
    userName?: string | null
    userEmail?: string | null
    passTypeName: string
    assignmentTitle: string
    courseName?: string | null
    cost: number
  } | null = null

  const redemption = await prisma.$transaction(async (tx) => {
    // 1. Get pool and verify initial balance
    const pool = await tx.studentPassPool.findUnique({
      where: { userId_passTypeId: { userId, passTypeId } },
      include: {
        passType: {
          include: { course: true }
        },
        user: true
      }
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

    // 3. Resolve effective baseline dates for student (taking individual/section overrides into account)
    const effectiveDates = await resolveStudentEffectiveDates(
      assignment,
      userId,
      pool.passType.courseId
    )

    // 4. Find latest redemption for this student & assignment
    const latestRedemption = await tx.passRedemption.findFirst({
      where: {
        pool: { userId },
        assignmentId
      },
      orderBy: { createdAt: 'desc' }
    })

    // 5. Calculate extension dates and required pass cost
    const extension = calculatePassExtension({
      assignment: {
        dueDate: effectiveDates.dueDate,
        availableFrom: effectiveDates.availableFrom,
        acceptUntil: effectiveDates.acceptUntil
      },
      passType: pool.passType,
      latestRedemption,
      now: new Date()
    })

    if (!extension.isEligible) {
      throw createError({
        statusCode: 400,
        statusMessage: extension.reason || 'Assignment is not eligible for redemption at this time'
      })
    }

    if (pool.balance < extension.cost) {
      throw createError({
        statusCode: 400,
        statusMessage: `Insufficient pass balance. You need ${extension.cost} pass(es) to extend past the current time.`
      })
    }

    // 5. Create redemption record
    const newRedemption = await tx.passRedemption.create({
      data: {
        poolId: pool.id,
        assignmentId,
        cost: extension.cost,
        availableFrom: extension.newAvailableFrom,
        dueDate: extension.newDueDate,
        acceptUntil: extension.newAcceptUntil,
        promptResponsesJson: (promptResponses as any) || undefined
      }
    })

    // 6. Deduct required passes from pool
    await tx.studentPassPool.update({
      where: { id: pool.id },
      data: { balance: { decrement: extension.cost } }
    })

    alertData = {
      userName: pool.user?.name,
      userEmail: pool.user?.email,
      passTypeName: pool.passType?.name || 'Pass',
      assignmentTitle: assignment.title,
      courseName: pool.passType?.course?.name,
      cost: extension.cost
    }

    return newRedemption
  })

  if (alertData) {
    try {
      await notifyPassRedemption({
        userName: alertData.userName,
        userEmail: alertData.userEmail,
        passTypeName: alertData.passTypeName,
        assignmentTitle: alertData.assignmentTitle,
        courseName: alertData.courseName,
        cost: alertData.cost,
        newDueDate: redemption.dueDate
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[redemption-alert] Failed to trigger redemption notification:', message)
    }
  }

  return redemption
}

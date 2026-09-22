import { createError } from 'h3'
import prisma from '@@/server/utils/db'
import type { RedemptionRow } from '@@/shared/models/pass'
import type { RepairCbtfRedemptionsResponse } from '@@/shared/schemas/cbtf.schema'
import { calculatePassExtension } from '@@/shared/utils/extension'
import { resolveStudentEffectiveDates } from '@@/server/utils/overrides'
import { notifyPassRedemption, notifyPassPortSyncFailure } from '@@/server/services/alert.service'
import {
  buildPassPortExtensionPayload,
  sendPassPortExtension,
  sendPassPortRollback
} from '@@/server/utils/passport'

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
      if (r.availableFrom && r.acceptUntil) {
        return now >= r.availableFrom && now <= r.acceptUntil
      }
      if (r.acceptUntil) return now <= r.acceptUntil
      if (r.dueDate) return now <= r.dueDate
      return false
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

  let passportDispatchedTool: {
    passportExtensionUrl?: string | null
    passportClientId?: string | null
    passportClientSecret?: string | null
  } | null = null
  let passportDispatchedRequestId: string | null = null

  try {
    const redemption = await prisma.$transaction(async (tx) => {
      // 1. Get pool and verify initial balance (lazily provision if pool does not exist yet)
      let pool = await tx.studentPassPool.findUnique({
        where: { userId_passTypeId: { userId, passTypeId } },
        include: {
          passType: {
            include: { course: true }
          },
          user: {
            include: {
              ltiIdentities: true
            }
          }
        }
      })

      if (!pool) {
        const passType = await tx.passType.findUnique({
          where: { id: passTypeId },
          include: { course: true }
        })

        if (!passType) {
          throw createError({
            statusCode: 404,
            statusMessage: 'Pass type not found'
          })
        }

        const user = await tx.user.findUnique({
          where: { id: userId },
          include: {
            ltiIdentities: true
          }
        })

        if (!user) {
          throw createError({
            statusCode: 404,
            statusMessage: 'User not found'
          })
        }

        pool = await tx.studentPassPool.create({
          data: {
            userId,
            passTypeId,
            balance: passType.initialBalance
          },
          include: {
            passType: {
              include: { course: true }
            },
            user: {
              include: {
                ltiIdentities: true
              }
            }
          }
        })
      }

      if (pool.balance <= 0) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Insufficient pass balance'
        })
      }

      // 2. Get assignment and verify eligibility
      const assignment = await tx.assignment.findUnique({
        where: { id: assignmentId },
        include: {
          tool: {
            include: {
              platform: true
            }
          },
          course: {
            include: {
              deployment: {
                include: {
                  platform: true
                }
              }
            }
          },
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

      // 2b. If assignment requires interviews and pass is a resubmission pass (!pool.passType.extensionOnly),
      // verify student has completed an interview
      if (assignment.hasInterviews && !pool.passType.extensionOnly) {
        const completedInterview = await tx.gtaInterviewReservation.findFirst({
          where: {
            assignmentId,
            studentId: userId,
            status: { in: ['COMPLETED', 'CHECKED_OUT'] }
          }
        })

        if (!completedInterview) {
          throw createError({
            statusCode: 400,
            statusMessage:
              'This assignment requires a completed grading interview with a Graduate TA before redeeming a resubmission pass. Please schedule and complete your interview first.'
          })
        }
      }

      // 3. Resolve effective baseline dates for student (taking individual/section overrides into account)
      const effectiveDates = await resolveStudentEffectiveDates(
        assignment,
        userId,
        pool.passType.courseId
      )

      // 4. Find prior redemptions count and latest redemption for this student & assignment
      const priorRedemptionsCount =
        typeof tx.passRedemption?.count === 'function'
          ? await tx.passRedemption.count({
              where: {
                pool: { userId },
                assignmentId
              }
            })
          : 0

      const maxAllowed = pool.passType.maxRedemptionsPerAssignment ?? 1
      if (priorRedemptionsCount >= maxAllowed) {
        throw createError({
          statusCode: 400,
          statusMessage: `You have reached the maximum number of passes (${maxAllowed}) allowed for this assignment.`
        })
      }

      const latestRedemption =
        priorRedemptionsCount > 0
          ? await tx.passRedemption.findFirst({
              where: {
                pool: { userId },
                assignmentId
              },
              orderBy: { createdAt: 'desc' }
            })
          : null

      // 5. Calculate extension dates and required pass cost
      const extension = calculatePassExtension({
        assignment: {
          dueDate: effectiveDates.dueDate,
          availableFrom: effectiveDates.availableFrom,
          acceptUntil: effectiveDates.acceptUntil
        },
        passType: pool.passType,
        latestRedemption,
        priorRedemptionsCount,
        now: new Date()
      })

      if (!extension.isEligible) {
        throw createError({
          statusCode: 400,
          statusMessage:
            extension.reason || 'Assignment is not eligible for redemption at this time'
        })
      }

      if (pool.balance < extension.cost) {
        throw createError({
          statusCode: 400,
          statusMessage: `Insufficient pass balance. You need ${extension.cost} pass(es) to extend past the current time.`
        })
      }

      // 6. If tool supports PassPort extensions, perform pre-check & dispatch
      const tool = assignment.tool
      if (tool?.supportsPassport) {
        const studentDisplayName =
          pool.user?.firstName && pool.user?.lastName
            ? `${pool.user.firstName} ${pool.user.lastName}`
            : pool.user?.email || null

        const courseLabel =
          assignment.course?.label || assignment.course?.title || pool.passType?.course?.name

        if (
          tool.passportRegistrationStatus !== 'REGISTERED' ||
          !tool.passportExtensionUrl ||
          !tool.passportClientSecret
        ) {
          await notifyPassPortSyncFailure({
            toolName: tool.name || 'External Tool',
            assignmentTitle: assignment.title || 'Assignment',
            courseLabel,
            studentName: studentDisplayName,
            studentEmail: pool.user?.email,
            error:
              'External tool is configured for PassPort but registration status is not REGISTERED or credentials are missing.'
          }).catch(() => {})

          throw createError({
            statusCode: 502,
            statusMessage:
              'External tool is not registered for PassPort extensions. Please contact your instructor.'
          })
        }

        // Fetch enrollment for course role if available
        const enrollment = await tx.enrollment.findUnique({
          where: {
            userId_courseId: {
              userId,
              courseId: pool.passType.courseId
            }
          }
        })

        const platformId = assignment.course?.deployment?.platformId || tool.platformId
        const ltiIdentity =
          pool.user?.ltiIdentities?.find((i: any) => i.platformId === platformId) ||
          pool.user?.ltiIdentities?.[0]

        const ltiUserId = ltiIdentity?.ltiSub || pool.user.id
        const platform = assignment.course?.deployment?.platform || tool.platform

        const payload = buildPassPortExtensionPayload({
          context: {
            lmsInstanceGuid:
              assignment.course?.deployment?.deploymentHost || platform?.issuer || 'egp-broker',
            issuer: platform?.issuer || 'https://canvas.instructure.com',
            ltiContextId: assignment.course?.ltiContextId || assignment.courseId,
            lmsInstance: platform?.name || assignment.course?.deployment?.deploymentHost || null,
            ltiDeploymentId: assignment.course?.deployment?.deploymentId || null,
            canvasCourseId: assignment.course?.canvasCourseId || null
          },
          user: {
            ltiUserId,
            brokerUserId: pool.user.id,
            canvasUserId: ltiIdentity?.platformUserId || null,
            firstName: pool.user.firstName || null,
            lastName: pool.user.lastName || null,
            email: pool.user.email || null,
            displayName: studentDisplayName,
            courseRole: enrollment?.role || null
          },
          resource: {
            ltiResourceLinkId: assignment.resourceLinkId || assignment.id,
            brokerAssignmentId: assignment.id,
            canvasAssignmentId: assignment.canvasAssignmentId || null,
            title: assignment.title || null
          },
          extension: {
            passType: pool.passType.name,
            originalAvailableFrom: effectiveDates.availableFrom,
            newAvailableFrom: extension.newAvailableFrom,
            originalDueDate: effectiveDates.dueDate,
            newDueDate: extension.newDueDate,
            originalAcceptUntil: effectiveDates.acceptUntil,
            newAcceptUntil: extension.newAcceptUntil,
            appliedAt: new Date()
          },
          requestedProperties: (tool.passportRequestedProperties as string[]) || null
        })

        try {
          await sendPassPortExtension(tool, payload)
          passportDispatchedTool = tool
          passportDispatchedRequestId = payload.request_id
        } catch (toolErr: unknown) {
          const errMsg = toolErr instanceof Error ? toolErr.message : String(toolErr)
          await notifyPassPortSyncFailure({
            toolName: tool.name || 'External Tool',
            assignmentTitle: assignment.title || 'Assignment',
            courseLabel,
            studentName: studentDisplayName,
            studentEmail: pool.user?.email,
            error: errMsg,
            requestId: payload.request_id
          }).catch(() => {})

          throw createError({
            statusCode: 502,
            statusMessage:
              'External tool extension sync failed. Please contact your instructor for assistance.'
          })
        }
      }

      // 7. Create redemption record
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

      // 8. Deduct required passes from pool
      await tx.studentPassPool.update({
        where: { id: pool.id },
        data: { balance: { decrement: extension.cost } }
      })

      alertData = {
        userName:
          pool.user?.firstName && pool.user?.lastName
            ? `${pool.user.firstName} ${pool.user.lastName}`
            : pool.user?.email,
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
          newDueDate: redemption.dueDate || redemption.acceptUntil
        })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('[redemption-alert] Failed to trigger redemption notification:', message)
      }
    }

    return redemption
  } catch (err: unknown) {
    if (passportDispatchedTool && passportDispatchedRequestId) {
      try {
        await sendPassPortRollback(passportDispatchedTool, passportDispatchedRequestId)
      } catch (rollbackErr: unknown) {
        const rbMsg = rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr)
        console.error('[passport-rollback] Failed to rollback extension on external tool:', rbMsg)
      }
    }
    throw err
  }
}

/**
 * Repairs PassRedemption records for a CBTF assignment whose deadline windows
 * were calculated against an individual CBTF reservation slot rather than the
 * true assignment/section baseline due date.
 */
export async function repairAssignmentCbtfPassRedemptions(
  assignmentId: string
): Promise<RepairCbtfRedemptionsResponse> {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: {
      id: true,
      courseId: true,
      isSchedulable: true,
      title: true,
      dueDate: true,
      availableFrom: true,
      acceptUntil: true
    }
  })

  if (!assignment) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Assignment not found'
    })
  }

  if (!assignment.isSchedulable) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Assignment is not configured for CBTF scheduling'
    })
  }

  const redemptions = await prisma.passRedemption.findMany({
    where: { assignmentId },
    include: {
      pool: {
        include: {
          passType: true,
          user: true
        }
      }
    },
    orderBy: { createdAt: 'asc' }
  })

  let totalRepaired = 0
  let alreadyCorrect = 0
  let errors = 0
  const details: RepairCbtfRedemptionsResponse['details'] = []

  // Group by student to track prior redemptions sequentially
  const studentRedemptionsMap = new Map<string, typeof redemptions>()
  for (const r of redemptions) {
    const list = studentRedemptionsMap.get(r.pool.userId) || []
    list.push(r)
    studentRedemptionsMap.set(r.pool.userId, list)
  }

  for (const [userId, studentReds] of studentRedemptionsMap.entries()) {
    // Resolve baseline dates for this student (excluding CBTF overrides)
    const effectiveDates = await resolveStudentEffectiveDates(
      assignment,
      userId,
      assignment.courseId
    )

    let priorRedemptionForStudent: any = null
    let priorCount = 0

    for (const r of studentReds) {
      const studentName =
        [r.pool.user.firstName, r.pool.user.lastName].filter(Boolean).join(' ').trim() ||
        r.pool.user.email ||
        userId

      try {
        const extension = calculatePassExtension({
          assignment: {
            dueDate: effectiveDates.dueDate,
            availableFrom: effectiveDates.availableFrom,
            acceptUntil: effectiveDates.acceptUntil
          },
          passType: r.pool.passType,
          latestRedemption: priorRedemptionForStudent,
          priorRedemptionsCount: priorCount,
          now: r.createdAt
        })

        if (!extension.isEligible) {
          details.push({
            redemptionId: r.id,
            studentName,
            studentEmail: r.pool.user.email,
            oldDueDate: r.dueDate?.toISOString() ?? null,
            newDueDate: r.dueDate?.toISOString() ?? null,
            oldAcceptUntil: r.acceptUntil?.toISOString() ?? null,
            newAcceptUntil: r.acceptUntil?.toISOString() ?? null,
            status: 'already_correct',
            message: extension.reason
          })
          alreadyCorrect++
          priorRedemptionForStudent = r
          priorCount++
          continue
        }

        const oldDueIso = r.dueDate?.toISOString() ?? null
        const newDueIso = extension.newDueDate?.toISOString() ?? null
        const oldAcceptIso = r.acceptUntil?.toISOString() ?? null
        const newAcceptIso = extension.newAcceptUntil?.toISOString() ?? null

        const changed = oldDueIso !== newDueIso || oldAcceptIso !== newAcceptIso

        if (changed) {
          await prisma.passRedemption.update({
            where: { id: r.id },
            data: {
              dueDate: extension.newDueDate,
              acceptUntil: extension.newAcceptUntil,
              availableFrom: extension.newAvailableFrom ?? r.availableFrom
            }
          })

          totalRepaired++
          details.push({
            redemptionId: r.id,
            studentName,
            studentEmail: r.pool.user.email,
            oldDueDate: oldDueIso,
            newDueDate: newDueIso,
            oldAcceptUntil: oldAcceptIso,
            newAcceptUntil: newAcceptIso,
            status: 'repaired'
          })

          priorRedemptionForStudent = {
            ...r,
            dueDate: extension.newDueDate,
            acceptUntil: extension.newAcceptUntil,
            availableFrom: extension.newAvailableFrom ?? r.availableFrom
          }
        } else {
          alreadyCorrect++
          details.push({
            redemptionId: r.id,
            studentName,
            studentEmail: r.pool.user.email,
            oldDueDate: oldDueIso,
            newDueDate: newDueIso,
            oldAcceptUntil: oldAcceptIso,
            newAcceptUntil: oldAcceptIso,
            status: 'already_correct'
          })
          priorRedemptionForStudent = r
        }
      } catch (err: any) {
        errors++
        details.push({
          redemptionId: r.id,
          studentName,
          studentEmail: r.pool.user.email,
          oldDueDate: r.dueDate?.toISOString() ?? null,
          newDueDate: null,
          oldAcceptUntil: r.acceptUntil?.toISOString() ?? null,
          newAcceptUntil: null,
          status: 'error',
          message: err.message || 'Failed to recalculate redemption'
        })
        priorRedemptionForStudent = r
      }

      priorCount++
    }
  }

  return {
    totalChecked: redemptions.length,
    totalRepaired,
    alreadyCorrect,
    errors,
    details
  }
}

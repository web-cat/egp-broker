import { createError } from 'h3'
import prisma from '@@/server/utils/db'
import type { RedemptionRow } from '@@/shared/models/pass'
import type { RepairCbtfRedemptionsResponse } from '@@/shared/schemas/cbtf.schema'
import { calculatePassExtension } from '@@/shared/utils/extension'
import { resolveStudentEffectiveDates } from '@@/server/utils/overrides'
import { notifyPassPortSyncFailure } from '@@/server/services/alert.service'
import {
  buildPassPortExtensionPayload,
  sendPassPortExtension,
  sendPassPortRollback
} from '@@/server/utils/passport'
import {
  getPlatformCanvasDomain,
  createCanvasAssignmentOverride,
  updateCanvasAssignmentOverride,
  fetchCanvasAssignmentOverrides
} from '@@/server/utils/canvas'
import { findInstructorCanvasApiKey, isPlainCanvasOrNewQuizzes } from '@@/server/utils/cbtf-canvas'
import type {
  TeacherForceRedeemPassInput,
  TeacherForceRedeemPassResponse,
  StudentPassBalance
} from '@@/shared/models/teacher'

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
          passType: { select: { hoursPerPass: true, extensionOnly: true } }
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
      assignmentId: r.assignmentId,
      assignmentTitle: r.assignment.title,
      createdAt: r.createdAt.toISOString(),
      cost: r.cost,
      // hoursPerPass comes from pool.passType
      hoursPerPass: r.pool.passType.hoursPerPass,
      extensionOnly: Boolean(r.pool?.passType?.extensionOnly),
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

      return newRedemption
    })

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

/**
 * Synchronizes an individual PassRedemption to Canvas as an assignment override.
 */
export async function syncPassRedemptionCanvasOverride(
  redemptionId: string,
  instructorUserId?: string
): Promise<{ status: 'updated' | 'created' | 'skipped'; overrideId?: string; reason?: string }> {
  const redemption = await prisma.passRedemption.findUnique({
    where: { id: redemptionId },
    include: {
      pool: {
        include: {
          passType: true,
          user: {
            include: {
              ltiIdentities: true,
              enrollments: true
            }
          }
        }
      },
      assignment: {
        include: {
          tool: true,
          course: {
            include: {
              deployment: {
                include: {
                  platform: true
                }
              }
            }
          }
        }
      }
    }
  })

  if (!redemption) {
    return { status: 'skipped', reason: 'redemption_not_found' }
  }

  const assignment = redemption.assignment
  const course = assignment?.course
  const passType = redemption.pool.passType
  const student = redemption.pool.user

  // Check if native Canvas or New Quizzes
  if (!isPlainCanvasOrNewQuizzes(assignment)) {
    return { status: 'skipped', reason: 'external_tool' }
  }

  const canvasCourseId = course?.canvasCourseId
  const canvasAssignmentId = assignment?.canvasAssignmentId

  if (
    !canvasCourseId ||
    canvasCourseId.startsWith('$') ||
    !canvasAssignmentId ||
    canvasAssignmentId.startsWith('$')
  ) {
    return { status: 'skipped', reason: 'missing_canvas_ids' }
  }

  const platform = course.deployment?.platform
  if (!platform) {
    return { status: 'skipped', reason: 'no_platform' }
  }

  const domain = getPlatformCanvasDomain(platform, course.deployment?.deploymentHost)

  // Resolve student's Canvas user ID
  const studentIdentity =
    student.ltiIdentities.find((i) => i.platformId === platform.id) ||
    student.ltiIdentities.find((i) => Boolean(i.platformUserId))

  const platformUserId = studentIdentity?.platformUserId
  if (!platformUserId) {
    return { status: 'skipped', reason: 'no_student_canvas_id' }
  }

  const studentCanvasId = parseInt(platformUserId, 10)
  if (isNaN(studentCanvasId)) {
    return { status: 'skipped', reason: 'invalid_student_canvas_id' }
  }

  // Resolve instructor Canvas API key
  let apiKey: string | null = null
  if (instructorUserId) {
    const instructorIdentity = await prisma.ltiIdentity.findFirst({
      where: {
        userId: instructorUserId,
        platformId: platform.id,
        platformApiKey: { not: null }
      }
    })
    apiKey = instructorIdentity?.platformApiKey || null
  }

  if (!apiKey) {
    const studentEnrollment = student.enrollments?.find((e) => e.courseId === course.id)
    const courseSectionId = studentEnrollment?.courseSectionId
    apiKey = await findInstructorCanvasApiKey(course.id, courseSectionId, platform.id)
  }

  if (!apiKey) {
    return { status: 'skipped', reason: 'no_instructor_key' }
  }

  const title = `[EGP Pass] ${passType.name}`
  const unlock_at = redemption.availableFrom
    ? new Date(redemption.availableFrom).toISOString()
    : null
  const due_at = redemption.dueDate ? new Date(redemption.dueDate).toISOString() : null
  const lock_at = redemption.acceptUntil ? new Date(redemption.acceptUntil).toISOString() : due_at

  try {
    let overrideIdToUpdate = redemption.canvasOverrideId

    if (!overrideIdToUpdate) {
      // Check prior redemptions for this student & assignment
      const priorRedemption = await prisma.passRedemption.findFirst({
        where: {
          assignmentId: assignment.id,
          pool: { userId: student.id },
          canvasOverrideId: { not: null },
          id: { not: redemption.id }
        },
        select: { canvasOverrideId: true }
      })

      if (priorRedemption?.canvasOverrideId) {
        overrideIdToUpdate = priorRedemption.canvasOverrideId
      } else {
        // Query Canvas for existing override targeting this student
        const existingCanvasOverrides = await fetchCanvasAssignmentOverrides(
          domain,
          canvasCourseId,
          canvasAssignmentId,
          apiKey
        )
        const matchedOverride = existingCanvasOverrides.find(
          (o) => Array.isArray(o.student_ids) && o.student_ids.includes(studentCanvasId)
        )
        if (matchedOverride?.id) {
          overrideIdToUpdate = matchedOverride.id.toString()
        }
      }
    }

    if (overrideIdToUpdate) {
      try {
        const updated = await updateCanvasAssignmentOverride(
          domain,
          canvasCourseId,
          canvasAssignmentId,
          overrideIdToUpdate,
          { unlock_at, due_at, lock_at },
          apiKey
        )

        const overrideIdStr = updated.id.toString()
        if (redemption.canvasOverrideId !== overrideIdStr) {
          await prisma.passRedemption.update({
            where: { id: redemption.id },
            data: { canvasOverrideId: overrideIdStr }
          })
        }

        const localOverride = await prisma.assignmentOverride.upsert({
          where: {
            assignmentId_canvasOverrideId: {
              assignmentId: assignment.id,
              canvasOverrideId: overrideIdStr
            }
          },
          update: {
            title,
            availableFrom: redemption.availableFrom,
            dueDate: redemption.dueDate,
            acceptUntil: redemption.acceptUntil
          },
          create: {
            assignmentId: assignment.id,
            canvasOverrideId: overrideIdStr,
            title,
            availableFrom: redemption.availableFrom,
            dueDate: redemption.dueDate,
            acceptUntil: redemption.acceptUntil
          }
        })

        await prisma.assignmentOverrideStudent.upsert({
          where: {
            overrideId_userId: {
              overrideId: localOverride.id,
              userId: student.id
            }
          },
          update: {},
          create: {
            overrideId: localOverride.id,
            userId: student.id
          }
        })

        return { status: 'updated', overrideId: overrideIdStr }
      } catch (updateErr: any) {
        if (updateErr?.statusCode !== 404 && updateErr?.response?.status !== 404) {
          throw updateErr
        }
      }
    }

    // Create new override
    let created: any
    try {
      created = await createCanvasAssignmentOverride(
        domain,
        canvasCourseId,
        canvasAssignmentId,
        {
          student_ids: [studentCanvasId],
          title,
          unlock_at,
          due_at,
          lock_at
        },
        apiKey
      )
    } catch (createErr: any) {
      // If student already has an override in Canvas, find and update it
      const existingCanvasOverrides = await fetchCanvasAssignmentOverrides(
        domain,
        canvasCourseId,
        canvasAssignmentId,
        apiKey
      )
      const matched = existingCanvasOverrides.find(
        (o) => Array.isArray(o.student_ids) && o.student_ids.includes(studentCanvasId)
      )
      if (matched?.id) {
        created = await updateCanvasAssignmentOverride(
          domain,
          canvasCourseId,
          canvasAssignmentId,
          matched.id.toString(),
          { unlock_at, due_at, lock_at },
          apiKey
        )
      } else {
        throw createErr
      }
    }

    const overrideIdStr = created.id.toString()
    await prisma.passRedemption.update({
      where: { id: redemption.id },
      data: { canvasOverrideId: overrideIdStr }
    })

    const localOverride = await prisma.assignmentOverride.upsert({
      where: {
        assignmentId_canvasOverrideId: {
          assignmentId: assignment.id,
          canvasOverrideId: overrideIdStr
        }
      },
      update: {
        title,
        availableFrom: redemption.availableFrom,
        dueDate: redemption.dueDate,
        acceptUntil: redemption.acceptUntil
      },
      create: {
        assignmentId: assignment.id,
        canvasOverrideId: overrideIdStr,
        title,
        availableFrom: redemption.availableFrom,
        dueDate: redemption.dueDate,
        acceptUntil: redemption.acceptUntil
      }
    })

    await prisma.assignmentOverrideStudent.upsert({
      where: {
        overrideId_userId: {
          overrideId: localOverride.id,
          userId: student.id
        }
      },
      update: {},
      create: {
        overrideId: localOverride.id,
        userId: student.id
      }
    })

    return { status: 'created', overrideId: overrideIdStr }
  } catch (canvasErr: unknown) {
    const msg = canvasErr instanceof Error ? canvasErr.message : String(canvasErr)
    console.error('[pass-canvas-sync] Failed to sync pass override to Canvas:', msg)
    return { status: 'skipped', reason: msg }
  }
}

/**
 * Forcibly redeems a pass for a student by a teacher, bypassing min/max days restrictions
 * and optionally deducting from the student's pass balance.
 */
export async function teacherForceRedeemPass(
  input: TeacherForceRedeemPassInput & { courseId: string; instructorUserId?: string }
): Promise<TeacherForceRedeemPassResponse> {
  const {
    userId,
    courseId,
    assignmentId,
    passTypeId,
    deductFromBalance = true,
    availableFrom,
    dueDate,
    acceptUntil,
    instructorUserId
  } = input

  // 1. Verify student enrollment in course
  const enrollment = await prisma.enrollment.findUnique({
    where: {
      userId_courseId: {
        userId,
        courseId
      }
    }
  })

  if (!enrollment) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Student is not enrolled in this course'
    })
  }

  // 2. Verify assignment belongs to course and is configured with the pass type
  const assignment = await prisma.assignment.findUnique({
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

  if (
    !assignment ||
    assignment.courseId !== courseId ||
    assignment.passEligibilities.length === 0
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Assignment is not eligible for this pass type'
    })
  }

  // 3. Find or lazily create StudentPassPool
  let pool = await prisma.studentPassPool.findUnique({
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
    const passType = await prisma.passType.findUnique({
      where: { id: passTypeId },
      include: { course: true }
    })

    if (!passType || passType.courseId !== courseId) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Pass type not found in this course'
      })
    }

    const user = await prisma.user.findUnique({
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

    pool = await prisma.studentPassPool.create({
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

  // 4. Determine dates: default start "now", default end now + passType.hoursPerPass
  const now = new Date()
  const defaultHours = pool.passType.hoursPerPass > 0 ? pool.passType.hoursPerPass : 24
  const start = availableFrom ? new Date(availableFrom) : now
  const due = dueDate
    ? new Date(dueDate)
    : new Date(start.getTime() + defaultHours * 60 * 60 * 1000)
  const lock = acceptUntil ? new Date(acceptUntil) : due

  // 5. Handle balance deduction & cost
  const cost = deductFromBalance ? 1 : 0
  if (deductFromBalance) {
    await prisma.studentPassPool.update({
      where: { id: pool.id },
      data: { balance: Math.max(0, pool.balance - 1) }
    })
  }

  // 6. External LTI Tool (PassPort) dispatch if supported
  const tool = assignment.tool
  if (tool?.supportsPassport) {
    const studentDisplayName =
      pool.user?.firstName && pool.user?.lastName
        ? `${pool.user.firstName} ${pool.user.lastName}`
        : pool.user?.email || null

    const platformId = assignment.course?.deployment?.platformId || tool.platformId
    const ltiIdentity =
      pool.user?.ltiIdentities?.find((i: any) => i.platformId === platformId) ||
      pool.user?.ltiIdentities?.[0]
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
        ltiUserId: ltiIdentity?.ltiSub || pool.user.id,
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
        originalAvailableFrom: assignment.availableFrom,
        newAvailableFrom: start,
        originalDueDate: assignment.dueDate,
        newDueDate: due,
        originalAcceptUntil: assignment.acceptUntil,
        newAcceptUntil: lock,
        appliedAt: new Date()
      },
      requestedProperties: (tool.passportRequestedProperties as string[]) || null
    })

    try {
      await sendPassPortExtension(tool, payload)
    } catch (passportErr: unknown) {
      const msg = passportErr instanceof Error ? passportErr.message : String(passportErr)
      console.error('[teacher-force-redeem] PassPort extension dispatch failed:', msg)
      await notifyPassPortSyncFailure({
        toolName: tool.name || 'External Tool',
        assignmentTitle: assignment.title || 'Assignment',
        courseLabel: assignment.course?.label || null,
        studentName: studentDisplayName,
        studentEmail: pool.user?.email,
        error: msg,
        requestId: payload.request_id
      }).catch(() => {})
    }
  }

  // 7. Create PassRedemption record
  const redemption = await prisma.passRedemption.create({
    data: {
      poolId: pool.id,
      assignmentId,
      cost,
      availableFrom: start,
      dueDate: due,
      acceptUntil: lock
    }
  })

  // 8. Sync Canvas override if assignment has Canvas IDs
  let warning: string | undefined
  if (assignment.canvasAssignmentId && assignment.course?.canvasCourseId) {
    const syncRes = await syncPassRedemptionCanvasOverride(redemption.id, instructorUserId)
    if (syncRes.status === 'skipped' && syncRes.reason) {
      warning = `Pass redeemed, but Canvas override sync was skipped: ${syncRes.reason}`
    }
  }

  // 9. Fetch updated student pass balances for course
  const coursePassTypes = await prisma.passType.findMany({
    where: { courseId },
    select: { id: true, name: true, initialBalance: true }
  })

  const updatedPools = await prisma.studentPassPool.findMany({
    where: {
      userId,
      passTypeId: { in: coursePassTypes.map((pt) => pt.id) }
    }
  })

  const passBalances: StudentPassBalance[] = coursePassTypes.map((pt) => {
    const p = updatedPools.find((item) => item.passTypeId === pt.id)
    return {
      passTypeId: pt.id,
      passTypeName: pt.name,
      balance: p ? p.balance : pt.initialBalance,
      initialBalance: pt.initialBalance
    }
  })

  return {
    redemption: {
      id: redemption.id,
      poolId: redemption.poolId,
      assignmentId: redemption.assignmentId,
      cost: redemption.cost,
      availableFrom: redemption.availableFrom ? redemption.availableFrom.toISOString() : null,
      dueDate: redemption.dueDate ? redemption.dueDate.toISOString() : null,
      acceptUntil: redemption.acceptUntil ? redemption.acceptUntil.toISOString() : null,
      canvasOverrideId: redemption.canvasOverrideId ?? null,
      createdAt: redemption.createdAt.toISOString()
    },
    passBalances,
    warning
  }
}

import { createError } from 'h3'
import prisma from '@@/server/utils/db'
import {
  getPlatformCanvasDomain,
  createCanvasAssignmentOverride,
  updateCanvasAssignmentOverride,
  deleteCanvasAssignmentOverride,
  fetchCanvasAssignmentOverrides,
  withCanvasRetry
} from '@@/server/utils/canvas'
import { notifyCbtfCanvasOverrideFailure } from '@@/server/services/alert.service'
import type {
  ResyncCbtfOverridesResponse,
  RepairCbtfTimezonesResponse
} from '@@/shared/schemas/cbtf.schema'
import { assignNextSeat } from '@@/server/utils/cbtf'

/**
 * Cutoff timestamp for the timezone fix commit (2026-09-15 04:10 UTC).
 * Reservations created prior to this timestamp used naive UTC timestamps.
 */
export const PRE_TIMEZONE_FIX_CUTOFF = new Date('2026-09-15T04:10:00.000Z')

/**
 * Determines whether an assignment is a native Canvas assignment/quiz or uses
 * New Quizzes (which runs as an LTI tool hosted on *.instructure.com).
 * Third-party external tools (CodeWorkout, PrairieLearn, etc.) return false.
 */
export function isPlainCanvasOrNewQuizzes(assignment: {
  toolId?: string | null
  tool?: { baseUrl?: string | null } | null
}): boolean {
  if (!assignment.tool || !assignment.tool.baseUrl) {
    return true
  }

  try {
    const rawUrl = assignment.tool.baseUrl.trim()
    const url = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`)
    return url.hostname.endsWith('instructure.com')
  } catch {
    return false
  }
}

/**
 * Finds an instructor Canvas API token for a course, prioritizing teachers
 * in the student's specific section before falling back to the course.
 */
export async function findInstructorCanvasApiKey(
  courseId: string,
  courseSectionId: string | null | undefined,
  platformId: string,
  preferredUserId?: string | null
): Promise<string | null> {
  // 0. Try preferred user if provided
  if (preferredUserId) {
    const preferredUser = await prisma.user.findUnique({
      where: { id: preferredUserId },
      include: {
        ltiIdentities: {
          where: {
            platformId,
            platformApiKey: { not: null }
          }
        }
      }
    })
    const preferredKey = preferredUser?.ltiIdentities?.[0]?.platformApiKey
    if (preferredKey) {
      return preferredKey
    }
  }
  // 1. Try finding an instructor with an API key enrolled in the student's specific section
  if (courseSectionId) {
    const sectionTeacher = await prisma.enrollment.findFirst({
      where: {
        courseSectionId,
        role: { in: ['TEACHER', 'TA'] },
        user: {
          ltiIdentities: {
            some: {
              platformId,
              platformApiKey: { not: null }
            }
          }
        }
      },
      include: {
        user: {
          include: {
            ltiIdentities: {
              where: {
                platformId,
                platformApiKey: { not: null }
              }
            }
          }
        }
      }
    })

    const key = sectionTeacher?.user?.ltiIdentities?.[0]?.platformApiKey
    if (key) {
      return key
    }
  }

  // 2. Fall back to any instructor with an API key in the course
  const courseTeacher = await prisma.enrollment.findFirst({
    where: {
      courseId,
      role: { in: ['TEACHER', 'TA'] },
      user: {
        ltiIdentities: {
          some: {
            platformId,
            platformApiKey: { not: null }
          }
        }
      }
    },
    include: {
      user: {
        include: {
          ltiIdentities: {
            where: {
              platformId,
              platformApiKey: { not: null }
            }
          }
        }
      }
    }
  })

  return courseTeacher?.user?.ltiIdentities?.[0]?.platformApiKey || null
}

export interface SyncCbtfCanvasOverrideResult {
  status: 'created' | 'updated' | 'skipped' | 'error'
  overrideId?: string
  reason?: string
  error?: string
}

/**
 * Synchronizes a CBTF student reservation with an individual assignment override in Canvas.
 * Follows Option A (Non-blocking): if Canvas sync fails, logs and alerts via ntfy,
 * but does not reject the student's in-person CBTF reservation.
 */
export async function syncCbtfReservationCanvasOverride(
  reservationId: string
): Promise<SyncCbtfCanvasOverrideResult> {
  const reservation = await prisma.cbtfReservation.findUnique({
    where: { id: reservationId },
    include: {
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
      },
      user: {
        include: {
          ltiIdentities: true,
          enrollments: true
        }
      }
    }
  })

  if (!reservation) {
    return { status: 'skipped', reason: 'reservation_not_found' }
  }

  const assignment = reservation.assignment
  const course = assignment?.course

  // 1. Check if assignment is plain Canvas or New Quizzes
  if (!isPlainCanvasOrNewQuizzes(assignment)) {
    return { status: 'skipped', reason: 'external_tool' }
  }

  // 2. Check for required Canvas IDs
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

  // 3. Resolve student's Canvas user ID
  const studentIdentity =
    reservation.user.ltiIdentities.find((i) => i.platformId === platform.id) ||
    reservation.user.ltiIdentities.find((i) => Boolean(i.platformUserId))

  const platformUserId = studentIdentity?.platformUserId
  if (!platformUserId) {
    return { status: 'skipped', reason: 'no_student_canvas_id' }
  }

  const studentCanvasId = parseInt(platformUserId, 10)
  if (isNaN(studentCanvasId)) {
    return { status: 'skipped', reason: 'invalid_student_canvas_id' }
  }

  // 4. Resolve student's course section for instructor key resolution
  const studentEnrollment = reservation.user.enrollments.find((e) => e.courseId === course.id)
  const courseSectionId = studentEnrollment?.courseSectionId

  const apiKey = await findInstructorCanvasApiKey(course.id, courseSectionId, platform.id)
  if (!apiKey) {
    return { status: 'skipped', reason: 'no_instructor_key' }
  }

  // 5. Build override payload: available from start, due & lock at end
  const unlock_at =
    reservation.startTime instanceof Date
      ? reservation.startTime.toISOString()
      : new Date(reservation.startTime).toISOString()
  const due_at =
    reservation.endTime instanceof Date
      ? reservation.endTime.toISOString()
      : new Date(reservation.endTime).toISOString()
  const lock_at = due_at

  const title = 'CBTF Exam Slot'

  try {
    let overrideIdToUpdate = reservation.canvasOverrideId

    // If reservation has no canvasOverrideId, check if one already exists for this student & assignment
    if (!overrideIdToUpdate) {
      // 1. Check if another reservation for this student & assignment has a canvasOverrideId
      const priorReservation = await prisma.cbtfReservation.findFirst({
        where: {
          assignmentId: assignment.id,
          userId: reservation.userId,
          canvasOverrideId: { not: null },
          id: { not: reservation.id }
        },
        select: { canvasOverrideId: true }
      })

      if (priorReservation?.canvasOverrideId) {
        overrideIdToUpdate = priorReservation.canvasOverrideId
      } else {
        // 2. Check local AssignmentOverrideStudent
        const localOverrideStudent = await prisma.assignmentOverrideStudent.findFirst({
          where: {
            userId: reservation.userId,
            override: {
              assignmentId: assignment.id,
              canvasOverrideId: { not: null }
            }
          },
          include: {
            override: { select: { canvasOverrideId: true } }
          }
        })

        if (localOverrideStudent?.override?.canvasOverrideId) {
          overrideIdToUpdate = localOverrideStudent.override.canvasOverrideId
        } else {
          // 3. Query Canvas API directly for existing overrides targeting this student
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
    }

    // A. Update existing override if canvasOverrideId already exists or was reconciled
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

        // Link canvasOverrideId onto the current CBTF reservation if not already linked
        if (reservation.canvasOverrideId !== overrideIdStr) {
          await prisma.cbtfReservation.update({
            where: { id: reservation.id },
            data: { canvasOverrideId: overrideIdStr }
          })
        }

        // Upsert local AssignmentOverride record
        const localOverride = await prisma.assignmentOverride.upsert({
          where: {
            assignmentId_canvasOverrideId: {
              assignmentId: assignment.id,
              canvasOverrideId: overrideIdStr
            }
          },
          update: {
            title,
            availableFrom: reservation.startTime,
            dueDate: reservation.endTime,
            acceptUntil: reservation.endTime
          },
          create: {
            assignmentId: assignment.id,
            canvasOverrideId: overrideIdStr,
            title,
            availableFrom: reservation.startTime,
            dueDate: reservation.endTime,
            acceptUntil: reservation.endTime
          }
        })

        // Link individual student in join table
        await prisma.assignmentOverrideStudent.upsert({
          where: {
            overrideId_userId: {
              overrideId: localOverride.id,
              userId: reservation.userId
            }
          },
          update: {},
          create: {
            overrideId: localOverride.id,
            userId: reservation.userId
          }
        })

        return { status: 'updated', overrideId: overrideIdStr }
      } catch (updateErr: any) {
        // If 404 (override was deleted in Canvas), fall through to create a new one
        if (updateErr?.statusCode !== 404 && updateErr?.response?.status !== 404) {
          throw updateErr
        }
      }
    }

    // B. Create a new individual override in Canvas
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
      // Fallback: If Canvas rejects because override already exists for student, fetch and update it
      const isTargetedConflict =
        createErr?.message?.includes('already targeted') ||
        createErr?.status === 400 ||
        createErr?.statusCode === 400

      if (isTargetedConflict) {
        const existingOverrides = await fetchCanvasAssignmentOverrides(
          domain,
          canvasCourseId,
          canvasAssignmentId,
          apiKey
        )
        const matched = existingOverrides.find(
          (o) => Array.isArray(o.student_ids) && o.student_ids.includes(studentCanvasId)
        )
        if (matched?.id) {
          const updated = await updateCanvasAssignmentOverride(
            domain,
            canvasCourseId,
            canvasAssignmentId,
            matched.id.toString(),
            { unlock_at, due_at, lock_at },
            apiKey
          )
          const overrideIdStr = updated.id.toString()
          await prisma.cbtfReservation.update({
            where: { id: reservation.id },
            data: { canvasOverrideId: overrideIdStr }
          })
          return { status: 'updated', overrideId: overrideIdStr }
        }
      }
      throw createErr
    }

    const overrideIdStr = created.id.toString()

    // Persist canvasOverrideId onto the CBTF reservation
    await prisma.cbtfReservation.update({
      where: { id: reservation.id },
      data: { canvasOverrideId: overrideIdStr }
    })

    // Upsert local AssignmentOverride record
    const localOverride = await prisma.assignmentOverride.upsert({
      where: {
        assignmentId_canvasOverrideId: {
          assignmentId: assignment.id,
          canvasOverrideId: overrideIdStr
        }
      },
      update: {
        title,
        availableFrom: reservation.startTime,
        dueDate: reservation.endTime,
        acceptUntil: reservation.endTime
      },
      create: {
        assignmentId: assignment.id,
        canvasOverrideId: overrideIdStr,
        title,
        availableFrom: reservation.startTime,
        dueDate: reservation.endTime,
        acceptUntil: reservation.endTime
      }
    })

    // Link individual student in join table
    await prisma.assignmentOverrideStudent.upsert({
      where: {
        overrideId_userId: {
          overrideId: localOverride.id,
          userId: reservation.userId
        }
      },
      update: {},
      create: {
        overrideId: localOverride.id,
        userId: reservation.userId
      }
    })

    return { status: 'created', overrideId: overrideIdStr }
  } catch (err: any) {
    const errorMsg = err?.message || String(err)
    console.error(`[CBTF Canvas Override] Sync failed for reservation ${reservation.id}:`, errorMsg)

    // Option A: Non-blocking - alert administrators via ntfy
    const studentName =
      reservation.user.firstName && reservation.user.lastName
        ? `${reservation.user.firstName} ${reservation.user.lastName}`
        : reservation.user.firstName || reservation.user.email
    const courseLabel = course.label || course.title || course.id
    const timeSlot = `${unlock_at} – ${due_at}`

    await notifyCbtfCanvasOverrideFailure({
      assignmentTitle: assignment.title || 'Assignment',
      courseLabel,
      studentName,
      studentEmail: reservation.user.email,
      timeSlot,
      error: errorMsg
    }).catch((alertErr) => {
      console.warn('[CBTF Canvas Override] Failed to dispatch ntfy alert:', alertErr)
    })

    return { status: 'error', error: errorMsg }
  }
}

/**
 * Deletes the individual Canvas assignment override when a CBTF reservation is cancelled.
 */
export async function deleteCbtfReservationCanvasOverride(reservationId: string): Promise<boolean> {
  const reservation = await prisma.cbtfReservation.findUnique({
    where: { id: reservationId },
    include: {
      assignment: {
        include: {
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
      },
      user: {
        include: {
          enrollments: true
        }
      }
    }
  })

  if (!reservation || !reservation.canvasOverrideId) {
    return false
  }

  const assignment = reservation.assignment
  const course = assignment?.course
  const canvasCourseId = course?.canvasCourseId
  const canvasAssignmentId = assignment?.canvasAssignmentId
  const platform = course?.deployment?.platform

  if (!canvasCourseId || !canvasAssignmentId || !platform) {
    return false
  }

  const domain = getPlatformCanvasDomain(platform, course.deployment?.deploymentHost)
  const studentEnrollment = reservation.user.enrollments.find((e) => e.courseId === course.id)
  const courseSectionId = studentEnrollment?.courseSectionId

  const apiKey = await findInstructorCanvasApiKey(course.id, courseSectionId, platform.id)
  const overrideId = reservation.canvasOverrideId

  if (apiKey) {
    try {
      await deleteCanvasAssignmentOverride(
        domain,
        canvasCourseId,
        canvasAssignmentId,
        overrideId,
        apiKey
      )
    } catch (err: any) {
      console.warn(
        `[CBTF Canvas Override] Could not delete override ${overrideId} from Canvas:`,
        err.message
      )
    }
  }

  // Clear canvasOverrideId from reservation
  await prisma.cbtfReservation.update({
    where: { id: reservation.id },
    data: { canvasOverrideId: null }
  })

  // Remove local override records
  await prisma.assignmentOverride.deleteMany({
    where: {
      assignmentId: assignment.id,
      canvasOverrideId: overrideId
    }
  })

  return true
}

/**
 * Helper to compare an override ISO timestamp with a target Date.
 * Allows a small tolerance (1 second) for ISO string formatting differences.
 */
function overrideTimeMatches(
  overrideTimeStr: string | null | undefined,
  targetDate: Date
): boolean {
  if (!overrideTimeStr) return false
  const overrideMs = new Date(overrideTimeStr).getTime()
  const targetMs = targetDate.getTime()
  return Math.abs(overrideMs - targetMs) < 1000
}

/**
 * Resyncs all Canvas assignment overrides for active CBTF reservations on a given assignment.
 * Checks each reservation's scheduled times against the Canvas override, updating or creating
 * the override in Canvas as needed.
 */
export async function resyncAssignmentCbtfOverrides(
  assignmentId: string,
  preferredInstructorUserId?: string | null
): Promise<ResyncCbtfOverridesResponse> {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
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
  })

  if (!assignment) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Assignment not found'
    })
  }

  const course = assignment.course
  if (!isPlainCanvasOrNewQuizzes(assignment)) {
    throw createError({
      statusCode: 400,
      statusMessage:
        'Assignment is hosted on an external tool; overrides cannot be synced to Canvas'
    })
  }

  const canvasCourseId = course?.canvasCourseId
  const canvasAssignmentId = assignment.canvasAssignmentId

  if (
    !canvasCourseId ||
    canvasCourseId.startsWith('$') ||
    !canvasAssignmentId ||
    canvasAssignmentId.startsWith('$')
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Assignment or course is missing required Canvas IDs'
    })
  }

  const platform = course.deployment?.platform
  if (!platform) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Course deployment platform not configured'
    })
  }

  const domain = getPlatformCanvasDomain(platform, course.deployment?.deploymentHost)

  // Find all active (non-cancelled) reservations for this assignment
  const reservations = await prisma.cbtfReservation.findMany({
    where: {
      assignmentId,
      status: { not: 'CANCELLED' }
    },
    include: {
      facility: true,
      user: {
        include: {
          ltiIdentities: true,
          enrollments: true
        }
      }
    },
    orderBy: [{ startTime: 'asc' }, { createdAt: 'asc' }]
  })

  if (reservations.length === 0) {
    return {
      totalChecked: 0,
      matched: 0,
      updated: 0,
      created: 0,
      changedOrCreated: 0,
      seatsReassigned: 0,
      conflicts: 0,
      errors: 0,
      details: []
    }
  }

  const apiKey = await findInstructorCanvasApiKey(
    course.id,
    null,
    platform.id,
    preferredInstructorUserId
  )

  if (!apiKey) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No instructor Canvas API key available to sync overrides'
    })
  }

  // Fetch all current Canvas overrides for this assignment in one request (with retry on throttling)
  const existingOverrides = await withCanvasRetry(() =>
    fetchCanvasAssignmentOverrides(domain, canvasCourseId, canvasAssignmentId, apiKey)
  )

  let matched = 0
  let updated = 0
  let created = 0
  let seatsReassigned = 0
  let conflicts = 0
  let errors = 0
  const details: ResyncCbtfOverridesResponse['details'] = []

  const title = 'CBTF Exam Slot'

  for (const reservation of reservations) {
    const studentName =
      reservation.user.firstName && reservation.user.lastName
        ? `${reservation.user.firstName} ${reservation.user.lastName}`
        : reservation.user.firstName || reservation.user.email || 'Student'

    try {
      // 0. Adjust seat assignments based on current seating order where feasible (without collisions)
      const seatOrder: number[] = Array.isArray(reservation.facility?.seatAllocationOrder)
        ? (reservation.facility.seatAllocationOrder as number[])
        : []

      let targetSeatNumber = reservation.seatNumber
      let seatChanged = false

      if (seatOrder.length > 0) {
        const overlappingReservations = await prisma.cbtfReservation.findMany({
          where: {
            facilityId: reservation.facilityId,
            status: { not: 'CANCELLED' },
            id: { not: reservation.id },
            startTime: { lt: reservation.endTime },
            endTime: { gt: reservation.startTime }
          },
          select: {
            seatNumber: true
          }
        })

        const isCurrentSeatOccupied = overlappingReservations.some(
          (r) => r.seatNumber === reservation.seatNumber
        )

        try {
          const optimalSeat = assignNextSeat(
            seatOrder,
            reservation.startTime,
            reservation.endTime,
            overlappingReservations
          )

          // If current seat is occupied (collision) or suboptimal under current seating order,
          // adopt optimalSeat if it is free and does not cause a collision
          if (isCurrentSeatOccupied || optimalSeat !== reservation.seatNumber) {
            targetSeatNumber = optimalSeat
            seatChanged = targetSeatNumber !== reservation.seatNumber
          }
        } catch {
          if (isCurrentSeatOccupied) {
            conflicts++
            details.push({
              reservationId: reservation.id,
              studentName,
              status: 'conflict',
              message: 'Facility is at maximum capacity; seat collision could not be resolved'
            })
            continue
          }
        }
      }

      if (seatChanged) {
        await prisma.cbtfReservation.update({
          where: { id: reservation.id },
          data: {
            seatNumber: targetSeatNumber
          }
        })

        seatsReassigned++
        reservation.seatNumber = targetSeatNumber
      }

      // Resolve student's Canvas user ID
      const studentIdentity =
        reservation.user.ltiIdentities.find((i) => i.platformId === platform.id) ||
        reservation.user.ltiIdentities.find((i) => Boolean(i.platformUserId))

      const platformUserId = studentIdentity?.platformUserId
      const studentCanvasId = platformUserId ? parseInt(platformUserId, 10) : NaN

      if (isNaN(studentCanvasId)) {
        errors++
        details.push({
          reservationId: reservation.id,
          studentName,
          status: 'error',
          message: 'Student has no valid Canvas User ID'
        })
        continue
      }

      const targetUnlockAt =
        reservation.startTime instanceof Date
          ? reservation.startTime.toISOString()
          : new Date(reservation.startTime).toISOString()
      const targetDueAt =
        reservation.endTime instanceof Date
          ? reservation.endTime.toISOString()
          : new Date(reservation.endTime).toISOString()
      const targetLockAt = targetDueAt

      // Locate matching override in Canvas
      let override = reservation.canvasOverrideId
        ? existingOverrides.find((o) => o.id.toString() === reservation.canvasOverrideId)
        : null

      if (!override) {
        override =
          existingOverrides.find(
            (o) =>
              !o.course_section_id &&
              !o.group_id &&
              Array.isArray(o.student_ids) &&
              o.student_ids.includes(studentCanvasId)
          ) || null
      }

      if (override) {
        const unlockMatches = overrideTimeMatches(override.unlock_at, reservation.startTime)
        const dueMatches = overrideTimeMatches(override.due_at, reservation.endTime)
        const lockMatches = overrideTimeMatches(override.lock_at, reservation.endTime)

        if (unlockMatches && dueMatches && lockMatches) {
          // Times already match!
          const overrideIdStr = override.id.toString()

          // Ensure local linking
          if (reservation.canvasOverrideId !== overrideIdStr) {
            await prisma.cbtfReservation.update({
              where: { id: reservation.id },
              data: { canvasOverrideId: overrideIdStr }
            })
          }

          matched++
          details.push({
            reservationId: reservation.id,
            studentName,
            status: 'matched'
          })
          continue
        }

        // Times do not match - update Canvas override (with retry on throttling)
        const updatedOverride = await withCanvasRetry(() =>
          updateCanvasAssignmentOverride(
            domain,
            canvasCourseId,
            canvasAssignmentId,
            override.id,
            {
              unlock_at: targetUnlockAt,
              due_at: targetDueAt,
              lock_at: targetLockAt
            },
            apiKey
          )
        )

        const overrideIdStr = updatedOverride.id.toString()

        if (reservation.canvasOverrideId !== overrideIdStr) {
          await prisma.cbtfReservation.update({
            where: { id: reservation.id },
            data: { canvasOverrideId: overrideIdStr }
          })
        }

        // Upsert local AssignmentOverride
        const localOverride = await prisma.assignmentOverride.upsert({
          where: {
            assignmentId_canvasOverrideId: {
              assignmentId: assignment.id,
              canvasOverrideId: overrideIdStr
            }
          },
          update: {
            title,
            availableFrom: reservation.startTime,
            dueDate: reservation.endTime,
            acceptUntil: reservation.endTime
          },
          create: {
            assignmentId: assignment.id,
            canvasOverrideId: overrideIdStr,
            title,
            availableFrom: reservation.startTime,
            dueDate: reservation.endTime,
            acceptUntil: reservation.endTime
          }
        })

        await prisma.assignmentOverrideStudent.upsert({
          where: {
            overrideId_userId: {
              overrideId: localOverride.id,
              userId: reservation.userId
            }
          },
          update: {},
          create: {
            overrideId: localOverride.id,
            userId: reservation.userId
          }
        })

        updated++
        details.push({
          reservationId: reservation.id,
          studentName,
          status: 'updated'
        })
      } else {
        // No override exists - create a new one (with retry on throttling)
        const createdOverride = await withCanvasRetry(() =>
          createCanvasAssignmentOverride(
            domain,
            canvasCourseId,
            canvasAssignmentId,
            {
              student_ids: [studentCanvasId],
              title,
              unlock_at: targetUnlockAt,
              due_at: targetDueAt,
              lock_at: targetLockAt
            },
            apiKey
          )
        )

        const overrideIdStr = createdOverride.id.toString()

        await prisma.cbtfReservation.update({
          where: { id: reservation.id },
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
            availableFrom: reservation.startTime,
            dueDate: reservation.endTime,
            acceptUntil: reservation.endTime
          },
          create: {
            assignmentId: assignment.id,
            canvasOverrideId: overrideIdStr,
            title,
            availableFrom: reservation.startTime,
            dueDate: reservation.endTime,
            acceptUntil: reservation.endTime
          }
        })

        await prisma.assignmentOverrideStudent.upsert({
          where: {
            overrideId_userId: {
              overrideId: localOverride.id,
              userId: reservation.userId
            }
          },
          update: {},
          create: {
            overrideId: localOverride.id,
            userId: reservation.userId
          }
        })

        created++
        details.push({
          reservationId: reservation.id,
          studentName,
          status: 'created'
        })
      }

      // Gentle pacing delay between successive reservation operations to prevent rate limit spikes
      if (reservations.length > 1) {
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
    } catch (err: any) {
      errors++
      details.push({
        reservationId: reservation.id,
        studentName,
        status: 'error',
        message: err?.message || String(err)
      })
    }
  }

  return {
    totalChecked: reservations.length,
    matched,
    updated,
    created,
    changedOrCreated: updated + created,
    seatsReassigned,
    conflicts,
    errors,
    details
  }
}

/**
 * Unwinds the unintended timezone adjustments applied to a reservation
 * and returns the True UTC start and end timestamps.
 */
export function computeRepairedUtcTimes(startTime: Date): {
  start: Date
  end: Date
  shiftsUndone: number
} {
  const s = new Date(startTime)
  let targetStart: Date
  let shiftsUndone = 0

  const day = s.getUTCDate()
  const hour = s.getUTCHours()
  const minute = s.getUTCMinutes()

  // 1. Already correct True UTC:
  // - Sep 16 13:45 (seleni0726)
  // - Sep 17 17:10 (wanyuc25)
  // - Sep 17 18:45 - 19:50 (tugrulguran, alexr08, lawrencem, adityac08, amanreddyp)
  if ((day === 16 && hour === 13) || (day === 17 && (hour === 17 || hour === 18 || hour === 19))) {
    targetStart = new Date(s)
    shiftsUndone = 0
  }
  // 2. Naive UTC (Sep 17 between 15:50 and 16:30): julianalee, justinr07, jevanib, kwsayo
  // Needs +4h to convert naive EDT to True UTC
  else if (day === 17 && (hour === 16 || (hour === 15 && minute >= 50))) {
    targetStart = new Date(s.getTime() + 4 * 3600 * 1000)
    shiftsUndone = 0
  }
  // 3. medatab (Sep 17 00:55): shifted 2 times (+8h) -> subtract 4h to get Sep 16 20:55 True UTC (4:55 PM EDT)
  else if (day === 17 && hour === 0) {
    targetStart = new Date(s.getTime() - 4 * 3600 * 1000)
    shiftsUndone = 1
  }
  // 4. vedap, rrod31 (Sep 17 01:xx): shifted 3 times (+12h) -> subtract 8h to get Sep 16 17:xx True UTC (1:xx PM EDT)
  else if (day === 17 && hour === 1) {
    targetStart = new Date(s.getTime() - 8 * 3600 * 1000)
    shiftsUndone = 2
  }
  // 5. pramitaupadhyay, aaditgupta, ghardikg, jamesgrossi, austin10hz (Sep 17 21:xx to 23:xx): shifted 2 times (+8h) -> subtract 4h
  else if (day === 17 && hour >= 21 && hour <= 23) {
    targetStart = new Date(s.getTime() - 4 * 3600 * 1000)
    shiftsUndone = 1
  }
  // 6. isabelobk (Sep 18 00:30): shifted 2 times (+8h) -> subtract 4h to get Sep 17 20:30 True UTC (4:30 PM EDT)
  else if (day === 18 && hour === 0) {
    targetStart = new Date(s.getTime() - 4 * 3600 * 1000)
    shiftsUndone = 1
  }
  // 7. niravp327 to paulg527 (Sep 18 01:xx to 03:xx): shifted 3 times (+12h) -> subtract 8h to get Sep 17 17:xx to 19:xx True UTC
  else if (day === 18 && hour >= 1 && hour <= 3) {
    targetStart = new Date(s.getTime() - 8 * 3600 * 1000)
    shiftsUndone = 2
  }
  // 8. youssefwm to lingyunw25 (Sep 18 04:xx to 07:xx): shifted 4 times (+16h) -> subtract 12h to get Sep 17 16:xx to 19:xx True UTC
  else if (day === 18 && hour >= 4 && hour <= 7) {
    targetStart = new Date(s.getTime() - 12 * 3600 * 1000)
    shiftsUndone = 3
  }
  // 9. jessicaj08 (Sep 18 23:10): shifted 2 times (+8h) -> subtract 4h to get Sep 18 19:10 True UTC (3:10 PM EDT)
  else if (day === 18 && hour === 23) {
    targetStart = new Date(s.getTime() - 4 * 3600 * 1000)
    shiftsUndone = 1
  }
  // 10. gabez to arnavkoparkar (Sep 19 01:xx to 04:xx): shifted 3 times (+12h) -> subtract 8h to get Sep 18 17:xx to 20:xx True UTC
  else if (day === 19 && hour >= 1 && hour <= 4) {
    targetStart = new Date(s.getTime() - 8 * 3600 * 1000)
    shiftsUndone = 2
  } else {
    // Fallback: keep current time
    targetStart = new Date(s)
    shiftsUndone = 0
  }

  const targetEnd = new Date(targetStart.getTime() + 60 * 60 * 1000)
  return { start: targetStart, end: targetEnd, shiftsUndone }
}

/**
 * Administrator-only action to unwind cascaded timezone adjustments
 * on pre-timezone-fix reservations for an assignment, resolve any seat
 * collisions caused by the shift, and sync Canvas overrides.
 */
export async function repairAssignmentCbtfTimezones(
  assignmentId: string,
  _adminUserId: string
): Promise<RepairCbtfTimezonesResponse> {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
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

  const course = assignment.course
  const platform = course?.deployment?.platform
  const canvasCourseId = course?.canvasCourseId
  const canvasAssignmentId = assignment.canvasAssignmentId

  const reservations = await prisma.cbtfReservation.findMany({
    where: {
      assignmentId,
      createdAt: { lt: PRE_TIMEZONE_FIX_CUTOFF },
      status: { not: 'CANCELLED' }
    },
    include: {
      facility: true,
      user: {
        include: {
          ltiIdentities: true
        }
      }
    },
    orderBy: { startTime: 'asc' }
  })

  if (reservations.length === 0) {
    return {
      totalChecked: 0,
      totalRepaired: 0,
      seatsReassigned: 0,
      alreadyCorrect: 0,
      conflicts: 0,
      errors: 0,
      details: []
    }
  }

  let instructorApiKey: string | null = null
  if (platform?.id) {
    try {
      instructorApiKey = await findInstructorCanvasApiKey(
        assignment.courseId,
        null,
        platform.id,
        _adminUserId
      )
    } catch (keyErr) {
      console.warn('Could not find instructor Canvas API key during repair:', keyErr)
    }
  }

  let existingOverrides: any[] = []
  if (platform && canvasCourseId && canvasAssignmentId && instructorApiKey) {
    try {
      existingOverrides = await fetchCanvasAssignmentOverrides(
        platform,
        canvasCourseId,
        canvasAssignmentId,
        instructorApiKey
      )
    } catch (err) {
      console.warn('Could not fetch existing Canvas overrides during repair:', err)
    }
  }

  let totalRepaired = 0
  let seatsReassigned = 0
  let alreadyCorrect = 0
  let conflicts = 0
  let errors = 0
  const details: RepairCbtfTimezonesResponse['details'] = []

  for (const reservation of reservations) {
    const studentName =
      reservation.user.firstName && reservation.user.lastName
        ? `${reservation.user.firstName} ${reservation.user.lastName}`
        : reservation.user.firstName || reservation.user.email || 'Student'

    const previousStartUtc = reservation.startTime.toISOString()

    try {
      const {
        start: targetStart,
        end: targetEnd,
        shiftsUndone
      } = computeRepairedUtcTimes(reservation.startTime)

      // Format for EDT display in report
      const edtFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
      const repairedStartEdt = edtFormatter.format(targetStart)
      const repairedStartUtc = targetStart.toISOString()

      const isTimeChanged =
        targetStart.getTime() !== reservation.startTime.getTime() ||
        targetEnd.getTime() !== reservation.endTime.getTime()

      if (!isTimeChanged && shiftsUndone === 0) {
        alreadyCorrect++
        details.push({
          reservationId: reservation.id,
          studentName,
          previousStartUtc,
          repairedStartUtc,
          repairedStartEdt,
          seatNumber: reservation.seatNumber,
          status: 'already_correct',
          message: 'Reservation was already at True UTC timestamp'
        })
        continue
      }

      // Check seat availability at target time slot
      const overlappingReservations = await prisma.cbtfReservation.findMany({
        where: {
          facilityId: reservation.facilityId,
          status: { not: 'CANCELLED' },
          id: { not: reservation.id },
          startTime: { lt: targetEnd },
          endTime: { gt: targetStart }
        },
        select: {
          seatNumber: true
        }
      })

      const isCurrentSeatOccupied = overlappingReservations.some(
        (r) => r.seatNumber === reservation.seatNumber
      )

      let targetSeatNumber = reservation.seatNumber
      let seatChanged = false

      if (isCurrentSeatOccupied) {
        const seatOrder: number[] = Array.isArray(reservation.facility?.seatAllocationOrder)
          ? (reservation.facility.seatAllocationOrder as number[])
          : []

        try {
          targetSeatNumber = assignNextSeat(
            seatOrder,
            targetStart,
            targetEnd,
            overlappingReservations
          )
          seatsReassigned++
          seatChanged = true
        } catch {
          conflicts++
          details.push({
            reservationId: reservation.id,
            studentName,
            previousStartUtc,
            repairedStartUtc,
            repairedStartEdt,
            seatNumber: reservation.seatNumber,
            status: 'conflict',
            message: 'Facility at capacity at target time; seat could not be assigned'
          })
          continue
        }
      }

      // Update reservation in database
      await prisma.cbtfReservation.update({
        where: { id: reservation.id },
        data: {
          startTime: targetStart,
          endTime: targetEnd,
          seatNumber: targetSeatNumber
        }
      })

      totalRepaired++

      // Sync Canvas override if Canvas IDs and API key are available
      const studentIdentity =
        reservation.user.ltiIdentities.find((i) => i.platformId === platform.id) ||
        reservation.user.ltiIdentities.find((i) => Boolean(i.platformUserId))

      const platformUserId = studentIdentity?.platformUserId
      const studentCanvasId = platformUserId ? parseInt(platformUserId, 10) : NaN

      if (canvasCourseId && canvasAssignmentId && instructorApiKey && !isNaN(studentCanvasId)) {
        let override = reservation.canvasOverrideId
          ? existingOverrides.find((o) => o.id.toString() === reservation.canvasOverrideId)
          : null

        if (!override) {
          override =
            existingOverrides.find(
              (o) =>
                !o.course_section_id &&
                !o.group_id &&
                Array.isArray(o.student_ids) &&
                o.student_ids.includes(studentCanvasId)
            ) || null
        }

        const targetUnlockAt = targetStart.toISOString()
        const targetDueAt = targetEnd.toISOString()
        const targetLockAt = targetDueAt

        try {
          if (override) {
            await updateCanvasAssignmentOverride(
              platform,
              canvasCourseId,
              canvasAssignmentId,
              override.id,
              {
                student_ids: [studentCanvasId],
                title: studentName,
                unlock_at: targetUnlockAt,
                due_at: targetDueAt,
                lock_at: targetLockAt
              },
              instructorApiKey
            )
          } else {
            const newOverride = await createCanvasAssignmentOverride(
              platform,
              canvasCourseId,
              canvasAssignmentId,
              {
                student_ids: [studentCanvasId],
                title: studentName,
                unlock_at: targetUnlockAt,
                due_at: targetDueAt,
                lock_at: targetLockAt
              },
              instructorApiKey
            )

            await prisma.cbtfReservation.update({
              where: { id: reservation.id },
              data: { canvasOverrideId: newOverride.id.toString() }
            })
          }
        } catch (canvasErr: any) {
          console.warn(
            `Canvas override sync warning for student ${studentName}:`,
            canvasErr?.message
          )
        }
      }

      details.push({
        reservationId: reservation.id,
        studentName,
        previousStartUtc,
        repairedStartUtc,
        repairedStartEdt,
        seatNumber: targetSeatNumber,
        status: seatChanged ? 'reassigned' : 'repaired',
        message: seatChanged
          ? `Repaired time and moved to seat ${targetSeatNumber} to avoid collision`
          : undefined
      })

      if (reservations.length > 1) {
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
    } catch (err: any) {
      errors++
      details.push({
        reservationId: reservation.id,
        studentName,
        previousStartUtc,
        repairedStartUtc: reservation.startTime.toISOString(),
        repairedStartEdt: 'Unknown',
        seatNumber: reservation.seatNumber,
        status: 'error',
        message: err?.message || String(err)
      })
    }
  }

  return {
    totalChecked: reservations.length,
    totalRepaired,
    seatsReassigned,
    alreadyCorrect,
    conflicts,
    errors,
    details
  }
}

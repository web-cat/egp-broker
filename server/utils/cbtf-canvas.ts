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
import type { ResyncCbtfOverridesResponse } from '@@/shared/schemas/cbtf.schema'
import { assignNextSeat } from '@@/server/utils/cbtf'

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
    // A. Update existing override if canvasOverrideId already exists on reservation
    if (reservation.canvasOverrideId) {
      try {
        const updated = await updateCanvasAssignmentOverride(
          domain,
          canvasCourseId,
          canvasAssignmentId,
          reservation.canvasOverrideId,
          { unlock_at, due_at, lock_at },
          apiKey
        )

        const overrideIdStr = updated.id.toString()

        // Update local AssignmentOverride record if tracked
        await prisma.assignmentOverride.updateMany({
          where: {
            assignmentId: assignment.id,
            canvasOverrideId: overrideIdStr
          },
          data: {
            availableFrom: reservation.startTime,
            dueDate: reservation.endTime,
            acceptUntil: reservation.endTime
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
    const created = await createCanvasAssignmentOverride(
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

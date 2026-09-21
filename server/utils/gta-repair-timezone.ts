import { createError } from 'h3'
import prisma from '@@/server/utils/db'
import { combineDateAndTime, DEFAULT_CBTF_TIMEZONE } from '@@/server/utils/cbtf'
import type { RepairGtaTimezonesResponse } from '@@/shared/schemas/gta-interview.schema'

export const DEFAULT_GTA_TIMEZONE = DEFAULT_CBTF_TIMEZONE

/**
 * Cutoff timestamp for the timezone fix commit (2026-09-21 13:45 UTC).
 * Reservations created prior to this timestamp used naive UTC timestamps
 * that did not account for the America/New_York local shift timezone.
 */
export const GTA_PRE_TIMEZONE_FIX_CUTOFF = new Date('2026-09-21T13:45:00.000Z')

/**
 * Re-interprets a naive UTC timestamp as a local time in timeZone (America/New_York)
 * and returns the true UTC timestamp.
 */
export function computeRepairedGtaUtcTimes(
  startTime: Date,
  endTime: Date,
  timeZone: string = DEFAULT_GTA_TIMEZONE
): {
  repairedStart: Date
  repairedEnd: Date
  needsRepair: boolean
} {
  const naiveDateStr = startTime.toISOString().substring(0, 10)
  const naiveTimeStr = startTime.toISOString().substring(11, 16)

  const repairedStart = combineDateAndTime(naiveDateStr, naiveTimeStr, timeZone)
  const durationMs = endTime.getTime() - startTime.getTime()
  const repairedEnd = new Date(repairedStart.getTime() + durationMs)

  const needsRepair = repairedStart.getTime() !== startTime.getTime()

  return {
    repairedStart,
    repairedEnd,
    needsRepair
  }
}

/**
 * Administrator-only action to auto-correct all GTA interview reservations for an assignment
 * created prior to the timezone fix. Shifts naive UTC timestamps into true UTC matching
 * the intended shift hours in America/New_York.
 */
export async function repairAssignmentGtaTimezones(
  assignmentId: string,
  _adminUserId: string,
  cutoff: Date = GTA_PRE_TIMEZONE_FIX_CUTOFF
): Promise<RepairGtaTimezonesResponse> {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      course: true
    }
  })

  if (!assignment) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Assignment not found'
    })
  }

  if (!assignment.hasInterviews) {
    throw createError({
      statusCode: 400,
      statusMessage: 'This assignment does not require grading interviews'
    })
  }

  const reservations = await prisma.gtaInterviewReservation.findMany({
    where: {
      assignmentId,
      createdAt: { lt: cutoff },
      status: { not: 'CANCELLED' }
    },
    include: {
      student: {
        select: { firstName: true, lastName: true, email: true }
      },
      gta: {
        select: { firstName: true, lastName: true, email: true }
      }
    },
    orderBy: { startTime: 'asc' }
  })

  if (reservations.length === 0) {
    return {
      totalChecked: 0,
      totalRepaired: 0,
      alreadyCorrect: 0,
      conflicts: 0,
      errors: 0,
      details: []
    }
  }

  const edtFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: DEFAULT_GTA_TIMEZONE,
    dateStyle: 'short',
    timeStyle: 'short'
  })

  let totalRepaired = 0
  let alreadyCorrect = 0
  let conflicts = 0
  let errors = 0
  const details: RepairGtaTimezonesResponse['details'] = []

  // Pre-fetch all other active reservations in the course to detect conflicts
  const allCourseActiveReservations = await prisma.gtaInterviewReservation.findMany({
    where: {
      assignment: { courseId: assignment.courseId },
      status: { notIn: ['CANCELLED', 'MISSED'] }
    },
    select: {
      id: true,
      gtaId: true,
      startTime: true
    }
  })

  // Map of "gtaId_timestampMs" -> reservationId
  const occupiedGtaSlots = new Map<string, string>()
  for (const r of allCourseActiveReservations) {
    occupiedGtaSlots.set(`${r.gtaId}_${r.startTime.getTime()}`, r.id)
  }

  const updatesToApply: Array<{
    id: string
    startTime: Date
    endTime: Date
  }> = []

  for (const res of reservations) {
    const studentName =
      `${res.student.firstName || ''} ${res.student.lastName || ''}`.trim() || res.student.email
    const gtaName = `${res.gta.firstName || ''} ${res.gta.lastName || ''}`.trim() || res.gta.email
    const prevUtcStr = res.startTime.toISOString()

    try {
      const { repairedStart, repairedEnd, needsRepair } = computeRepairedGtaUtcTimes(
        res.startTime,
        res.endTime,
        DEFAULT_GTA_TIMEZONE
      )

      const repUtcStr = repairedStart.toISOString()
      const repEdtStr = edtFormatter.format(repairedStart)

      if (!needsRepair) {
        alreadyCorrect++
        details.push({
          reservationId: res.id,
          studentName,
          gtaName,
          previousStartUtc: prevUtcStr,
          repairedStartUtc: repUtcStr,
          repairedStartEdt: repEdtStr,
          status: 'already_correct',
          message: 'Timestamp already aligns with course timezone'
        })
        continue
      }

      // Check for slot collision with another reservation assigned to the same GTA
      const conflictKey = `${res.gtaId}_${repairedStart.getTime()}`
      const existingOccupantId = occupiedGtaSlots.get(conflictKey)
      if (existingOccupantId && existingOccupantId !== res.id) {
        conflicts++
        details.push({
          reservationId: res.id,
          studentName,
          gtaName,
          previousStartUtc: prevUtcStr,
          repairedStartUtc: repUtcStr,
          repairedStartEdt: repEdtStr,
          status: 'conflict',
          message: `GTA already has an active reservation at ${repEdtStr}`
        })
        continue
      }

      // Remove old slot from map and register new slot
      occupiedGtaSlots.delete(`${res.gtaId}_${res.startTime.getTime()}`)
      occupiedGtaSlots.set(conflictKey, res.id)

      updatesToApply.push({
        id: res.id,
        startTime: repairedStart,
        endTime: repairedEnd
      })

      totalRepaired++
      details.push({
        reservationId: res.id,
        studentName,
        gtaName,
        previousStartUtc: prevUtcStr,
        repairedStartUtc: repUtcStr,
        repairedStartEdt: repEdtStr,
        status: 'repaired'
      })
    } catch (err: any) {
      errors++
      details.push({
        reservationId: res.id,
        studentName,
        gtaName,
        previousStartUtc: prevUtcStr,
        repairedStartUtc: prevUtcStr,
        repairedStartEdt: 'Unknown',
        status: 'error',
        message: err?.message || 'Unknown repair error'
      })
    }
  }

  // Apply all updates atomically
  if (updatesToApply.length > 0) {
    await prisma.$transaction(
      updatesToApply.map((u) =>
        prisma.gtaInterviewReservation.update({
          where: { id: u.id },
          data: {
            startTime: u.startTime,
            endTime: u.endTime
          }
        })
      )
    )
  }

  return {
    totalChecked: reservations.length,
    totalRepaired,
    alreadyCorrect,
    conflicts,
    errors,
    details
  }
}

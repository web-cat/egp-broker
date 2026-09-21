import { createError } from 'h3'
import prisma from '@@/server/utils/db'
import { DEFAULT_GTA_TIMEZONE, combineDateAndTime } from '@@/shared/utils/timezone'
import type {
  ShiftImpactSummary,
  ImpactedReservation
} from '@@/shared/schemas/gta-interview.schema'

export interface ShiftUpdateParams {
  userId?: string
  date?: string
  startTime?: string
  endTime?: string
}

/**
 * When a GTA shift is deleted or edited:
 * 1. Identifies reservations that were assigned to the shift's GTA that no longer fit
 *    within the updated shift (or all reservations if deleted).
 * 2. Attempts to automatically reschedule each orphaned reservation to an available,
 *    concurrent on-duty GTA in the same course at the EXACT same appointment time.
 * 3. If no concurrent GTA is available at that exact time, marks the appointment as CANCELLED.
 * 4. Returns a summary of rescheduled and cancelled reservations.
 */
export async function reconcileShiftReservations(
  courseId: string,
  shiftId: string,
  updatedShiftParams?: ShiftUpdateParams | null,
  timeZone: string = DEFAULT_GTA_TIMEZONE
): Promise<ShiftImpactSummary> {
  const existingShift = await prisma.gtaShift.findUnique({
    where: { id: shiftId },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      }
    }
  })

  if (!existingShift || existingShift.courseId !== courseId) {
    throw createError({ statusCode: 404, statusMessage: 'GTA shift not found' })
  }

  const existingDateStr = existingShift.date
    ? typeof existingShift.date === 'string'
      ? existingShift.date.split('T')[0]
      : existingShift.date.toISOString().split('T')[0]
    : '1970-01-01'

  const startTime = existingShift.startTime || '00:00'
  const endTime = existingShift.endTime || '00:00'

  const existingStartUtc = combineDateAndTime(existingDateStr, startTime, timeZone)
  const existingEndUtc = combineDateAndTime(existingDateStr, endTime, timeZone)

  // Fetch all currently SCHEDULED reservations belonging to this shift's GTA during the shift's time window
  const shiftReservations = await prisma.gtaInterviewReservation.findMany({
    where: {
      gtaId: existingShift.userId,
      assignment: { courseId },
      status: 'SCHEDULED',
      startTime: { gte: existingStartUtc, lt: existingEndUtc }
    },
    include: {
      student: {
        select: { id: true, firstName: true, lastName: true, email: true }
      },
      assignment: {
        select: { id: true, title: true }
      },
      gta: {
        select: { id: true, firstName: true, lastName: true, email: true }
      }
    },
    orderBy: { startTime: 'asc' }
  })

  if (shiftReservations.length === 0) {
    return { rescheduled: [], cancelled: [] }
  }

  // Determine which reservations are orphaned
  let orphanedReservations = shiftReservations

  if (updatedShiftParams) {
    const newUserId = updatedShiftParams.userId || existingShift.userId
    const newDateStr = updatedShiftParams.date || existingDateStr
    const newStartTime = updatedShiftParams.startTime || existingShift.startTime
    const newEndTime = updatedShiftParams.endTime || existingShift.endTime

    const newStartUtc = combineDateAndTime(newDateStr, newStartTime, timeZone)
    const newEndUtc = combineDateAndTime(newDateStr, newEndTime, timeZone)

    orphanedReservations = shiftReservations.filter((res) => {
      // If GTA changed, or if reservation start/end falls outside the new shift bounds
      if (newUserId !== existingShift.userId) return true
      if (res.startTime < newStartUtc || res.endTime > newEndUtc) return true
      return false
    })
  }

  if (orphanedReservations.length === 0) {
    return { rescheduled: [], cancelled: [] }
  }

  // Fetch all potential concurrent shifts in the course that could host rescheduled students
  const minDate = orphanedReservations[0].startTime
  const maxDate = orphanedReservations[orphanedReservations.length - 1].endTime

  const potentialShifts = await prisma.gtaShift.findMany({
    where: {
      courseId,
      id: { not: shiftId }
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      }
    }
  })

  // Fetch all active reservations across the course to identify which GTAs are already booked
  const activeCourseReservations = await prisma.gtaInterviewReservation.findMany({
    where: {
      assignment: { courseId },
      status: { in: ['SCHEDULED', 'CHECKED_IN'] },
      startTime: { gte: minDate, lte: maxDate }
    },
    select: {
      id: true,
      gtaId: true,
      startTime: true
    }
  })

  // Map of slotIso -> Set of gtaIds already booked
  const bookedGtaBySlot = new Map<string, Set<string>>()
  for (const r of activeCourseReservations) {
    const slotIso = r.startTime.toISOString()
    if (!bookedGtaBySlot.has(slotIso)) {
      bookedGtaBySlot.set(slotIso, new Set())
    }
    bookedGtaBySlot.get(slotIso)!.add(r.gtaId)
  }

  // Also account for the newly edited shift itself if the new GTA is taking slots
  if (updatedShiftParams) {
    const newUserId = updatedShiftParams.userId || existingShift.userId
    const newDateStr = updatedShiftParams.date || existingDateStr
    const newStartTime = updatedShiftParams.startTime || existingShift.startTime
    const newEndTime = updatedShiftParams.endTime || existingShift.endTime
    // Add the edited shift as a potential shift if it's for a different GTA
    // (or for same GTA within new bounds)
    if (newUserId !== existingShift.userId && existingShift.user) {
      potentialShifts.push({
        id: shiftId,
        courseId,
        userId: newUserId,
        date: new Date(`${newDateStr}T00:00:00.000Z`),
        startTime: newStartTime,
        endTime: newEndTime,
        user: existingShift.user // Will be resolved if needed
      } as any)
    }
  }

  const rescheduled: ImpactedReservation[] = []
  const cancelled: ImpactedReservation[] = []

  for (const res of orphanedReservations) {
    const slotStartIso = res.startTime.toISOString()
    const bookedGtas = bookedGtaBySlot.get(slotStartIso) || new Set()

    // Find concurrent candidate GTA shifts covering [res.startTime, res.endTime]
    const availableCandidateShift = potentialShifts.find((s) => {
      // Must not be the same GTA who is losing the reservation
      if (s.userId === res.gtaId) return false
      // Must not already be booked at this exact slot
      if (bookedGtas.has(s.userId)) return false

      const sDateStr =
        typeof s.date === 'string' ? s.date.split('T')[0] : s.date.toISOString().split('T')[0]

      const sStartUtc = combineDateAndTime(sDateStr, s.startTime, timeZone)
      const sEndUtc = combineDateAndTime(sDateStr, s.endTime, timeZone)

      return res.startTime >= sStartUtc && res.endTime <= sEndUtc
    })

    const studentName =
      `${res.student.firstName || ''} ${res.student.lastName || ''}`.trim() || res.student.email
    const previousGtaName =
      `${res.gta.firstName || ''} ${res.gta.lastName || ''}`.trim() || res.gta.email

    if (availableCandidateShift) {
      const candidateUser = availableCandidateShift.user
      const newGtaName =
        `${candidateUser.firstName || ''} ${candidateUser.lastName || ''}`.trim() ||
        candidateUser.email

      // Reassign to candidate GTA
      await prisma.gtaInterviewReservation.update({
        where: { id: res.id },
        data: { gtaId: candidateUser.id }
      })

      // Mark this GTA as now booked for this timeslot
      if (!bookedGtaBySlot.has(slotStartIso)) {
        bookedGtaBySlot.set(slotStartIso, new Set())
      }
      bookedGtaBySlot.get(slotStartIso)!.add(candidateUser.id)

      rescheduled.push({
        reservationId: res.id,
        studentId: res.student.id,
        studentName,
        studentEmail: res.student.email,
        assignmentId: res.assignment.id,
        assignmentTitle: res.assignment.title,
        startTime: res.startTime.toISOString(),
        endTime: res.endTime.toISOString(),
        previousGtaId: res.gta.id,
        previousGtaName,
        newGtaId: candidateUser.id,
        newGtaName
      })
    } else {
      // No concurrent GTA available at this exact timeslot -> Cancel appointment
      await prisma.gtaInterviewReservation.update({
        where: { id: res.id },
        data: { status: 'CANCELLED' }
      })

      cancelled.push({
        reservationId: res.id,
        studentId: res.student.id,
        studentName,
        studentEmail: res.student.email,
        assignmentId: res.assignment.id,
        assignmentTitle: res.assignment.title,
        startTime: res.startTime.toISOString(),
        endTime: res.endTime.toISOString(),
        previousGtaId: res.gta.id,
        previousGtaName,
        reason: 'No concurrent Graduate TA on duty at this timeslot'
      })
    }
  }

  return { rescheduled, cancelled }
}

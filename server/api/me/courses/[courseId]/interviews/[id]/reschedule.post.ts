import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { assertCourseMember } from '@@/server/utils/gta-interview'
import { rescheduleInterviewReservationInputSchema } from '@@/shared/schemas/gta-interview.schema'
import {
  getLocalDateString,
  getLocalTimeParts,
  combineDateAndTime,
  DEFAULT_GTA_TIMEZONE
} from '@@/shared/utils/timezone'
import { INTERVIEW_SLOT_INTERVAL_MINUTES } from '@@/server/utils/gta-slots'
import type { ApiResponse } from '@@/shared/types/api'

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export default defineEventHandler(async (event): Promise<ApiResponse<any>> => {
  const courseId = getRouterParam(event, 'courseId')
  const id = getRouterParam(event, 'id')

  if (!courseId || !id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Course ID and Interview ID are required'
    })
  }

  const auth = await assertCourseMember(event, courseId)
  if (!auth.isInstructor && !auth.isGta) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden: Only instructors and GTAs can reschedule appointments'
    })
  }

  const reservation = await prisma.gtaInterviewReservation.findUnique({
    where: { id },
    include: {
      assignment: true,
      gta: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      },
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      }
    }
  })

  if (!reservation || reservation.assignment.courseId !== courseId) {
    throw createError({ statusCode: 404, statusMessage: 'Interview reservation not found' })
  }

  if (reservation.status !== 'SCHEDULED') {
    throw createError({
      statusCode: 400,
      statusMessage: `Cannot reschedule an interview with status ${reservation.status}`
    })
  }

  if (!auth.isInstructor && auth.userId !== reservation.gtaId) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden: Teaching Assistants can only reschedule their own appointments'
    })
  }

  const body = await readBody(event).catch(() => ({}))
  const parsed = rescheduleInterviewReservationInputSchema.safeParse(body)
  const targetGtaId = parsed.success ? parsed.data.targetGtaId : undefined

  // Determine local date string and time of this reservation
  const resDateStr = getLocalDateString(reservation.startTime, DEFAULT_GTA_TIMEZONE)
  const resTimeParts = getLocalTimeParts(reservation.startTime, DEFAULT_GTA_TIMEZONE)
  const resStartMin = resTimeParts.hour24 * 60 + resTimeParts.minute

  // Query candidate shifts in this course on this date
  const candidateShifts = await prisma.gtaShift.findMany({
    where: {
      courseId,
      date: new Date(`${resDateStr}T00:00:00.000Z`),
      userId: targetGtaId ? targetGtaId : { not: reservation.gtaId }
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

  // Find candidate GTAs whose shift covers the slot and who have no conflicting reservation
  const slotStartUtc = combineDateAndTime(
    resDateStr,
    `${String(resTimeParts.hour24).padStart(2, '0')}:${String(resTimeParts.minute).padStart(2, '0')}`,
    DEFAULT_GTA_TIMEZONE
  )

  const conflictingReservations = await prisma.gtaInterviewReservation.findMany({
    where: {
      assignment: { courseId },
      status: { in: ['SCHEDULED', 'CHECKED_IN'] },
      startTime: slotStartUtc
    },
    select: { gtaId: true }
  })

  const bookedGtaIds = new Set(conflictingReservations.map((r) => r.gtaId))

  const validGtas = candidateShifts.filter((shift) => {
    const sStart = timeToMinutes(shift.startTime)
    const sEnd = timeToMinutes(shift.endTime)
    if (sStart <= resStartMin && sEnd >= resStartMin + INTERVIEW_SLOT_INTERVAL_MINUTES) {
      return !bookedGtaIds.has(shift.userId)
    }
    return false
  })

  if (validGtas.length === 0) {
    throw createError({
      statusCode: 409,
      statusMessage:
        'No other on-duty GTA is available at this exact appointment time to accept the reservation'
    })
  }

  const chosenShift = validGtas[0]

  const updated = await prisma.gtaInterviewReservation.update({
    where: { id },
    data: {
      gtaId: chosenShift.userId
    },
    include: {
      gta: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      }
    }
  })

  return {
    statusCode: 200,
    data: {
      success: true,
      reservation: updated,
      newGta: {
        id: chosenShift.user.id,
        name: `${chosenShift.user.firstName} ${chosenShift.user.lastName}`.trim(),
        email: chosenShift.user.email
      }
    }
  }
})

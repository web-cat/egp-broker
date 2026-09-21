import { defineEventHandler, getRouterParam, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { assertCourseMember } from '@@/server/utils/gta-interview'
import { INTERVIEW_SLOT_INTERVAL_MINUTES } from '@@/server/utils/gta-slots'
import { combineDateAndTime, DEFAULT_GTA_TIMEZONE } from '@@/shared/utils/timezone'
import { formatTimeStr12h } from '@@/shared/utils/proctor-schedule-parser'
import type { ApiResponse } from '@@/shared/types/api'
import type {
  GtaShiftDetailsDto,
  GtaShiftSlotDetail,
  AvailableGtaDto
} from '@@/shared/schemas/gta-interview.schema'

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60)
  const min = m % 60
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

export default defineEventHandler(async (event): Promise<ApiResponse<GtaShiftDetailsDto>> => {
  const courseId = getRouterParam(event, 'courseId')
  const id = getRouterParam(event, 'id')

  if (!courseId || !id) {
    throw createError({ statusCode: 400, statusMessage: 'Course ID and Shift ID are required' })
  }

  const shift = await prisma.gtaShift.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatarUrl: true
        }
      }
    }
  })

  if (!shift || shift.courseId !== courseId) {
    throw createError({ statusCode: 404, statusMessage: 'GTA shift not found' })
  }

  const auth = await assertCourseMember(event, courseId)
  if (!auth.isInstructor && auth.userId !== shift.userId) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden: You do not have permission to view this shift'
    })
  }

  const dateStr =
    typeof shift.date === 'string'
      ? shift.date.split('T')[0]
      : shift.date.toISOString().split('T')[0]

  const shiftStartUtc = combineDateAndTime(dateStr, shift.startTime, DEFAULT_GTA_TIMEZONE)
  const shiftEndUtc = combineDateAndTime(dateStr, shift.endTime, DEFAULT_GTA_TIMEZONE)

  // Active reservations for this shift's GTA
  const shiftReservations = await prisma.gtaInterviewReservation.findMany({
    where: {
      gtaId: shift.userId,
      assignment: { courseId },
      status: { in: ['SCHEDULED', 'CHECKED_IN'] },
      startTime: { gte: shiftStartUtc, lt: shiftEndUtc }
    },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      },
      assignment: {
        select: {
          id: true,
          title: true
        }
      }
    }
  })

  // Other GTA shifts on this date for the course
  const concurrentShifts = await prisma.gtaShift.findMany({
    where: {
      courseId,
      date: shift.date,
      userId: { not: shift.userId }
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

  // All active reservations during the shift window in this course
  const allReservations = await prisma.gtaInterviewReservation.findMany({
    where: {
      assignment: { courseId },
      status: { in: ['SCHEDULED', 'CHECKED_IN'] },
      startTime: { gte: shiftStartUtc, lt: shiftEndUtc }
    },
    select: {
      id: true,
      gtaId: true,
      startTime: true
    }
  })

  const startMin = timeToMinutes(shift.startTime)
  const endMin = timeToMinutes(shift.endTime)
  const slots: GtaShiftSlotDetail[] = []

  for (let cur = startMin; cur < endMin; cur += INTERVIEW_SLOT_INTERVAL_MINUTES) {
    const slotStartTime = minutesToTime(cur)
    const slotEndTime = minutesToTime(Math.min(cur + INTERVIEW_SLOT_INTERVAL_MINUTES, endMin))
    const timeLabel = `${formatTimeStr12h(slotStartTime)} - ${formatTimeStr12h(slotEndTime)}`

    const slotStartUtc = combineDateAndTime(dateStr, slotStartTime, DEFAULT_GTA_TIMEZONE)

    const matchingRes = shiftReservations.find(
      (r) => Math.abs(r.startTime.getTime() - slotStartUtc.getTime()) < 60000
    )

    if (matchingRes) {
      // Find other GTAs on duty covering this slot who have no reservation
      const availableGtas: AvailableGtaDto[] = []

      for (const cShift of concurrentShifts) {
        const cStart = timeToMinutes(cShift.startTime)
        const cEnd = timeToMinutes(cShift.endTime)
        if (cStart <= cur && cEnd >= cur + INTERVIEW_SLOT_INTERVAL_MINUTES) {
          const hasConflict = allReservations.some(
            (r) =>
              r.gtaId === cShift.userId &&
              Math.abs(r.startTime.getTime() - slotStartUtc.getTime()) < 60000
          )

          if (!hasConflict && !availableGtas.some((g) => g.id === cShift.userId)) {
            availableGtas.push({
              id: cShift.userId,
              name: `${cShift.user.firstName} ${cShift.user.lastName}`.trim(),
              email: cShift.user.email
            })
          }
        }
      }

      slots.push({
        startTime: slotStartTime,
        endTime: slotEndTime,
        timeLabel,
        isReserved: true,
        reservation: {
          id: matchingRes.id,
          studentId: matchingRes.studentId,
          studentName: `${matchingRes.student.firstName} ${matchingRes.student.lastName}`.trim(),
          studentEmail: matchingRes.student.email,
          assignmentId: matchingRes.assignmentId,
          assignmentTitle: matchingRes.assignment.title,
          status: matchingRes.status as any,
          startTime: matchingRes.startTime.toISOString(),
          endTime: matchingRes.endTime.toISOString()
        },
        canReschedule: availableGtas.length > 0,
        availableGtas
      })
    } else {
      slots.push({
        startTime: slotStartTime,
        endTime: slotEndTime,
        timeLabel,
        isReserved: false,
        canReschedule: false,
        availableGtas: []
      })
    }
  }

  const reservedCount = slots.filter((s) => s.isReserved).length
  const vacantCount = slots.length - reservedCount

  return {
    statusCode: 200,
    data: {
      shift: {
        id: shift.id,
        courseId: shift.courseId,
        userId: shift.userId,
        date: dateStr,
        startTime: shift.startTime,
        endTime: shift.endTime,
        gta: {
          id: shift.user.id,
          name: `${shift.user.firstName} ${shift.user.lastName}`.trim(),
          email: shift.user.email,
          avatarUrl: shift.user.avatarUrl
        }
      },
      slots,
      totalSlots: slots.length,
      reservedCount,
      vacantCount
    }
  }
})

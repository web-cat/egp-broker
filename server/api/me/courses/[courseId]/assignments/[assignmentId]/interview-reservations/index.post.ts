import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { assertCourseMember } from '@@/server/utils/gta-interview'
import { createGtaInterviewReservationInputSchema } from '@@/shared/schemas/gta-interview.schema'
import { INTERVIEW_DURATION_MINUTES } from '@@/server/utils/gta-slots'
import type { ApiResponse } from '@@/shared/types/api'

export default defineEventHandler(async (event): Promise<ApiResponse<any>> => {
  const courseId = getRouterParam(event, 'courseId')
  const assignmentId = getRouterParam(event, 'assignmentId')

  if (!courseId || !assignmentId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Course ID and Assignment ID are required'
    })
  }

  const auth = await assertCourseMember(event, courseId)

  const body = await readBody(event)
  const validation = createGtaInterviewReservationInputSchema.safeParse({
    assignmentId,
    ...body
  })

  if (!validation.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid interview reservation parameters',
      data: validation.error.flatten()
    })
  }

  const { startTime: requestedStartTimeStr } = validation.data
  const requestedStartTime = new Date(requestedStartTimeStr)
  const now = new Date()

  if (requestedStartTime <= now) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Cannot schedule an interview appointment in the past'
    })
  }

  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      course: {
        select: {
          id: true,
          interviewLocation: true
        }
      }
    }
  })

  if (!assignment || assignment.courseId !== courseId) {
    throw createError({ statusCode: 404, statusMessage: 'Assignment not found in this course' })
  }

  if (!assignment.hasInterviews) {
    throw createError({
      statusCode: 400,
      statusMessage: 'This assignment does not incorporate grading interviews'
    })
  }

  // Check assignment interview window boundaries
  if (assignment.interviewWindowStart && requestedStartTime < assignment.interviewWindowStart) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Requested appointment is before the assignment interview window opens'
    })
  }

  if (assignment.interviewWindowEnd && requestedStartTime > assignment.interviewWindowEnd) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Requested appointment is after the assignment interview window closes'
    })
  }

  // Ensure student has at most ONE active scheduled interview for this assignment
  const existingActive = await prisma.gtaInterviewReservation.findFirst({
    where: {
      assignmentId,
      studentId: auth.userId,
      status: 'SCHEDULED'
    }
  })

  if (existingActive) {
    throw createError({
      statusCode: 400,
      statusMessage:
        'You already have an active scheduled interview for this assignment. Please cancel or complete your existing appointment before booking another.'
    })
  }

  // Determine on-duty GTAs for this slot
  const dateStr = requestedStartTime.toISOString().split('T')[0]
  const dateMidnightUtc = new Date(`${dateStr}T00:00:00.000Z`)
  const slotTime24 = requestedStartTime.toISOString().substring(11, 16)
  const [slotH, slotM] = slotTime24.split(':').map(Number)
  const slotMinuteOfDay = slotH * 60 + slotM

  const shiftsOnDate = await prisma.gtaShift.findMany({
    where: {
      courseId,
      date: dateMidnightUtc
    }
  })

  // Filter shifts that encompass this slot:
  // shiftStart <= slotMinuteOfDay and slotMinuteOfDay + INTERVIEW_DURATION_MINUTES <= shiftEnd
  const onDutyGtas = shiftsOnDate.filter((s) => {
    const [sh, sm] = s.startTime.split(':').map(Number)
    const [eh, em] = s.endTime.split(':').map(Number)
    const shiftStartMin = sh * 60 + sm
    const shiftEndMin = eh * 60 + em
    return (
      shiftStartMin <= slotMinuteOfDay &&
      slotMinuteOfDay + INTERVIEW_DURATION_MINUTES <= shiftEndMin
    )
  })

  if (onDutyGtas.length === 0) {
    throw createError({
      statusCode: 409,
      statusMessage: 'No Teaching Assistant is on duty for the requested timeslot'
    })
  }

  // Find which of these GTAs already have an active reservation at this exact slot
  const bookedReservations = await prisma.gtaInterviewReservation.findMany({
    where: {
      assignment: { courseId },
      startTime: requestedStartTime,
      status: { notIn: ['CANCELLED', 'MISSED'] }
    },
    select: {
      gtaId: true
    }
  })

  const bookedGtaIdSet = new Set(bookedReservations.map((r) => r.gtaId))
  const availableGtaList = onDutyGtas.filter((s) => !bookedGtaIdSet.has(s.userId))

  if (availableGtaList.length === 0) {
    throw createError({
      statusCode: 409,
      statusMessage: 'This timeslot has just filled up. Please choose another available slot.'
    })
  }

  // Assign the first available GTA
  const assignedGtaId = availableGtaList[0].userId
  const requestedEndTime = new Date(
    requestedStartTime.getTime() + INTERVIEW_DURATION_MINUTES * 60 * 1000
  )

  const reservation = await prisma.gtaInterviewReservation.create({
    data: {
      assignmentId,
      studentId: auth.userId,
      gtaId: assignedGtaId,
      startTime: requestedStartTime,
      endTime: requestedEndTime,
      status: 'SCHEDULED'
    },
    include: {
      gta: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatarUrl: true
        }
      },
      assignment: {
        select: {
          id: true,
          title: true,
          course: {
            select: {
              id: true,
              title: true,
              interviewLocation: true
            }
          }
        }
      }
    }
  })

  return {
    statusCode: 201,
    data: reservation
  }
})

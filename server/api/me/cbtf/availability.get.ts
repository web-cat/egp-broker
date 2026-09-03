import { defineEventHandler, getQuery, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { cbtfAvailabilityQuerySchema } from '@@/shared/schemas/cbtf.schema'
import {
  getPrimaryCbtfFacility,
  getStudentSchedulingWindow,
  getRecommendedDaysAndSlots,
  toCbtfReservationDto
} from '@@/server/utils/cbtf'
import type { ApiResponse } from '@@/shared/types/api'
import type {
  CbtfRecommendedDay,
  CbtfHourlySlotChoice,
  CbtfReservationDto
} from '@@/shared/models/cbtf'

export interface CbtfAvailabilityResponse {
  assignmentTitle: string | null
  studentWindow: {
    start: string
    end: string
    isPassWindow: boolean
  }
  activeReservation: CbtfReservationDto | null
  recommendedDays: CbtfRecommendedDay[]
  hourlySlots: CbtfHourlySlotChoice[]
}

export default defineEventHandler(async (event): Promise<ApiResponse<CbtfAvailabilityResponse>> => {
  const session = await getUserSession(event)
  if (!session?.user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const rawQuery = getQuery(event)
  const queryResult = cbtfAvailabilityQuerySchema.safeParse(rawQuery)
  if (!queryResult.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid availability query',
      data: queryResult.error.flatten()
    })
  }
  const query = queryResult.data

  const assignment = await prisma.assignment.findUnique({
    where: { id: query.assignmentId },
    select: {
      id: true,
      courseId: true,
      title: true,
      isSchedulable: true,
      scheduleWindowStart: true,
      scheduleWindowEnd: true,
      availableFrom: true,
      dueDate: true,
      acceptUntil: true
    }
  })

  if (!assignment || !assignment.isSchedulable) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Assignment is not configured for CBTF scheduling'
    })
  }

  const enrollment = await prisma.enrollment.findFirst({
    where: {
      userId: session.user.id,
      courseId: assignment.courseId
    }
  })

  if (!enrollment && session.user.globalRole === 'USER') {
    throw createError({
      statusCode: 403,
      statusMessage: 'You are not enrolled in this course'
    })
  }

  const activeReservation = await prisma.cbtfReservation.findFirst({
    where: {
      userId: session.user.id,
      assignmentId: assignment.id,
      status: { in: ['SCHEDULED', 'CHECKED_IN'] }
    },
    include: {
      assignment: { select: { title: true } },
      user: { select: { firstName: true, lastName: true, studentId: true, avatarUrl: true } }
    }
  })

  const facility = await getPrimaryCbtfFacility()
  const studentWindow = await getStudentSchedulingWindow(session.user.id, assignment)

  const { recommendedDays, hourlySlots } = await getRecommendedDaysAndSlots(
    facility,
    studentWindow,
    query.timeOfDayPreference,
    query.selectedDate
  )

  return {
    statusCode: 200,
    data: {
      assignmentTitle: assignment.title,
      studentWindow: {
        start: studentWindow.start.toISOString(),
        end: studentWindow.end.toISOString(),
        isPassWindow: studentWindow.isPassWindow
      },
      activeReservation: activeReservation ? toCbtfReservationDto(activeReservation) : null,
      recommendedDays,
      hourlySlots
    }
  }
})

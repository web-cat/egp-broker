import { defineEventHandler, getRouterParam, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { assertCourseMember } from '@@/server/utils/gta-interview'
import {
  calculateGtaSlotsForShifts,
  DEFAULT_GTA_TIMEZONE,
  GTA_INTERVIEW_MIN_LEAD_HOURS
} from '@@/server/utils/gta-slots'
import { getLocalDateString } from '@@/server/utils/cbtf'
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

  await assertCourseMember(event, courseId)

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
      statusMessage: 'This assignment does not require grading interviews'
    })
  }

  const now = new Date()
  const todayLocalStr = getLocalDateString(now, DEFAULT_GTA_TIMEZONE)
  const todayMidnightUtc = new Date(`${todayLocalStr}T00:00:00.000Z`)

  // Fetch upcoming GTA shifts for this course
  const shifts = await prisma.gtaShift.findMany({
    where: {
      courseId,
      date: { gte: todayMidnightUtc }
    }
  })

  // Fetch active reservations across this course to compute accurate on-duty GTA capacity
  const activeReservations = await prisma.gtaInterviewReservation.findMany({
    where: {
      assignment: { courseId },
      startTime: { gte: now },
      status: { notIn: ['CANCELLED', 'MISSED'] }
    },
    select: {
      id: true,
      gtaId: true,
      startTime: true,
      status: true
    }
  })

  const blocks = calculateGtaSlotsForShifts(
    shifts,
    activeReservations,
    assignment.interviewWindowStart,
    assignment.interviewWindowEnd,
    now,
    GTA_INTERVIEW_MIN_LEAD_HOURS,
    DEFAULT_GTA_TIMEZONE
  )

  return {
    statusCode: 200,
    data: {
      assignmentId: assignment.id,
      assignmentTitle: assignment.title,
      interviewLocation: assignment.course.interviewLocation,
      interviewWindowStart: assignment.interviewWindowStart,
      interviewWindowEnd: assignment.interviewWindowEnd,
      blocks
    }
  }
})

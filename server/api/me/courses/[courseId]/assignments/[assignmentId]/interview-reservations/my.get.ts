import { defineEventHandler, getRouterParam, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { assertCourseMember } from '@@/server/utils/gta-interview'
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

  // First look for active reservation
  let reservation = await prisma.gtaInterviewReservation.findFirst({
    where: {
      assignmentId,
      studentId: auth.userId,
      status: { in: ['SCHEDULED', 'CHECKED_IN'] }
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
    },
    orderBy: { startTime: 'asc' }
  })

  // If no active reservation, retrieve most recent historical reservation
  if (!reservation) {
    reservation = await prisma.gtaInterviewReservation.findFirst({
      where: {
        assignmentId,
        studentId: auth.userId
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
      },
      orderBy: { createdAt: 'desc' }
    })
  }

  return {
    statusCode: 200,
    data: reservation
  }
})

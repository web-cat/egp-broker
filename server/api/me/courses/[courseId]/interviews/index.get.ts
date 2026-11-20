import { defineEventHandler, getRouterParam, getQuery, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { assertCourseMember } from '@@/server/utils/gta-interview'
import type { ApiResponse } from '@@/shared/types/api'

export default defineEventHandler(async (event): Promise<ApiResponse<any[]>> => {
  const courseId = getRouterParam(event, 'courseId')
  if (!courseId) {
    throw createError({ statusCode: 400, statusMessage: 'Course ID is required' })
  }

  const auth = await assertCourseMember(event, courseId)
  if (!auth.isInstructor && !auth.isGta) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden: Graduate TA or Instructor role required'
    })
  }

  const query = getQuery(event)
  const whereClause: any = {
    assignment: { courseId }
  }

  // GTAs can only access interviews assigned to them; instructors/admins can access all or filter by gtaId
  if (!auth.isInstructor) {
    whereClause.gtaId = auth.userId
  } else if (query.gtaId) {
    whereClause.gtaId = String(query.gtaId)
  }

  if (query.status) {
    whereClause.status = String(query.status)
  }

  if (query.date) {
    const dateStr = String(query.date)
    whereClause.startTime = {
      gte: new Date(`${dateStr}T00:00:00.000Z`),
      lte: new Date(`${dateStr}T23:59:59.999Z`)
    }
  }

  const reservations = await prisma.gtaInterviewReservation.findMany({
    where: whereClause,
    include: {
      assignment: {
        select: { id: true, title: true }
      },
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatarUrl: true
        }
      },
      gta: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      }
    },
    orderBy: { startTime: 'asc' }
  })

  if (reservations.length === 0) {
    return {
      statusCode: 200,
      data: []
    }
  }

  const assignmentIds = Array.from(new Set(reservations.map((r) => r.assignmentId)))
  const studentIds = Array.from(new Set(reservations.map((r) => r.studentId)))

  const [notices, priorInterviews] = await Promise.all([
    prisma.studentAssignmentNotice.findMany({
      where: {
        assignmentId: { in: assignmentIds },
        studentId: { in: studentIds }
      },
      select: {
        id: true,
        assignmentId: true,
        studentId: true,
        notice: true,
        updatedAt: true
      }
    }),
    prisma.gtaInterviewReservation.findMany({
      where: {
        assignmentId: { in: assignmentIds },
        studentId: { in: studentIds },
        notes: { not: null }
      },
      select: {
        id: true,
        assignmentId: true,
        studentId: true,
        startTime: true,
        endTime: true,
        status: true,
        notes: true,
        gta: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: { startTime: 'desc' }
    })
  ])

  const noticeMap = new Map<string, { id: string; notice: string; updatedAt: Date }>()
  for (const n of notices) {
    noticeMap.set(`${n.assignmentId}:${n.studentId}`, {
      id: n.id,
      notice: n.notice,
      updatedAt: n.updatedAt
    })
  }

  const reservationsWithNotices = reservations.map((r) => {
    const rTime = new Date(r.startTime).getTime()
    const studentPrior = (priorInterviews || []).filter((p) => {
      if (p.assignmentId !== r.assignmentId || p.studentId !== r.studentId) return false
      if (p.id === r.id) return false
      if (!p.notes || p.notes.trim().length === 0) return false
      const pTime = new Date(p.startTime).getTime()
      return pTime < rTime || (pTime === rTime && p.id !== r.id)
    })

    return {
      ...r,
      studentAssignmentNotice: noticeMap.get(`${r.assignmentId}:${r.studentId}`) || null,
      priorInterviews: studentPrior
    }
  })

  return {
    statusCode: 200,
    data: reservationsWithNotices
  }
})

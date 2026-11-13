import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { assertCourseMember } from '@@/server/utils/gta-interview'
import { batchUpsertStudentAssignmentNoticesSchema } from '@@/shared/schemas/assignment-notice.schema'
import type { BatchUpsertNoticesResult } from '@@/shared/schemas/assignment-notice.schema'
import type { ApiResponse } from '@@/shared/types/api'

export default defineEventHandler(async (event): Promise<ApiResponse<BatchUpsertNoticesResult>> => {
  const courseId = getRouterParam(event, 'courseId')
  const assignmentId = getRouterParam(event, 'assignmentId')

  if (!courseId || !assignmentId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Course ID and Assignment ID are required'
    })
  }

  const auth = await assertCourseMember(event, courseId)
  if (!auth.isInstructor && !auth.isGta) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden: Course staff (Instructor or TA) role required'
    })
  }

  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId }
  })

  if (!assignment || assignment.courseId !== courseId) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Assignment not found in this course'
    })
  }

  const rawBody = await readBody(event)
  const parseResult = batchUpsertStudentAssignmentNoticesSchema.safeParse(rawBody)

  if (!parseResult.success) {
    const errorDetail = parseResult.error.issues
      .map((i) => `${i.path.join('.') || 'root'}: ${i.message}`)
      .join('; ')
    console.error(
      `[notices/batch.post.ts] Validation failure on course ${courseId}, assignment ${assignmentId}:`,
      errorDetail,
      'Raw body:',
      rawBody
    )
    throw createError({
      statusCode: 400,
      statusMessage: `Validation failed: ${errorDetail}`,
      data: parseResult.error.issues
    })
  }

  const { notices } = parseResult.data

  // Fetch all enrolled users for this course to resolve student identifiers
  const enrollments = await prisma.enrollment.findMany({
    where: { courseId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          studentId: true
        }
      }
    }
  })

  const userByEmail = new Map<string, string>()
  const userByStudentId = new Map<string, string>()
  const userById = new Map<string, string>()

  for (const e of enrollments) {
    if (e.user) {
      if (e.user.email) {
        userByEmail.set(e.user.email.trim().toLowerCase(), e.user.id)
      }
      if (e.user.studentId) {
        userByStudentId.set(e.user.studentId.trim().toLowerCase(), e.user.id)
      }
      userById.set(e.user.id, e.user.id)
    }
  }

  const unmatchedIdentifiers: string[] = []
  const matchedItems: Array<{ studentId: string; notice: string }> = []

  for (const item of notices) {
    const rawIdent = item.studentIdentifier.trim()
    const lowerIdent = rawIdent.toLowerCase()

    const resolvedUserId =
      userByEmail.get(lowerIdent) || userByStudentId.get(lowerIdent) || userById.get(rawIdent)

    if (!resolvedUserId) {
      unmatchedIdentifiers.push(rawIdent)
    } else {
      matchedItems.push({
        studentId: resolvedUserId,
        notice: item.notice
      })
    }
  }

  if (matchedItems.length === 0) {
    return {
      statusCode: 200,
      data: {
        createdCount: 0,
        updatedCount: 0,
        unmatchedIdentifiers,
        totalProcessed: notices.length
      }
    }
  }

  // Determine which notices already exist vs are new
  const matchedUserIds = Array.from(new Set(matchedItems.map((m) => m.studentId)))
  const existingNotices = await prisma.studentAssignmentNotice.findMany({
    where: {
      assignmentId,
      studentId: { in: matchedUserIds }
    },
    select: { studentId: true }
  })
  const existingUserSet = new Set(existingNotices.map((n) => n.studentId))

  let createdCount = 0
  let updatedCount = 0

  // Upsert in transaction
  const upsertOperations = matchedItems.map((item) => {
    const isExisting = existingUserSet.has(item.studentId)
    if (isExisting) {
      updatedCount++
    } else {
      createdCount++
      existingUserSet.add(item.studentId) // If duplicate students exist in payload
    }

    return prisma.studentAssignmentNotice.upsert({
      where: {
        assignmentId_studentId: {
          assignmentId,
          studentId: item.studentId
        }
      },
      create: {
        assignmentId,
        studentId: item.studentId,
        authorId: auth.userId,
        notice: item.notice
      },
      update: {
        authorId: auth.userId,
        notice: item.notice
      }
    })
  })

  await prisma.$transaction(upsertOperations)

  return {
    statusCode: 200,
    data: {
      createdCount,
      updatedCount,
      unmatchedIdentifiers,
      totalProcessed: notices.length
    }
  }
})

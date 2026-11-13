import { defineEventHandler, getRouterParam, readBody, readRawBody, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { assertCourseMember } from '@@/server/utils/gta-interview'
import { batchUpsertStudentAssignmentNoticesSchema } from '@@/shared/schemas/assignment-notice.schema'
import type { BatchUpsertNoticesResult } from '@@/shared/schemas/assignment-notice.schema'
import type { ApiResponse } from '@@/shared/types/api'

export default defineEventHandler(async (event): Promise<ApiResponse<BatchUpsertNoticesResult>> => {
  const courseId = getRouterParam(event, 'courseId')
  const assignmentId = getRouterParam(event, 'assignmentId')

  try {
    console.log(
      `[notices/batch] Received request: courseId=${courseId}, assignmentId=${assignmentId}, method=${event.method}`
    )

    if (!courseId || !assignmentId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Course ID and Assignment ID are required',
        message: 'Course ID and Assignment ID are required'
      })
    }

    const auth = await assertCourseMember(event, courseId)
    if (!auth.isInstructor && !auth.isGta) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden: Course staff (Instructor or TA) role required',
        message: 'Forbidden: Course staff (Instructor or TA) role required'
      })
    }

    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId }
    })

    if (!assignment || assignment.courseId !== courseId) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Assignment not found in this course',
        message: 'Assignment not found in this course'
      })
    }

    let rawBody: unknown
    try {
      rawBody = await readBody(event)
    } catch (readErr: any) {
      console.warn('[notices/batch] readBody failed, attempting raw body read:', readErr?.message)
      try {
        const rawText = await readRawBody(event, 'utf8')
        if (rawText) {
          rawBody = JSON.parse(rawText)
        }
      } catch (rawErr: any) {
        console.error('[notices/batch] readRawBody fallback also failed:', rawErr?.message)
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid or unreadable request body',
          message: `Invalid or unreadable request body: ${readErr?.message || rawErr?.message || 'unknown error'}`
        })
      }
    }

    // If body arrived as a JSON string, parse it
    if (typeof rawBody === 'string') {
      try {
        rawBody = JSON.parse(rawBody)
      } catch {
        // Leave as-is, safeParse will handle or report
      }
    }

    // If body arrived as a bare array of items, normalize to { notices: [...] }
    if (Array.isArray(rawBody)) {
      rawBody = { notices: rawBody }
    }

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
        message: `Validation failed: ${errorDetail}`,
        data: {
          detail: errorDetail,
          issues: parseResult.error.issues
        }
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
    const userByUsernamePrefix = new Map<string, string | 'AMBIGUOUS'>()

    for (const e of enrollments) {
      if (e.user) {
        if (e.user.email) {
          const email = e.user.email.trim().toLowerCase()
          userByEmail.set(email, e.user.id)
          const atIndex = email.indexOf('@')
          if (atIndex > 0) {
            const prefix = email.slice(0, atIndex)
            if (userByUsernamePrefix.has(prefix)) {
              userByUsernamePrefix.set(prefix, 'AMBIGUOUS')
            } else {
              userByUsernamePrefix.set(prefix, e.user.id)
            }
          }
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

      let resolvedUserId =
        userByEmail.get(lowerIdent) || userByStudentId.get(lowerIdent) || userById.get(rawIdent)

      if (!resolvedUserId) {
        const prefixMatch = userByUsernamePrefix.get(lowerIdent)
        if (prefixMatch && prefixMatch !== 'AMBIGUOUS') {
          resolvedUserId = prefixMatch
        }
      }

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

    // Deduplicate matchedItems by studentId: if multiple notices exist for the same student in
    // the batch payload, take the last one to prevent conflicting upserts in the same transaction
    const latestMatchedByStudent = new Map<string, { studentId: string; notice: string }>()
    for (const m of matchedItems) {
      latestMatchedByStudent.set(m.studentId, m)
    }
    const dedupedMatchedItems = Array.from(latestMatchedByStudent.values())

    // Determine which notices already exist vs are new
    const matchedUserIds = dedupedMatchedItems.map((m) => m.studentId)
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
    const upsertOperations = dedupedMatchedItems.map((item) => {
      const isExisting = existingUserSet.has(item.studentId)
      if (isExisting) {
        updatedCount++
      } else {
        createdCount++
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

    console.log(
      `[notices/batch] Successfully processed ${notices.length} notices for assignment ${assignmentId}: created=${createdCount}, updated=${updatedCount}, unmatched=${unmatchedIdentifiers.length}`
    )

    return {
      statusCode: 200,
      data: {
        createdCount,
        updatedCount,
        unmatchedIdentifiers,
        totalProcessed: notices.length
      }
    }
  } catch (err: any) {
    console.error('[notices/batch] Handler error caught:', {
      message: err?.message,
      statusMessage: err?.statusMessage,
      statusCode: err?.statusCode,
      data: err?.data,
      stack: err?.stack
    })
    throw err
  }
})

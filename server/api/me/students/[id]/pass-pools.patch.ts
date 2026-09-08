import { defineEventHandler, createError, getRouterParam, readValidatedBody } from 'h3'
import prisma from '@@/server/utils/db'
import type { ApiResponse } from '@@/shared/types/api'
import type { StudentPassBalance } from '@@/shared/models/teacher'
import { updateStudentPassPoolsSchema } from '@@/shared/models/teacher'

export default defineEventHandler(async (event): Promise<ApiResponse<StudentPassBalance[]>> => {
  const session = await getUserSession(event)

  if (!session.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const studentId = getRouterParam(event, 'id')
  if (!studentId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Student ID is required'
    })
  }

  // Get current user and enrollment context to verify teacher/admin permissions
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      currentCourseId: true,
      globalRole: true,
      enrollments: {
        where: { role: { in: ['TEACHER', 'ADMIN'] } },
        select: { courseId: true }
      }
    }
  })

  const courseId = user?.currentCourseId
  const isAuthorized =
    user?.globalRole === 'ADMIN' ||
    (courseId ? user?.enrollments.some((e) => e.courseId === courseId) : false)

  if (!courseId || !isAuthorized) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden'
    })
  }

  // Parse and validate payload
  const body = await readValidatedBody(event, updateStudentPassPoolsSchema.parse)

  // Verify student is enrolled in the course
  const studentEnrollment = await prisma.enrollment.findUnique({
    where: {
      userId_courseId: {
        userId: studentId,
        courseId
      }
    }
  })

  if (!studentEnrollment) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Student is not enrolled in this course'
    })
  }

  // Fetch valid pass types for this course
  const coursePassTypes = await prisma.passType.findMany({
    where: { courseId },
    select: { id: true, name: true, initialBalance: true }
  })
  const coursePassTypeMap = new Map(coursePassTypes.map((pt) => [pt.id, pt]))

  for (const b of body.balances) {
    if (!coursePassTypeMap.has(b.passTypeId)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Pass type ${b.passTypeId} does not belong to this course`
      })
    }
  }

  // Upsert pass pools within a transaction
  await prisma.$transaction(
    body.balances.map((b) =>
      prisma.studentPassPool.upsert({
        where: {
          userId_passTypeId: {
            userId: studentId,
            passTypeId: b.passTypeId
          }
        },
        create: {
          userId: studentId,
          passTypeId: b.passTypeId,
          balance: b.balance
        },
        update: {
          balance: b.balance
        }
      })
    )
  )

  // Fetch all current pools to return projected StudentPassBalance[]
  const updatedPools = await prisma.studentPassPool.findMany({
    where: {
      userId: studentId,
      passTypeId: { in: coursePassTypes.map((pt) => pt.id) }
    }
  })

  const passBalances: StudentPassBalance[] = coursePassTypes.map((pt) => {
    const pool = updatedPools.find((p) => p.passTypeId === pt.id)
    return {
      passTypeId: pt.id,
      passTypeName: pt.name,
      balance: pool ? pool.balance : pt.initialBalance,
      initialBalance: pt.initialBalance
    }
  })

  return {
    statusCode: 200,
    data: passBalances
  }
})

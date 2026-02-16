import { defineEventHandler, getValidatedQuery, createError } from 'h3'
import prisma from '@@/lib/prisma'
import type { ApiResponse } from '@@/shared/types/api'
import { AdminAssignmentQuerySchema } from '@@/shared/schemas/admin.schema'

export default defineEventHandler(async (event): Promise<ApiResponse<AssignmentRow[]>> => {
  const session = await getUserSession(event)

  if (!session.user || session.user.globalRole !== 'ADMIN') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden'
    })
  }

  const query = await getValidatedQuery(event, AdminAssignmentQuerySchema.parse)
  const courseCodeParam = query.c

  // Build the where clause: optionally filter by course label (code)
  const where: Record<string, unknown> = {}
  if (courseCodeParam) {
    where.course = { label: courseCodeParam }
  }

  const assignments = await prisma.assignment.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      course: { select: { label: true, title: true } }
    }
  })

  const data: AssignmentRow[] = assignments.map((a) => ({
    id: a.id,
    resourceLinkId: a.resourceLinkId,
    title: a.title,
    canvasAssignmentId: a.canvasAssignmentId,
    courseLabel: a.course.label,
    courseTitle: a.course.title,
    dueDate: a.dueDate?.toISOString() ?? null,
    availableFrom: a.availableFrom?.toISOString() ?? null,
    acceptUntil: a.acceptUntil?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString()
  }))

  return {
    statusCode: 200,
    data
  }
})

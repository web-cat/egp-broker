import prisma from '@@/server/utils/db'
import type { CourseRow, CreateCourseData, AdminCourseQuery } from '@@/shared/models/course'

export const courseRowSelect = {
  id: true,
  ltiContextId: true,
  label: true,
  title: true,
  canvasCourseId: true,
  workflowState: true,
  createdAt: true,
  _count: {
    select: {
      enrollments: true,
      assignments: true
    }
  }
} as const

/**
 * Validates and retrieves all courses, formatted as strict CourseRows.
 * Supports filtering by deployment (logical ID) or platform (PK).
 */
export async function getAllCourses(filters?: AdminCourseQuery): Promise<CourseRow[]> {
  const where: Record<string, unknown> = {}

  if (filters?.d) {
    const deployment = await prisma.ltiDeployment.findFirst({
      where: { deploymentId: filters.d },
      select: { id: true }
    })

    if (!deployment) {
      throw createError({
        statusCode: 404,
        statusMessage: `Deployment "${filters.d}" not found`
      })
    }
    where.deploymentId = deployment.id
  } else if (filters?.p) {
    where.deployment = { platformId: filters.p }
  }

  const courses = await prisma.course.findMany({
    where,
    select: courseRowSelect,
    orderBy: { createdAt: 'desc' }
  })

  return courses.map((c) => ({
    id: c.id,
    ltiContextId: c.ltiContextId ?? '',
    label: c.label,
    title: c.title,
    canvasCourseId: c.canvasCourseId,
    workflowState: c.workflowState,
    enrollmentCount: c._count.enrollments,
    assignmentCount: c._count.assignments,
    createdAt: c.createdAt.toISOString()
  }))
}

/**
 * Retrieves a single course by ID, formatted as strict CourseRow.
 */
export async function getCourse(id: string): Promise<CourseRow | null> {
  const course = await prisma.course.findUnique({
    where: { id },
    select: courseRowSelect
  })

  if (!course) return null

  return {
    id: course.id,
    ltiContextId: course.ltiContextId ?? '',
    label: course.label,
    title: course.title,
    canvasCourseId: course.canvasCourseId,
    workflowState: course.workflowState,
    enrollmentCount: course._count.enrollments,
    assignmentCount: course._count.assignments,
    createdAt: course.createdAt.toISOString()
  }
}

/**
 * Creates a new course.
 */
export async function createCourse(data: CreateCourseData): Promise<CourseRow> {
  const course = await prisma.course.create({
    data,
    select: courseRowSelect
  })

  return {
    id: course.id,
    ltiContextId: course.ltiContextId ?? '',
    label: course.label,
    title: course.title,
    canvasCourseId: course.canvasCourseId,
    workflowState: course.workflowState,
    enrollmentCount: course._count.enrollments,
    assignmentCount: course._count.assignments,
    createdAt: course.createdAt.toISOString()
  }
}

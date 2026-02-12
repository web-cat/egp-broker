import { defineEventHandler } from 'h3'
import prisma from '@@/lib/prisma'
import type { ApiResponse } from '@@/shared/types/api'

export interface AssignmentRow {
  id: string
  resourceLinkId: string
  title: string | null
  canvasAssignmentId: string | null
  courseLabel: string | null
  courseTitle: string | null
  dueDate: string | null
  availableFrom: string | null
  acceptUntil: string | null
  createdAt: string
  eligiblePassTypeNames?: string[]
  [key: string]: any
}

export default defineEventHandler(async (event): Promise<ApiResponse<AssignmentRow[]>> => {
  const session = await getUserSession(event)

  if (!session.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  // Get current course context
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { currentCourseId: true }
  })

  const courseId = user?.currentCourseId

  if (!courseId) {
    return {
      statusCode: 200,
      data: []
    }
  }

  // Fetch assignments and pass types for this course
  const [assignments, passTypes] = await Promise.all([
    prisma.assignment.findMany({
      where: { courseId },
      orderBy: { createdAt: 'desc' },
      include: {
        course: { select: { label: true, title: true } }
      }
    }),
    prisma.passType.findMany({
      where: { courseId },
      include: {
        eligibilities: true
      }
    })
  ])

  const data: AssignmentRow[] = assignments.map((a) => {
    // Determine which pass types are eligible for this assignment
    const eligiblePassTypeNames = passTypes
      .filter((pt) => {
        // 1. Direct Eligibility Records (White-listing)
        // If specific direct assignment eligibility records exist, they must be checked first
        const directEligibilities = pt.eligibilities.filter((e) => e.assignmentId !== null)
        if (directEligibilities.length > 0) {
          if (directEligibilities.some((e) => e.assignmentId === a.id)) return true
        }

        // 2. Pattern Match
        if (pt.titlePattern && a.title) {
          const pattern = pt.titlePattern
            .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
            .replace(/[%*]/g, '.*')
          const regex = new RegExp(`^${pattern}$`, 'i')
          if (regex.test(a.title)) return true
        }

        // 3. Fallback: If there are NO direct IDs and there's no pattern,
        // it's usable for all assignments in the course.
        if (directEligibilities.length === 0 && !pt.titlePattern) return true

        return false
      })
      .map((pt) => pt.name)

    return {
      id: a.id,
      resourceLinkId: a.resourceLinkId,
      title: a.title,
      canvasAssignmentId: a.canvasAssignmentId,
      courseLabel: a.course.label,
      courseTitle: a.course.title,
      dueDate: a.dueDate?.toISOString() ?? null,
      availableFrom: a.availableFrom?.toISOString() ?? null,
      acceptUntil: a.acceptUntil?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
      eligiblePassTypeNames
    }
  })

  return {
    statusCode: 200,
    data
  }
})

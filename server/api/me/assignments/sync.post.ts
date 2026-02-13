import { defineEventHandler } from 'h3'
import prisma from '@@/lib/prisma'
import type { ApiResponse } from '@@/shared/types/api'
import type { AssignmentRow } from '@@/shared/models/assignment'
import { fetchCanvasAssignments } from '@@/server/utils/canvas'

export default defineEventHandler(async (event): Promise<ApiResponse<AssignmentRow[]>> => {
  const session = await getUserSession(event)

  if (!session.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  // 1. Get current course context and user role validation
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      currentCourseId: true,
      currentCourse: {
        select: {
          id: true,
          canvasCourseId: true,
          deployment: {
            select: {
              id: true,
              deploymentHost: true,
              platform: {
                select: {
                  id: true,
                  issuer: true
                }
              }
            }
          }
        }
      }
    }
  })

  const course = user?.currentCourse
  if (!course || !course.deployment || !course.deployment.platform) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Course context or LTI configuration missing'
    })
  }

  // Check enrollment/role
  const enrollment = await prisma.enrollment.findUnique({
    where: {
      userId_courseId: {
        userId: user.id,
        courseId: course.id
      }
    }
  })

  if (!enrollment || !['TEACHER', 'TA', 'ADMIN', 'DESIGNER'].includes(enrollment.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  // Wait, I can't query by [platformId, ltiSub] if I don't have ltiSub easily.
  // I should find by userId and platformId.
  const platformIdentity = await prisma.ltiIdentity.findUnique({
    where: {
      userId_platformId: {
        userId: user.id,
        platformId: course.deployment.platform.id
      }
    }
  })

  if (!platformIdentity || !platformIdentity.platformApiKey) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No LTI API Key found. Please launch from the LMS first.'
    })
  }

  if (!course.canvasCourseId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Canvas Course ID not found in course context.'
    })
  }

  // 3. Fetch from Canvas
  // Domain is platform issuer? Issuer is usually 'https://canvas.instructure.com'.
  // But usage of API needs the domain.
  // `deploymentHost` might be the domain?
  // Or we can parse it from the auth endpoint or issuer.
  // Issuer for Canvas: "https://canvas.instructure.com" or "https://<domain>"
  // Let's try to extract domain from issuer or deploymentHost.
  let domain = course.deployment.deploymentHost
  if (!domain) {
    // Fallback: try parsing issuer
    try {
      const url = new URL(course.deployment.platform.issuer)
      domain = url.hostname
    } catch {
      throw createError({ statusCode: 500, statusMessage: 'Could not determine Canvas domain.' })
    }
  }

  const canvasAssignments = await fetchCanvasAssignments(
    domain!,
    course.canvasCourseId,
    platformIdentity.platformApiKey
  )

  // 4. Sync Logic
  for (const ca of canvasAssignments) {
    const canvasIdStr = ca.id.toString()

    // Attempt 1: Find by canvasAssignmentId
    let assignment = await prisma.assignment.findFirst({
      where: {
        courseId: course.id,
        canvasAssignmentId: canvasIdStr
      }
    })

    // Attempt 2: Find by Title where canvasAssignmentId is null
    if (!assignment) {
      assignment = await prisma.assignment.findFirst({
        where: {
          courseId: course.id,
          title: ca.name,
          canvasAssignmentId: null
        }
      })
    }

    if (assignment) {
      // Update
      assignment = await prisma.assignment.update({
        where: { id: assignment.id },
        data: {
          title: ca.name,
          canvasAssignmentId: canvasIdStr,
          dueDate: ca.due_at ? new Date(ca.due_at) : null,
          availableFrom: ca.unlock_at ? new Date(ca.unlock_at) : null,
          acceptUntil: ca.lock_at ? new Date(ca.lock_at) : null
          // Do not overwrite resourceLinkId if it exists
        }
      })
    } else {
      // Create new
      assignment = await prisma.assignment.create({
        data: {
          courseId: course.id,
          title: ca.name,
          canvasAssignmentId: canvasIdStr,
          dueDate: ca.due_at ? new Date(ca.due_at) : null,
          availableFrom: ca.unlock_at ? new Date(ca.unlock_at) : null,
          acceptUntil: ca.lock_at ? new Date(ca.lock_at) : null,
          resourceLinkId: undefined // Optional now
        }
      })
    }

    // Auto-eligibility sync
    await syncAssignmentEligibility(assignment.id)
  }

  // 5. Fetch and return updated list (reusing logic from assignments.get.ts essentially)
  const assignments = await prisma.assignment.findMany({
    where: { courseId: course.id },
    orderBy: [{ dueDate: 'desc' }, { title: 'asc' }],
    include: {
      course: { select: { label: true, title: true } },
      passEligibilities: {
        include: { passType: true }
      }
    }
  })

  const data: AssignmentRow[] = assignments.map((a) => {
    const eligiblePassTypeNames = a.passEligibilities.map((pe) => pe.passType.name)
    return {
      id: a.id,
      resourceLinkId: a.resourceLinkId ?? '', // Handle nullable
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

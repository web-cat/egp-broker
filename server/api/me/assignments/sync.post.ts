import { defineEventHandler } from 'h3'
import prisma from '@@/server/utils/db'
import type { ApiResponse } from '@@/shared/types/api'
import type { AssignmentRow } from '@@/shared/models/assignment'
import {
  fetchCanvasAssignments,
  fetchCanvasAssignmentOverrides,
  fetchCanvasSections,
  getPlatformCanvasDomain
} from '@@/server/utils/canvas'

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
                  issuer: true,
                  authEndpoint: true,
                  tokenEndpoint: true,
                  jwksEndpoint: true
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

  // 3. Fetch from Canvas using resolved tenant domain
  const domain = getPlatformCanvasDomain(
    course.deployment.platform,
    course.deployment.deploymentHost
  )

  console.info(
    `[Canvas Sync] Syncing sections and assignments from domain "${domain}" for courseId "${course.canvasCourseId}"`
  )

  // 3a. Fetch and sync sections
  const canvasSections = await fetchCanvasSections(
    domain,
    course.canvasCourseId,
    platformIdentity.platformApiKey
  )

  const sectionMap = new Map<string, string>() // canvasSectionId -> db Section id
  for (const cs of canvasSections) {
    const canvasSecIdStr = cs.id.toString()
    const dbSection = await prisma.courseSection.upsert({
      where: {
        courseId_canvasSectionId: {
          courseId: course.id,
          canvasSectionId: canvasSecIdStr
        }
      },
      create: {
        courseId: course.id,
        canvasSectionId: canvasSecIdStr,
        name: cs.name
      },
      update: {
        name: cs.name
      }
    })
    sectionMap.set(canvasSecIdStr, dbSection.id)

    // Sync section enrollments if present
    if (cs.enrollments && Array.isArray(cs.enrollments)) {
      for (const en of cs.enrollments) {
        const platformUserId = en.user_id?.toString()
        if (!platformUserId) continue

        const ltiIdent = await prisma.ltiIdentity.findFirst({
          where: {
            platformId: course.deployment.platform.id,
            platformUserId
          },
          select: { userId: true }
        })

        if (ltiIdent) {
          await prisma.enrollment.updateMany({
            where: {
              userId: ltiIdent.userId,
              courseId: course.id
            },
            data: { courseSectionId: dbSection.id }
          })
        }
      }
    }
  }

  // 3b. Fetch and sync assignments with overrides
  const canvasAssignments = await fetchCanvasAssignments(
    domain,
    course.canvasCourseId,
    platformIdentity.platformApiKey
  )

  console.info(
    `[Canvas Sync] Retrieved ${canvasAssignments.length} assignment(s) from Canvas. Processing DB upserts...`
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
          acceptUntil: ca.lock_at ? new Date(ca.lock_at) : null,
          published: ca.published ?? true
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
          published: ca.published ?? true,
          resourceLinkId: undefined // Optional now
        }
      })
    }

    // Process assignment overrides from Canvas
    const passRedemptions = await prisma.passRedemption.findMany({
      where: { assignmentId: assignment.id, canvasOverrideId: { not: null } },
      select: { canvasOverrideId: true }
    })
    const passOverrideIds = new Set(
      passRedemptions.map((r) => r.canvasOverrideId).filter((id): id is string => Boolean(id))
    )

    const syncedOverrideIds: string[] = []

    let rawOverrides = ca.overrides
    if ((!rawOverrides || rawOverrides.length === 0) && ca.has_overrides) {
      rawOverrides = await fetchCanvasAssignmentOverrides(
        domain,
        course.canvasCourseId,
        ca.id,
        platformIdentity.platformApiKey
      )
    }

    if (rawOverrides && Array.isArray(rawOverrides)) {
      for (const ov of rawOverrides) {
        const overrideIdStr = ov.id.toString()
        // Skip if this is a pass-generated override
        if (passOverrideIds.has(overrideIdStr) || ov.title?.startsWith('[EGP Pass]')) {
          continue
        }

        const courseSectionDbId = ov.course_section_id
          ? (sectionMap.get(ov.course_section_id.toString()) ?? null)
          : null

        const dbOverride = await prisma.assignmentOverride.upsert({
          where: {
            assignmentId_canvasOverrideId: {
              assignmentId: assignment.id,
              canvasOverrideId: overrideIdStr
            }
          },
          create: {
            assignmentId: assignment.id,
            canvasOverrideId: overrideIdStr,
            title: ov.title,
            dueDate: ov.due_at ? new Date(ov.due_at) : null,
            availableFrom: ov.unlock_at ? new Date(ov.unlock_at) : null,
            acceptUntil: ov.lock_at ? new Date(ov.lock_at) : null,
            courseSectionId: courseSectionDbId
          },
          update: {
            title: ov.title,
            dueDate: ov.due_at ? new Date(ov.due_at) : null,
            availableFrom: ov.unlock_at ? new Date(ov.unlock_at) : null,
            acceptUntil: ov.lock_at ? new Date(ov.lock_at) : null,
            courseSectionId: courseSectionDbId
          }
        })

        syncedOverrideIds.push(dbOverride.id)

        // If this override targets individual students
        if (ov.student_ids && Array.isArray(ov.student_ids) && ov.student_ids.length > 0) {
          const studentIdStrs = ov.student_ids.map((id) => id.toString())
          const identities = await prisma.ltiIdentity.findMany({
            where: {
              platformId: course.deployment.platform.id,
              platformUserId: { in: studentIdStrs }
            },
            select: { userId: true }
          })

          const targetUserIds = identities.map((i) => i.userId)

          // Sync join table AssignmentOverrideStudent
          await prisma.assignmentOverrideStudent.deleteMany({
            where: {
              overrideId: dbOverride.id,
              userId: { notIn: targetUserIds }
            }
          })

          for (const uid of targetUserIds) {
            await prisma.assignmentOverrideStudent.upsert({
              where: {
                overrideId_userId: {
                  overrideId: dbOverride.id,
                  userId: uid
                }
              },
              create: {
                overrideId: dbOverride.id,
                userId: uid
              },
              update: {}
            })
          }
        } else {
          // Clear any student links if not student_ids
          await prisma.assignmentOverrideStudent.deleteMany({
            where: { overrideId: dbOverride.id }
          })
        }
      }
    }

    // Prune instructor overrides deleted from Canvas
    await prisma.assignmentOverride.deleteMany({
      where: {
        assignmentId: assignment.id,
        id: { notIn: syncedOverrideIds }
      }
    })

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

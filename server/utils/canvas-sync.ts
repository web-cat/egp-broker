import prisma from '@@/server/utils/db'
import {
  fetchCanvasAssignments,
  fetchCanvasAssignmentOverrides,
  fetchCanvasSections,
  getPlatformCanvasDomain
} from '@@/server/utils/canvas'
import { matchLtiToolForLaunchUrl, syncAssignmentEligibility } from '@@/server/utils/assignments'

export interface CanvasSyncResult {
  assignmentCount: number
  sectionCount: number
}

/**
 * Headless synchronization of Canvas sections, assignments, and overrides for a course.
 * Can be invoked from API endpoints or background/cron tasks.
 *
 * Persists assignment metadata including `published` status, dates, and tool bindings.
 */
export async function syncCourseAssignmentsFromCanvas(
  courseId: string,
  apiKey: string
): Promise<CanvasSyncResult> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
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
  })

  if (!course || !course.deployment || !course.deployment.platform) {
    throw new Error(`Course context or LTI configuration missing for course: ${courseId}`)
  }

  if (!course.canvasCourseId) {
    throw new Error(`Canvas Course ID not found for course: ${courseId}`)
  }

  const domain = getPlatformCanvasDomain(
    course.deployment.platform,
    course.deployment.deploymentHost
  )

  console.info(
    `[Canvas Sync] Syncing sections and assignments from domain "${domain}" for courseId "${course.canvasCourseId}"`
  )

  // 1. Fetch and sync sections
  const canvasSections = await fetchCanvasSections(domain, course.canvasCourseId, apiKey)

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

  // 2. Fetch and sync assignments with overrides
  const canvasAssignments = await fetchCanvasAssignments(domain, course.canvasCourseId, apiKey)

  console.info(
    `[Canvas Sync] Retrieved ${canvasAssignments.length} assignment(s) from Canvas. Processing DB upserts...`
  )

  // Fetch registered LTI tools once for matching external tool URLs
  const registeredTools = await prisma.ltiTool.findMany({
    select: { id: true, baseUrl: true }
  })

  // 3. Process each Canvas assignment
  for (const ca of canvasAssignments) {
    const canvasIdStr = ca.id.toString()
    const launchUrl = ca.external_tool_tag_attributes?.url
    const matchedToolId = matchLtiToolForLaunchUrl(launchUrl, registeredTools)
    const canvasResourceLinkId = ca.external_tool_tag_attributes?.resource_link_id
    const isPublished = typeof ca.published === 'boolean' ? ca.published : true

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
      // Update existing assignment including published status
      const updateData: Record<string, any> = {
        title: ca.name,
        canvasAssignmentId: canvasIdStr,
        dueDate: ca.due_at ? new Date(ca.due_at) : null,
        availableFrom: ca.unlock_at ? new Date(ca.unlock_at) : null,
        acceptUntil: ca.lock_at ? new Date(ca.lock_at) : null,
        published: isPublished
      }

      // Automatically link external tool if matched and not previously configured
      if (matchedToolId && !assignment.toolId) {
        updateData.toolId = matchedToolId
      }

      // Automatically link resource link ID if present and not already set
      if (canvasResourceLinkId && !assignment.resourceLinkId) {
        updateData.resourceLinkId = canvasResourceLinkId
      }

      assignment = await prisma.assignment.update({
        where: { id: assignment.id },
        data: updateData
      })
    } else {
      // Create new assignment with matched tool and resource link ID
      assignment = await prisma.assignment.create({
        data: {
          courseId: course.id,
          title: ca.name,
          canvasAssignmentId: canvasIdStr,
          dueDate: ca.due_at ? new Date(ca.due_at) : null,
          availableFrom: ca.unlock_at ? new Date(ca.unlock_at) : null,
          acceptUntil: ca.lock_at ? new Date(ca.lock_at) : null,
          published: isPublished,
          toolId: matchedToolId ?? undefined,
          resourceLinkId: canvasResourceLinkId || undefined
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
        apiKey
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

  return {
    assignmentCount: canvasAssignments.length,
    sectionCount: canvasSections.length
  }
}

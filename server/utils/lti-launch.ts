import type { Prisma, PrismaClient } from '@prisma/client'
import { getGravatarUrl } from './gravatar'
import { parseCourseRole } from './lti'
import type { LtiSessionUser } from '@@/shared/schemas/auth.schema'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type PrismaTx = Prisma.TransactionClient

interface DeploymentArgs {
  platformId: string
  deploymentId: string
  deploymentHost: string | null
}

interface UserArgs {
  platformId: string
  ltiSub: string
  email: string | undefined
  firstName: string
  lastName: string
  platformUserId: string | null
  deploymentId: string
}

interface CourseArgs {
  deploymentId: string
  ltiContextId: string
  label: string | undefined
  title: string | undefined
  canvasCourseId: string | undefined
  workflowState: string | undefined
}

interface EnrollmentArgs {
  userId: string
  courseId: string
  courseRole: string
}

interface AssignmentArgs {
  courseId: string
  resourceLinkId: string
  canvasAssignmentId: string | undefined
  title: string | undefined
}

export interface LtiLaunchResult {
  user: LtiSessionUser
  assignmentId: string | null
  userRole: string
  sourcedId: string | null
  needsConfiguration: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-functions (each covers one logical step of the launch transaction)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Step 1: Upsert the LTI deployment record.
 */
export async function upsertDeployment(tx: PrismaTx, args: DeploymentArgs) {
  return tx.ltiDeployment.upsert({
    where: {
      platformId_deploymentId: {
        platformId: args.platformId,
        deploymentId: args.deploymentId
      }
    },
    update: { deploymentHost: args.deploymentHost },
    create: {
      platformId: args.platformId,
      deploymentId: args.deploymentId,
      deploymentHost: args.deploymentHost
    }
  })
}

/**
 * User fields we expose to the session token (aligns with LtiSessionUser schema)
 */
const sessionUserSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  globalRole: true,
  currentCourseId: true
} satisfies Prisma.UserSelect

/**
 * Step 2: Find or create the local user and LTI identity, returning the user record.
 */
export async function resolveUser(tx: PrismaTx, args: UserArgs): Promise<LtiSessionUser> {
  const existingIdentity = await tx.ltiIdentity.findUnique({
    where: {
      platformId_ltiSub: {
        platformId: args.platformId,
        ltiSub: args.ltiSub
      }
    },
    select: { user: { select: sessionUserSelect } }
  })

  if (existingIdentity) {
    return existingIdentity.user
  }

  // Try to find an existing account by email
  let user = args.email
    ? await tx.user.findUnique({ where: { email: args.email }, select: sessionUserSelect })
    : null

  if (!user) {
    // Check if this is the very first user in the system
    const userCount = await tx.user.count()
    const globalRole = userCount === 0 ? 'ADMIN' : 'USER'

    user = await tx.user.create({
      data: {
        email: args.email as string,
        firstName: args.firstName,
        lastName: args.lastName,
        globalRole,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        avatarUrl: getGravatarUrl(args.email as string)
      },
      select: sessionUserSelect
    })
  }

  await tx.ltiIdentity.create({
    data: {
      userId: user.id,
      platformId: args.platformId,
      ltiSub: args.ltiSub,
      platformUserId: args.platformUserId,
      deploymentId: args.deploymentId
    }
  })

  return user
}

/**
 * Step 3a: Upsert the course record.
 */
export async function upsertCourse(tx: PrismaTx, args: CourseArgs) {
  return tx.course.upsert({
    where: {
      deploymentId_ltiContextId: {
        deploymentId: args.deploymentId,
        ltiContextId: args.ltiContextId
      }
    },
    update: {
      label: args.label,
      title: args.title,
      canvasCourseId: args.canvasCourseId,
      workflowState: args.workflowState
    },
    create: {
      deploymentId: args.deploymentId,
      ltiContextId: args.ltiContextId,
      label: args.label,
      title: args.title,
      canvasCourseId: args.canvasCourseId,
      workflowState: args.workflowState
    }
  })
}

/**
 * Step 3b: Upsert the enrollment for the user in the course.
 */
export async function upsertEnrollment(tx: PrismaTx, args: EnrollmentArgs) {
  return tx.enrollment.upsert({
    where: { userId_courseId: { userId: args.userId, courseId: args.courseId } },
    update: { role: args.courseRole as never },
    create: { userId: args.userId, courseId: args.courseId, role: args.courseRole as never }
  })
}

/**
 * Step 4: Resolve (find or create) an assignment using a 3-step cascade.
 *
 * Cascade order:
 *   1. Find by resourceLinkId (standard LTI — most reliable)
 *   2. Find by canvasAssignmentId (synced assignment, never launched yet)
 *   3. Find by title where both IDs are null (legacy synced fallback — only
 *      runs when the incoming claim also has no canvasAssignmentId, to reduce
 *      the risk of merging two assignments that happen to share a name)
 *
 * @warning Step 3 is semantically fragile: two assignments with the same title
 * in the same course will be incorrectly merged. Remove this fallback once
 * all legacy assignments have been launched at least once (resourceLinkId set).
 *
 * Returns the internal assignment ID (string), or null if no context.
 */
export async function resolveAssignment(
  tx: PrismaTx,
  args: AssignmentArgs
): Promise<{ id: string; toolId: string | null }> {
  const { courseId, resourceLinkId, canvasAssignmentId, title } = args

  // 1. Strict check for existing mapping
  const assignment = await tx.assignment.findUnique({
    where: {
      courseId_resourceLinkId: { courseId, resourceLinkId }
    },
    select: { id: true, toolId: true }
  })

  // 2. Create shell if it's the first time this link is clicked
  if (!assignment) {
    const created = await tx.assignment.create({
      data: {
        courseId,
        resourceLinkId,
        title,
        canvasAssignmentId
      },
      select: { id: true, toolId: true }
    })
    return created
  }

  // 3. Update title/ID sync if record exists
  await tx.assignment.update({
    where: { id: assignment.id },
    data: { title, canvasAssignmentId }
  })

  return assignment
}

// ─────────────────────────────────────────────────────────────────────────────
// Main orchestrator
// ─────────────────────────────────────────────────────────────────────────────

interface LtiLaunchArgs {
  claims: Record<string, any>
  platform: { id: string }
}

/**
 * Run the full LTI launch DB transaction: deployment → user → course/enrollment
 * → assignment resolution. Returns the user and assignmentId to the handler.
 */
export async function handleLtiLaunch(
  prisma: PrismaClient,
  payload: LtiLaunchArgs
): Promise<LtiLaunchResult> {
  const { claims, platform } = payload

  return await prisma.$transaction(async (tx) => {
    const deploymentId = claims['https://purl.imsglobal.org/spec/lti/claim/deployment_id']
    const context = claims['https://purl.imsglobal.org/spec/lti/claim/context']
    const resourceLink = claims['https://purl.imsglobal.org/spec/lti/claim/resource_link']
    const customClaims = claims['https://purl.imsglobal.org/spec/lti/claim/custom'] || {}
    const platformClaims = claims['https://purl.imsglobal.org/spec/lti/claim/tool_platform'] || {}
    const roles = claims['https://purl.imsglobal.org/spec/lti/claim/roles'] || []
    const agsEndpoint = claims['https://purl.imsglobal.org/spec/lti-ags/claim/endpoint']?.lineitem

    // A. Upsert Deployment
    const deployment = await tx.ltiDeployment.upsert({
      where: { platformId_deploymentId: { platformId: platform.id, deploymentId } },
      update: { deploymentHost: platformClaims?.guid || null },
      create: {
        platformId: platform.id,
        deploymentId,
        deploymentHost: platformClaims?.guid || null
      }
    })

    // B. Upsert Course
    const course = await tx.course.upsert({
      where: {
        deploymentId_ltiContextId: { deploymentId: deployment.id, ltiContextId: context.id }
      },
      update: {
        label: context.label,
        title: context.title,
        canvasCourseId: customClaims.canvas_course_id?.toString()
      },
      create: {
        deploymentId: deployment.id,
        ltiContextId: context.id,
        label: context.label,
        title: context.title,
        canvasCourseId: customClaims.canvas_course_id?.toString()
      }
    })

    // C. Find or Create User
    let user = await tx.user.findFirst({
      where: { ltiIdentities: { some: { platformId: platform.id, ltiSub: claims.sub } } }
    })

    if (!user && claims.email) {
      user = await tx.user.upsert({
        where: { email: claims.email },
        update: { currentCourseId: course.id },
        create: {
          email: claims.email,
          firstName: claims.given_name || claims.name?.split(' ')[0] || 'LTI',
          lastName: claims.family_name || 'User',
          avatarUrl: getGravatarUrl(claims.email),
          currentCourseId: course.id
        }
      })
    }

    if (!user) throw new Error('Could not find or create user context')

    // Ensure LtiIdentity is created/linked
    const platformUserId = customClaims.canvas_user_id?.toString() || null
    await tx.ltiIdentity.upsert({
      where: {
        platformId_ltiSub: {
          platformId: platform.id,
          ltiSub: claims.sub
        }
      },
      update: {
        userId: user.id,
        platformUserId,
        deploymentId
      },
      create: {
        userId: user.id,
        platformId: platform.id,
        ltiSub: claims.sub,
        platformUserId,
        deploymentId
      }
    })

    // D. Identity and Enrollment
    const userRole = parseCourseRole(roles)
    await tx.enrollment.upsert({
      where: { userId_courseId: { userId: user.id, courseId: course.id } },
      update: { role: userRole as any },
      create: { userId: user.id, courseId: course.id, role: userRole as any }
    })

    user = await tx.user.update({
      where: { id: user.id },
      data: { currentCourseId: course.id }
    })

    // E. Differentiate Assignment Placement vs. Course Navigation Placement
    const rawAssignmentId = customClaims.canvas_assignment_id?.toString()
    const hasAssignmentContext = Boolean(
      rawAssignmentId &&
        !rawAssignmentId.startsWith('$') &&
        rawAssignmentId !== '$Canvas.assignment.id'
    )

    if (!hasAssignmentContext) {
      return {
        user,
        assignmentId: null,
        userRole,
        sourcedId: null,
        needsConfiguration: false
      }
    }

    // F. Strict Assignment Lookup (Standard LTI 1:1)
    let assignment = await tx.assignment.findUnique({
      where: { courseId_resourceLinkId: { courseId: course.id, resourceLinkId: resourceLink.id } },
      include: { tool: true }
    })

    if (!assignment) {
      assignment = await tx.assignment.create({
        data: {
          courseId: course.id,
          resourceLinkId: resourceLink.id,
          title: resourceLink.title,
          canvasAssignmentId: rawAssignmentId || agsEndpoint?.split('/').filter(Boolean).pop()
        },
        include: { tool: true }
      })
    }

    const ltiResult = await tx.ltiResult.upsert({
      where: {
        platformId_ltiSub_assignmentId: {
          platformId: platform.id,
          ltiSub: claims.sub,
          assignmentId: assignment.id
        }
      },
      update: { lisOutcomeServiceUrl: agsEndpoint, deploymentId },
      create: {
        platformId: platform.id,
        ltiSub: claims.sub,
        userId: user.id,
        assignmentId: assignment.id,
        deploymentId,
        lisOutcomeServiceUrl: agsEndpoint
      }
    })

    const needsConfiguration = !assignment.toolId

    return {
      user,
      assignmentId: assignment.id,
      userRole,
      sourcedId: ltiResult.id,
      needsConfiguration
    }
  })
}

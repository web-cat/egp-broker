import type { Prisma, PrismaClient } from '@prisma/client'
import { getGravatarUrl } from './gravatar'
import type { LtiSessionUser } from '../../shared/schemas/auth.schema'

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
): Promise<string | null> {
  const { courseId, resourceLinkId, canvasAssignmentId, title } = args

  // 1. Standard LTI lookup
  let assignment = await tx.assignment.findUnique({
    where: {
      courseId_resourceLinkId: { courseId, resourceLinkId }
    }
  })

  // 2. Canvas assignment ID lookup (synced but never launched)
  if (!assignment && canvasAssignmentId) {
    assignment = await tx.assignment.findFirst({
      where: { courseId, canvasAssignmentId }
    })
  }

  // 3. Title-only fallback — only when the incoming claim has no canvasAssignmentId
  //    (if the LMS sent a canvasAssignmentId we already know it didn't match, so
  //    a title match would be a different assignment — skip to avoid bad merge)
  if (!assignment && title && !canvasAssignmentId) {
    assignment = await tx.assignment.findFirst({
      where: { courseId, title, resourceLinkId: null, canvasAssignmentId: null }
    })
  }

  if (assignment) {
    await tx.assignment.update({
      where: { id: assignment.id },
      data: { resourceLinkId, canvasAssignmentId, title }
    })
    return assignment.id
  }

  // Create new
  const created = await tx.assignment.create({
    data: { courseId, resourceLinkId, title, canvasAssignmentId },
    select: { id: true }
  })
  return created.id
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
  args: LtiLaunchArgs
): Promise<LtiLaunchResult> {
  const { claims, platform } = args

  // Extract common claims
  const rawDeploymentId = claims['https://purl.imsglobal.org/spec/lti/claim/deployment_id']
  const deploymentHost =
    claims['https://purl.imsglobal.org/spec/lti/claim/tool_platform']?.guid ?? null
  const context = claims['https://purl.imsglobal.org/spec/lti/claim/context']
  const resourceLink = claims['https://purl.imsglobal.org/spec/lti/claim/resource_link']
  const customClaims = claims['https://purl.imsglobal.org/spec/lti/claim/custom']
  const roles = claims['https://purl.imsglobal.org/spec/lti/claim/roles']
  const agsEndpoint = claims['https://purl.imsglobal.org/spec/lti-ags/claim/endpoint']?.lineitem

  return prisma.$transaction(async (tx: PrismaTx) => {
    // Step 1 — Deployment
    const deployment = await upsertDeployment(tx, {
      platformId: platform.id,
      deploymentId: rawDeploymentId,
      deploymentHost
    })

    // Step 2 — User
    const firstName = claims.given_name || claims.name?.split(' ')[0] || 'LTI'
    const lastName = claims.family_name || claims.name?.split(' ').slice(1).join(' ') || 'User'

    let user = await resolveUser(tx, {
      platformId: platform.id,
      ltiSub: claims.sub,
      email: claims.email,
      firstName,
      lastName,
      platformUserId:
        String(claims['https://canvas.instructure.com/lti/legacy_user_id'] || '') || null,
      deploymentId: rawDeploymentId
    })

    // Step 3 — Course & Enrollment
    let assignmentId: string | null = null
    let sourcedId: string | null = null
    let needsConfiguration = false
    const userRole = parseCourseRole(roles)

    if (context?.id) {
      const course = await upsertCourse(tx, {
        deploymentId: deployment.id,
        ltiContextId: context.id,
        label: context.label,
        title: context.title,
        canvasCourseId: customClaims?.canvas_course_id?.toString(),
        workflowState: customClaims?.canvas_course_workflow_state
      })

      await upsertEnrollment(tx, {
        userId: user.id,
        courseId: course.id,
        courseRole: userRole
      })

      // Step 4 — Assignment & Grade Passback (SourcedId)
      // We only treat this as an assignment launch if it targets a specific assignment
      if (resourceLink?.id && customClaims?.canvas_assignment_id) {
        // We include 'toolId' in the select to check configuration

        // Use your existing resolver logic (or use the ID from above)
        assignmentId = await resolveAssignment(tx, {
          courseId: course.id,
          resourceLinkId: resourceLink.id,
          canvasAssignmentId: customClaims?.canvas_assignment_id?.toString(),
          title: resourceLink.title
        })

        // Check if tool is linked (if assignment was found or created)
        const finalAssignment = assignmentId
          ? await tx.assignment.findUnique({
              where: { id: assignmentId },
              select: { toolId: true }
            })
          : null
        needsConfiguration = !finalAssignment?.toolId

        if (assignmentId) {
          const ltiResult = await tx.ltiResult.upsert({
            where: {
              platformId_ltiSub_assignmentId: {
                platformId: platform.id,
                ltiSub: claims.sub,
                assignmentId: assignmentId
              }
            },
            update: { lisOutcomeServiceUrl: agsEndpoint, deploymentId: rawDeploymentId },
            create: {
              platformId: platform.id,
              ltiSub: claims.sub,
              userId: user.id,
              assignmentId: assignmentId,
              deploymentId: rawDeploymentId,
              lisOutcomeServiceUrl: agsEndpoint
            }
          })
          sourcedId = ltiResult.id
        }
      }

      // Step 5 — Update user context
      user = await tx.user.update({
        where: { id: user.id },
        data: { currentCourseId: course.id },
        select: sessionUserSelect
      })
    }

    return { user, assignmentId, userRole, sourcedId, needsConfiguration }
  })
}

import { defineEventHandler, readValidatedBody, createError } from 'h3'
import type { H3Event } from 'h3'
import prisma from '@@/server/utils/db'
import type { CourseRole } from '@prisma/client'
import { MockLaunchSchema } from '@@/shared/schemas/dev.schema'

export default defineEventHandler(async (event: H3Event) => {
  // Only allow in development mode
  if (!import.meta.dev) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden in production'
    })
  }

  const body = await readValidatedBody(event, MockLaunchSchema.parse)
  const {
    email = 'admin@example.com',
    courseId = 'course-101',
    courseTitle = 'Introduction to Computer Science',
    courseLabel = 'CS 101',
    role = 'TEACHER'
  } = body

  // 1. Find the user
  const user = await prisma.user.findUnique({
    where: { email }
  })

  if (!user) {
    throw createError({
      statusCode: 404,
      statusMessage: `User ${email} not found. Please run seed script first.`
    })
  }

  // 2. Find or create the course
  // We need a deployment ID for context. Let's find the first one from our seed.
  const deployment = await prisma.ltiDeployment.findFirst()
  if (!deployment) {
    throw createError({
      statusCode: 500,
      statusMessage: 'No LTI deployment found. Please run seed script first.'
    })
  }

  const course = await prisma.course.upsert({
    where: {
      deploymentId_ltiContextId: {
        deploymentId: deployment.id,
        ltiContextId: courseId
      }
    },
    update: {
      title: courseTitle,
      label: courseLabel
    },
    create: {
      deploymentId: deployment.id,
      ltiContextId: courseId,
      title: courseTitle,
      label: courseLabel,
      workflowState: 'active'
    }
  })

  // 3. Upsert Enrollment
  await prisma.enrollment.upsert({
    where: {
      userId_courseId: {
        userId: user.id,
        courseId: course.id
      }
    },
    update: { role: role as CourseRole },
    create: {
      userId: user.id,
      courseId: course.id,
      role: role as CourseRole
    }
  })

  // 4. Set Session
  await setUserSession(event, {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      globalRole: user.globalRole
    }
  })

  return {
    status: 'success',
    message: `Mock LTI launch successful for ${email} in ${courseTitle}`,
    user: {
      email: user.email,
      role
    },
    course: {
      id: course.id,
      title: course.title
    }
  }
})

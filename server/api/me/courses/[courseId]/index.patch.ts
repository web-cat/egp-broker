import { defineEventHandler, getRouterParam, readValidatedBody, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { assertCourseMember } from '@@/server/utils/gta-interview'
import { updateCourseSettingsSchema } from '@@/shared/schemas/course.schema'
import type { ApiResponse } from '@@/shared/types/api'

export default defineEventHandler(async (event): Promise<ApiResponse<any>> => {
  const courseId = getRouterParam(event, 'courseId')
  if (!courseId) {
    throw createError({ statusCode: 400, statusMessage: 'Course ID is required' })
  }

  const auth = await assertCourseMember(event, courseId)
  if (!auth.isInstructor) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden: Only instructors can update course settings'
    })
  }

  const { interviewLocation } = await readValidatedBody(event, updateCourseSettingsSchema.parse)

  const updatedCourse = await prisma.course.update({
    where: { id: courseId },
    data: {
      interviewLocation:
        interviewLocation !== undefined
          ? interviewLocation === null || interviewLocation === ''
            ? null
            : interviewLocation
          : undefined
    },
    select: {
      id: true,
      title: true,
      label: true,
      interviewLocation: true
    }
  })

  return {
    statusCode: 200,
    data: updatedCourse
  }
})

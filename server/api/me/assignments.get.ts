import { defineEventHandler } from 'h3'
import type { ApiResponse } from '@@/shared/types/api'
import type { AssignmentRow } from '@@/shared/models/assignment'
import { getCourseAssignments } from '@@/server/utils/assignments'
import { requireCourseContext } from '@@/server/utils/session'

export default defineEventHandler(async (event): Promise<ApiResponse<AssignmentRow[]>> => {
  const courseId = await requireCourseContext(event)
  const assignments = await getCourseAssignments(courseId)

  return {
    statusCode: 200,
    data: assignments
  }
})

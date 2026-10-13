import type { ApiResponse } from '@@/shared/types/api'
import type { CourseRow } from '@@/shared/models/course'

export function useAdminCourses() {
  const createCourse = async (body: unknown): Promise<ApiResponse<CourseRow>> => {
    return $fetch<ApiResponse<CourseRow>>('/api/admin/courses', {
      method: 'POST',
      body
    })
  }

  const updateCourse = async (id: string, body: unknown): Promise<ApiResponse<CourseRow>> => {
    return $fetch<ApiResponse<CourseRow>>(`/api/admin/courses/${id}`, {
      method: 'PATCH',
      body
    })
  }

  const deleteCourse = async (id: string): Promise<ApiResponse<void>> => {
    return $fetch<ApiResponse<void>>(`/api/admin/courses/${id}`, {
      method: 'DELETE'
    })
  }

  return {
    createCourse,
    updateCourse,
    deleteCourse
  }
}

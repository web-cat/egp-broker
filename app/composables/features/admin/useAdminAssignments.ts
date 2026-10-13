import type { ApiResponse } from '@@/shared/types/api'
import type { AssignmentRow } from '@@/shared/models/assignment'

export function useAdminAssignments() {
  const createAssignment = async (body: unknown): Promise<ApiResponse<AssignmentRow>> => {
    return $fetch<ApiResponse<AssignmentRow>>('/api/me/assignments', {
      method: 'POST',
      body
    })
  }

  const updateAssignment = async (
    id: string,
    body: unknown
  ): Promise<ApiResponse<AssignmentRow>> => {
    return $fetch<ApiResponse<AssignmentRow>>(`/api/me/assignments/${id}`, {
      method: 'PATCH',
      body
    })
  }

  const deleteAssignment = async (id: string): Promise<ApiResponse<void>> => {
    return $fetch<ApiResponse<void>>(`/api/admin/assignments/${id}`, {
      method: 'DELETE'
    })
  }

  return {
    createAssignment,
    updateAssignment,
    deleteAssignment
  }
}

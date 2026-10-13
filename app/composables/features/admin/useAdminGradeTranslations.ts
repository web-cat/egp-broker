import type { ApiResponse } from '@@/shared/types/api'

export function useAdminGradeTranslations() {
  const createGradeTranslation = async (body: unknown): Promise<ApiResponse<any>> => {
    return $fetch<ApiResponse<any>>('/api/admin/grade-translations', {
      method: 'POST',
      body
    })
  }

  const updateGradeTranslation = async (id: string, body: unknown): Promise<ApiResponse<any>> => {
    return $fetch<ApiResponse<any>>(`/api/admin/grade-translations/${id}`, {
      method: 'PATCH',
      body
    })
  }

  const deleteGradeTranslation = async (id: string): Promise<ApiResponse<void>> => {
    return $fetch<ApiResponse<void>>(`/api/admin/grade-translations/${id}`, {
      method: 'DELETE'
    })
  }

  return {
    createGradeTranslation,
    updateGradeTranslation,
    deleteGradeTranslation
  }
}

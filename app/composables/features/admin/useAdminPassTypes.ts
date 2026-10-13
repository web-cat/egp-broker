import type { ApiResponse } from '@@/shared/types/api'
import type { PassTypeData } from '@@/shared/models/pass'

export function useAdminPassTypes() {
  const createPassType = async (body: unknown): Promise<ApiResponse<PassTypeData>> => {
    return $fetch<ApiResponse<PassTypeData>>('/api/me/pass-types', {
      method: 'POST',
      body
    })
  }

  const updatePassType = async (id: string, body: unknown): Promise<ApiResponse<PassTypeData>> => {
    return $fetch<ApiResponse<PassTypeData>>(`/api/me/pass-types/${id}`, {
      method: 'PATCH',
      body
    })
  }

  const deletePassType = async (id: string): Promise<ApiResponse<void>> => {
    return $fetch<ApiResponse<void>>(`/api/me/pass-types/${id}`, {
      method: 'DELETE'
    })
  }

  return {
    createPassType,
    updatePassType,
    deletePassType
  }
}

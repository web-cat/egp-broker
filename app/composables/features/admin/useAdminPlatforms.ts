import type { PlatformRow } from '@@/shared/models/platform'
import type { ApiResponse } from '@@/shared/types/api'

export const useAdminPlatforms = () => {
  const fetchPlatforms = () => {
    return useFetch<ApiResponse<PlatformRow[]>>('/api/admin/platforms', {
      lazy: true
    })
  }

  const createPlatform = async (body: unknown): Promise<ApiResponse<PlatformRow>> => {
    return $fetch<ApiResponse<PlatformRow>>('/api/admin/platforms', {
      method: 'POST',
      body
    })
  }

  const updatePlatform = async (id: string, body: unknown): Promise<ApiResponse<PlatformRow>> => {
    return $fetch<ApiResponse<PlatformRow>>(`/api/admin/platforms/${id}`, {
      method: 'PATCH',
      body
    })
  }

  const deletePlatform = async (id: string): Promise<ApiResponse<void>> => {
    return $fetch<ApiResponse<void>>(`/api/admin/platforms/${id}`, {
      method: 'DELETE'
    })
  }

  return {
    fetchPlatforms,
    createPlatform,
    updatePlatform,
    deletePlatform
  }
}

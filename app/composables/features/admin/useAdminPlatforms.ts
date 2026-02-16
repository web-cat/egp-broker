import type { PlatformRow } from '@@/shared/models/platform'
import type { ApiResponse } from '@@/shared/types/api'

export const useAdminPlatforms = () => {
  const fetchPlatforms = () => {
    return useFetch<ApiResponse<PlatformRow[]>>('/api/admin/platforms', {
      lazy: true
    })
  }

  return {
    fetchPlatforms
  }
}

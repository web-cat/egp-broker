import type {
  CasServerAdminRow,
  CreateCasServerInput,
  UpdateCasServerInput
} from '@@/shared/schemas/cas.schema'
import type { ApiResponse } from '@@/shared/types/api'

export const useAdminCasServers = () => {
  const fetchCasServers = () => {
    return useFetch<ApiResponse<CasServerAdminRow[]>>('/api/admin/cas-servers')
  }

  const createCasServer = async (data: CreateCasServerInput) => {
    return $fetch<ApiResponse<CasServerAdminRow>>('/api/admin/cas-servers', {
      method: 'POST',
      body: data
    })
  }

  const updateCasServer = async (id: string, data: UpdateCasServerInput) => {
    return $fetch<ApiResponse<CasServerAdminRow>>(`/api/admin/cas-servers/${id}`, {
      method: 'PUT',
      body: data
    })
  }

  const deleteCasServer = async (id: string) => {
    return $fetch<ApiResponse<null>>(`/api/admin/cas-servers/${id}`, {
      method: 'DELETE'
    })
  }

  return {
    fetchCasServers,
    createCasServer,
    updateCasServer,
    deleteCasServer
  }
}

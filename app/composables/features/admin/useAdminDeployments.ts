import type { ApiResponse } from '@@/shared/types/api'
import type { DeploymentRow } from '@@/shared/models/deployment'

export function useAdminDeployments() {
  const createDeployment = async (body: unknown): Promise<ApiResponse<DeploymentRow>> => {
    return $fetch<ApiResponse<DeploymentRow>>('/api/admin/deployments', {
      method: 'POST',
      body
    })
  }

  const updateDeployment = async (
    id: string,
    body: unknown
  ): Promise<ApiResponse<DeploymentRow>> => {
    return $fetch<ApiResponse<DeploymentRow>>(`/api/admin/deployments/${id}`, {
      method: 'PATCH',
      body
    })
  }

  const deleteDeployment = async (id: string): Promise<ApiResponse<void>> => {
    return $fetch<ApiResponse<void>>(`/api/admin/deployments/${id}`, {
      method: 'DELETE'
    })
  }

  return {
    createDeployment,
    updateDeployment,
    deleteDeployment
  }
}

import type { ToolRow } from '@@/shared/models/tool'
import type { ApiResponse } from '@@/shared/types/api'

export const useAdminTools = () => {
  const fetchTools = (platformId?: MaybeRefOrGetter<string | undefined>) => {
    return useFetch<ApiResponse<ToolRow[]>>('/api/admin/tools', {
      lazy: true,
      query: platformId ? { p: platformId } : {}
    })
  }

  const saveTool = async (state: any, id?: string) => {
    const method = id ? 'PATCH' : 'POST'
    const url = id ? `/api/admin/tools/${id}` : '/api/admin/tools'

    return await $fetch<ApiResponse<ToolRow>>(url, {
      method,
      body: state
    })
  }

  const deleteTool = async (id: string) => {
    return await $fetch(`/api/admin/tools/${id}`, {
      method: 'DELETE'
    })
  }

  return {
    fetchTools,
    saveTool,
    deleteTool
  }
}

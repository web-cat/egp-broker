import type { ApiResponse } from '@@/shared/types/api'
import type { RosterSyncStatusData } from '@@/shared/models/course'

export function useRosterSync() {
  const fetchRosterSyncStatus = async (): Promise<ApiResponse<RosterSyncStatusData>> => {
    return $fetch<ApiResponse<RosterSyncStatusData>>('/api/me/course/roster-sync-status')
  }

  const useRosterSyncStatus = () => {
    return useFetch<ApiResponse<RosterSyncStatusData>>('/api/me/course/roster-sync-status', {
      lazy: true,
      server: false
    })
  }

  return {
    fetchRosterSyncStatus,
    useRosterSyncStatus
  }
}

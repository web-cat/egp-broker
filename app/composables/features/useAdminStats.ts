import type { ApiResponse } from '@@/shared/types/api'
import type { AdminStats } from '@@/shared/models/stats'

export function useAdminStats() {
  const { data, error, status, refresh } = useFetch<ApiResponse<AdminStats>>('/api/admin/stats')

  const stats = computed(() => data.value?.data)

  const simpleCards = computed(() => {
    const s = stats.value
    return [
      { label: 'CAS Servers', value: s?.casServers ?? '—', to: '/admin/cas-servers' },
      { label: 'LTI Tools', value: s?.tools ?? '—', to: '/admin/tools' },
      { label: 'Courses', value: s?.courses ?? '—', to: '/admin/courses' },
      { label: 'Users', value: s?.users ?? '—', to: '/admin/users' },
      {
        label: 'Grade Translations',
        value: s?.translations ?? '—',
        to: '/admin/grade-translations'
      }
    ]
  })

  return {
    data,
    error,
    status,
    stats,
    simpleCards,
    refresh
  }
}

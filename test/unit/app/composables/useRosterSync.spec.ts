import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useRosterSync } from '../../../../app/composables/features/useRosterSync'

const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)
vi.stubGlobal('ref', ref)

const mockUseFetch = vi.fn()
vi.stubGlobal('useFetch', mockUseFetch)

describe('useRosterSync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetchRosterSyncStatus calls /api/me/course/roster-sync-status', async () => {
    mockFetch.mockResolvedValueOnce({ data: { isSyncing: false, totalStudents: 10 } })
    const { fetchRosterSyncStatus } = useRosterSync()

    const res = await fetchRosterSyncStatus()
    expect(mockFetch).toHaveBeenCalledWith('/api/me/course/roster-sync-status')
    expect(res.data.totalStudents).toBe(10)
  })

  it('useRosterSyncStatus delegates to useFetch with lazy and server false', () => {
    mockUseFetch.mockReturnValueOnce({ data: ref(null) })
    const { useRosterSyncStatus } = useRosterSync()

    useRosterSyncStatus()
    expect(mockUseFetch).toHaveBeenCalledWith('/api/me/course/roster-sync-status', {
      lazy: true,
      server: false
    })
  })
})

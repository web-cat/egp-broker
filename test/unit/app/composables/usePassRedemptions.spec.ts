import { describe, it, expect, vi, beforeEach } from 'vitest'
import { usePassRedemptions } from '../../../../app/composables/features/usePassRedemptions'

const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

describe('usePassRedemptions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('syncPassport posts to /api/me/assignments/:id/passport-sync', async () => {
    mockFetch.mockResolvedValueOnce({ data: { syncedCount: 3, failedCount: 0, totalCount: 3 } })
    const { syncPassport } = usePassRedemptions()

    const res = await syncPassport('assign-1')
    expect(mockFetch).toHaveBeenCalledWith('/api/me/assignments/assign-1/passport-sync', {
      method: 'POST'
    })
    expect(res.data.syncedCount).toBe(3)
  })

  it('fetchAssignmentRedemptions gets /api/me/assignments/:id/redemptions', async () => {
    mockFetch.mockResolvedValueOnce({ data: [] })
    const { fetchAssignmentRedemptions } = usePassRedemptions()

    await fetchAssignmentRedemptions('assign-1')
    expect(mockFetch).toHaveBeenCalledWith('/api/me/assignments/assign-1/redemptions')
  })

  it('fetchAssignmentOverrides gets /api/me/assignments/:id/overrides', async () => {
    mockFetch.mockResolvedValueOnce({ data: [] })
    const { fetchAssignmentOverrides } = usePassRedemptions()

    await fetchAssignmentOverrides('assign-1')
    expect(mockFetch).toHaveBeenCalledWith('/api/me/assignments/assign-1/overrides')
  })

  it('fetchAssignmentCbtfSummary gets /api/me/assignments/:id/cbtf-reservation-summary', async () => {
    mockFetch.mockResolvedValueOnce({ data: null })
    const { fetchAssignmentCbtfSummary } = usePassRedemptions()

    await fetchAssignmentCbtfSummary('assign-1')
    expect(mockFetch).toHaveBeenCalledWith('/api/me/assignments/assign-1/cbtf-reservation-summary')
  })

  it('fetchAssignments gets /api/me/assignments', async () => {
    mockFetch.mockResolvedValueOnce({ data: [] })
    const { fetchAssignments } = usePassRedemptions()

    await fetchAssignments()
    expect(mockFetch).toHaveBeenCalledWith('/api/me/assignments')
  })

  it('updateStudentPassBalances patches /api/me/students/:id/pass-pools', async () => {
    mockFetch.mockResolvedValueOnce({ data: [] })
    const { updateStudentPassBalances } = usePassRedemptions()

    await updateStudentPassBalances('student-1', [{ passTypeId: 'pt-1', balance: 5 }])
    expect(mockFetch).toHaveBeenCalledWith('/api/me/students/student-1/pass-pools', {
      method: 'PATCH',
      body: { balances: [{ passTypeId: 'pt-1', balance: 5 }] }
    })
  })

  it('fetchStudentRedemptions gets /api/me/students/:id/redemptions', async () => {
    mockFetch.mockResolvedValueOnce({ data: [] })
    const { fetchStudentRedemptions } = usePassRedemptions()

    await fetchStudentRedemptions('student-1')
    expect(mockFetch).toHaveBeenCalledWith('/api/me/students/student-1/redemptions')
  })

  it('fetchStudentInterviews supports courseId query parameter', async () => {
    mockFetch.mockResolvedValueOnce({ data: [] })
    const { fetchStudentInterviews } = usePassRedemptions()

    await fetchStudentInterviews('student-1', 'course-1')
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/me/students/student-1/interviews?courseId=course-1'
    )

    await fetchStudentInterviews('student-1', null)
    expect(mockFetch).toHaveBeenCalledWith('/api/me/students/student-1/interviews')
  })

  it('fetchStudentCbtfReservations supports courseId query parameter', async () => {
    mockFetch.mockResolvedValueOnce({ data: [] })
    const { fetchStudentCbtfReservations } = usePassRedemptions()

    await fetchStudentCbtfReservations('student-1', 'course-1')
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/me/students/student-1/cbtf-reservations?courseId=course-1'
    )

    await fetchStudentCbtfReservations('student-1', null)
    expect(mockFetch).toHaveBeenCalledWith('/api/me/students/student-1/cbtf-reservations')
  })

  it('forceRedeemStudentPass posts to /api/me/students/:id/redemptions', async () => {
    mockFetch.mockResolvedValueOnce({ data: { passBalances: [] } })
    const { forceRedeemStudentPass } = usePassRedemptions()

    await forceRedeemStudentPass('student-1', { passTypeId: 'pt-1' })
    expect(mockFetch).toHaveBeenCalledWith('/api/me/students/student-1/redemptions', {
      method: 'POST',
      body: { passTypeId: 'pt-1' }
    })
  })
})

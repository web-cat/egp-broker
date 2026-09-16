import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAdminCbtfReservations } from '../../../../app/composables/features/admin/useAdminCbtfReservations'

const mockToastAdd = vi.fn()
vi.stubGlobal('useToast', () => ({ add: mockToastAdd }))

const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

describe('useAdminCbtfReservations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('initializes with default upcoming reservation filter and pagination', () => {
    const { search, status, upcomingOnly, page, pageSize, reservations } =
      useAdminCbtfReservations()

    expect(search.value).toBe('')
    expect(status.value).toBe('ALL')
    expect(upcomingOnly.value).toBe(true)
    expect(page.value).toBe(1)
    expect(pageSize.value).toBe(50)
    expect(reservations.value).toEqual([])
  })

  it('fetches reservations and populates state and pagination', async () => {
    const composable = useAdminCbtfReservations()

    mockFetch.mockResolvedValueOnce({
      statusCode: 200,
      data: [
        {
          id: 'res-1',
          assignmentTitle: 'Quiz 1',
          studentName: 'Bob Jones',
          studentEmail: 'bob@vt.edu',
          seatNumber: 4,
          startTime: '2026-10-01T10:00:00.000Z',
          endTime: '2026-10-01T11:00:00.000Z',
          status: 'SCHEDULED'
        }
      ],
      pagination: {
        total: 1,
        page: 1,
        pageSize: 50,
        totalPages: 1
      }
    })

    await composable.fetchReservations()

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/cbtf/reservations?upcomingOnly=true&page=1&pageSize=50')
    )
    expect(composable.reservations.value.length).toBe(1)
    expect(composable.reservations.value[0].studentName).toBe('Bob Jones')
    expect(composable.pagination.value.total).toBe(1)
  })

  it('filters by search, status, and custom date range', async () => {
    const composable = useAdminCbtfReservations()
    composable.search.value = 'Smith'
    composable.status.value = 'CHECKED_IN'
    composable.startDateFrom.value = '2026-10-05T08:00'
    composable.startDateTo.value = '2026-10-06T18:00'

    mockFetch.mockResolvedValueOnce({
      statusCode: 200,
      data: [],
      pagination: { total: 0, page: 1, pageSize: 50, totalPages: 1 }
    })

    await composable.fetchReservations()

    const calledUrl = mockFetch.mock.calls[0][0]
    expect(calledUrl).toContain('search=Smith')
    expect(calledUrl).toContain('status=CHECKED_IN')
    expect(calledUrl).toContain('from=')
    expect(calledUrl).toContain('to=')
    expect(calledUrl).toContain('upcomingOnly=false')
  })

  it('updates reservation and triggers toast notification and refresh', async () => {
    const composable = useAdminCbtfReservations()

    mockFetch
      .mockResolvedValueOnce({ statusCode: 200, data: { id: 'res-1' } }) // PATCH call
      .mockResolvedValueOnce({
        statusCode: 200,
        data: [],
        pagination: { total: 0, page: 1, pageSize: 50, totalPages: 1 }
      }) // fetchReservations call

    await composable.updateReservation('res-1', { seatNumber: 22 })

    expect(mockFetch).toHaveBeenCalledWith('/api/admin/cbtf/reservations/res-1', {
      method: 'PATCH',
      body: { seatNumber: 22 }
    })
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Reservation Updated',
        color: 'success'
      })
    )
  })

  it('deletes reservation and triggers toast notification and refresh', async () => {
    const composable = useAdminCbtfReservations()

    mockFetch
      .mockResolvedValueOnce({ statusCode: 200 }) // DELETE call
      .mockResolvedValueOnce({
        statusCode: 200,
        data: [],
        pagination: { total: 0, page: 1, pageSize: 50, totalPages: 1 }
      }) // fetchReservations call

    await composable.deleteReservation('res-1')

    expect(mockFetch).toHaveBeenCalledWith('/api/admin/cbtf/reservations/res-1', {
      method: 'DELETE'
    })
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Reservation Deleted',
        color: 'success'
      })
    )
  })

  it('resets filters back to default', async () => {
    const composable = useAdminCbtfReservations()
    composable.search.value = 'Alice'
    composable.status.value = 'CANCELLED'
    composable.upcomingOnly.value = false
    composable.page.value = 3

    mockFetch.mockResolvedValueOnce({
      statusCode: 200,
      data: [],
      pagination: { total: 0, page: 1, pageSize: 50, totalPages: 1 }
    })

    composable.resetFilters()

    expect(composable.search.value).toBe('')
    expect(composable.status.value).toBe('ALL')
    expect(composable.upcomingOnly.value).toBe(true)
    expect(composable.page.value).toBe(1)
    expect(mockFetch).toHaveBeenCalled()
  })
})

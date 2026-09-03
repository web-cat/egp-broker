import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useCbtfProctor } from '../../../../app/composables/features/proctor/useCbtfProctor'

const mockToast = {
  add: vi.fn()
}
vi.stubGlobal('useToast', () => mockToast)

const mockStatusData = ref({ data: { isOnDuty: false } })
const mockFeedData = ref({
  data: {
    facility: {
      id: 'fac-1',
      name: 'Main CBTF',
      totalSeats: 48,
      occupiedSeats: 1,
      availableSeats: 47
    },
    counts: { seated: 1, arriving: 1, departures: 0 },
    seated: [{ id: 'res-1', seatNumber: 10, studentName: 'Alice' }],
    arriving: [{ id: 'res-2', seatNumber: 12, studentName: 'Bob' }],
    departures: []
  }
})

const mockRefreshStatus = vi.fn()
const mockRefreshFeed = vi.fn()

vi.stubGlobal('useFetch', (url: string) => {
  if (url === '/api/proctor/status') {
    return { data: mockStatusData, status: ref('idle'), refresh: mockRefreshStatus }
  }
  return { data: mockFeedData, status: ref('idle'), refresh: mockRefreshFeed }
})

const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

describe('useCbtfProctor Composable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStatusData.value = { data: { isOnDuty: false } }
  })

  it('computes feed rosters and counts', () => {
    const { seated, arriving, counts, facility, isOnDuty } = useCbtfProctor()

    expect(isOnDuty.value).toBe(false)
    expect(facility.value?.name).toBe('Main CBTF')
    expect(counts.value.seated).toBe(1)
    expect(seated.value.length).toBe(1)
    expect(arriving.value.length).toBe(1)
  })

  it('toggles duty status', async () => {
    mockFetch.mockResolvedValueOnce({ statusCode: 200, data: { isOnDuty: true } })
    const { toggleDuty } = useCbtfProctor()

    await toggleDuty(true)

    expect(mockFetch).toHaveBeenCalledWith('/api/proctor/status', {
      method: 'PATCH',
      body: { isOnDuty: true }
    })
    expect(mockRefreshStatus).toHaveBeenCalled()
    expect(mockToast.add).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Checked On Duty', color: 'success' })
    )
  })

  it('looks up student with card swipe parsing', async () => {
    const mockLookup = {
      found: true,
      student: { firstName: 'Alice', lastName: 'A', studentId: '906000001' },
      reservation: { seatNumber: 10 },
      decision: 'READY_FOR_CHECKIN'
    }
    mockFetch.mockResolvedValueOnce({ data: mockLookup })

    const { lookupStudent, lookupResult } = useCbtfProctor()

    // Pass a raw track 2 card swipe
    const result = await lookupStudent(';906000001=2812?')

    expect(mockFetch).toHaveBeenCalledWith('/api/proctor/lookup', {
      params: { studentId: '906000001' }
    })
    expect(result).toEqual(mockLookup)
    expect(lookupResult.value).toEqual(mockLookup)
  })

  it('confirms check-in and updates lastAction and feed', async () => {
    mockFetch.mockResolvedValueOnce({
      data: { id: 'res-1', studentName: 'Alice', seatNumber: 10, status: 'CHECKED_IN' }
    })

    const { confirmCheckIn, lastAction, lookupResult } = useCbtfProctor()
    lookupResult.value = { reservation: { id: 'res-1' } }

    const result = await confirmCheckIn('res-1')

    expect(mockFetch).toHaveBeenCalledWith('/api/proctor/check-in', {
      method: 'POST',
      body: { reservationId: 'res-1' }
    })
    expect(result.status).toBe('CHECKED_IN')
    expect(lastAction.value?.type).toBe('checkin')
    expect(lastAction.value?.message).toContain('RETAIN student ID')
    expect(lookupResult.value).toBeNull()
    expect(mockRefreshFeed).toHaveBeenCalled()
  })

  it('confirms check-out and updates lastAction and feed', async () => {
    mockFetch.mockResolvedValueOnce({
      data: { id: 'res-1', studentName: 'Alice', seatNumber: 10, status: 'CHECKED_OUT' }
    })

    const { confirmCheckOut, lastAction, lookupResult } = useCbtfProctor()
    lookupResult.value = { reservation: { id: 'res-1' } }

    const result = await confirmCheckOut('res-1')

    expect(mockFetch).toHaveBeenCalledWith('/api/proctor/check-out', {
      method: 'POST',
      body: { reservationId: 'res-1' }
    })
    expect(result.status).toBe('CHECKED_OUT')
    expect(lastAction.value?.type).toBe('checkout')
    expect(lastAction.value?.message).toContain('RETURN student ID')
    expect(lookupResult.value).toBeNull()
    expect(mockRefreshFeed).toHaveBeenCalled()
  })
})

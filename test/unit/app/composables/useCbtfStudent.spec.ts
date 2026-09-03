import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useCbtfStudent } from '../../../../app/composables/features/useCbtfStudent'

const mockToast = {
  add: vi.fn()
}
vi.stubGlobal('useToast', () => mockToast)

const mockReservationsData = ref({
  data: [
    {
      id: 'res-1',
      facilityId: 'fac-1',
      assignmentId: 'asg-1',
      assignmentTitle: 'Midterm 1',
      userId: 'usr-1',
      seatNumber: 12,
      startTime: '2026-10-05T09:00:00.000Z',
      endTime: '2026-10-05T10:00:00.000Z',
      status: 'SCHEDULED'
    },
    {
      id: 'res-2',
      facilityId: 'fac-1',
      assignmentId: 'asg-2',
      assignmentTitle: 'Quiz 2',
      userId: 'usr-1',
      seatNumber: 4,
      startTime: '2026-09-01T09:00:00.000Z',
      endTime: '2026-09-01T10:00:00.000Z',
      status: 'CHECKED_OUT'
    }
  ]
})

const mockRefresh = vi.fn()
vi.stubGlobal('useFetch', () => ({
  data: mockReservationsData,
  status: ref('idle'),
  refresh: mockRefresh
}))

const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

describe('useCbtfStudent Composable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('computes active reservations and finds reservation for assignment', () => {
    const { activeReservations, getReservationForAssignment } = useCbtfStudent()

    expect(activeReservations.value.length).toBe(1)
    expect(activeReservations.value[0].id).toBe('res-1')

    const res1 = getReservationForAssignment('asg-1')
    expect(res1?.seatNumber).toBe(12)

    const resNone = getReservationForAssignment('nonexistent')
    expect(resNone).toBeUndefined()
  })

  it('fetches availability with preferences and selected date', async () => {
    const mockAvailability = {
      assignmentTitle: 'Midterm 1',
      studentWindow: { start: '2026-10-01', end: '2026-10-15', isPassWindow: false },
      activeReservation: null,
      recommendedDays: [],
      hourlySlots: []
    }
    mockFetch.mockResolvedValueOnce({ data: mockAvailability })

    const { fetchAvailability } = useCbtfStudent()
    const result = await fetchAvailability('asg-1', 'morning', '2026-10-05')

    expect(mockFetch).toHaveBeenCalledWith('/api/me/cbtf/availability', {
      params: {
        assignmentId: 'asg-1',
        timeOfDayPreference: 'morning',
        selectedDate: '2026-10-05'
      }
    })
    expect(result).toEqual(mockAvailability)
  })

  it('creates reservation and refreshes list', async () => {
    const newRes = {
      id: 'res-3',
      facilityId: 'fac-1',
      assignmentId: 'asg-3',
      seatNumber: 15,
      startTime: '2026-10-06T10:00:00.000Z',
      endTime: '2026-10-06T11:00:00.000Z',
      status: 'SCHEDULED'
    }
    mockFetch.mockResolvedValueOnce({ data: newRes })

    const { createReservation } = useCbtfStudent()
    const result = await createReservation('asg-3', '2026-10-06T10:00:00.000Z')

    expect(mockFetch).toHaveBeenCalledWith('/api/me/cbtf/reservations', {
      method: 'POST',
      body: { assignmentId: 'asg-3', startTime: '2026-10-06T10:00:00.000Z' }
    })
    expect(mockToast.add).toHaveBeenCalledWith(expect.objectContaining({ color: 'success' }))
    expect(mockRefresh).toHaveBeenCalled()
    expect(result).toEqual(newRes)
  })

  it('reschedules reservation and refreshes list', async () => {
    const updated = {
      id: 'res-1',
      seatNumber: 20,
      startTime: '2026-10-07T14:00:00.000Z',
      status: 'SCHEDULED'
    }
    mockFetch.mockResolvedValueOnce({ data: updated })

    const { rescheduleReservation } = useCbtfStudent()
    const result = await rescheduleReservation('res-1', '2026-10-07T14:00:00.000Z')

    expect(mockFetch).toHaveBeenCalledWith('/api/me/cbtf/reservations/res-1', {
      method: 'PATCH',
      body: { startTime: '2026-10-07T14:00:00.000Z' }
    })
    expect(mockToast.add).toHaveBeenCalledWith(expect.objectContaining({ color: 'success' }))
    expect(mockRefresh).toHaveBeenCalled()
    expect(result).toEqual(updated)
  })

  it('cancels reservation and refreshes list', async () => {
    mockFetch.mockResolvedValueOnce({ data: { id: 'res-1', status: 'CANCELLED' } })

    const { cancelReservation } = useCbtfStudent()
    await cancelReservation('res-1')

    expect(mockFetch).toHaveBeenCalledWith('/api/me/cbtf/reservations/res-1', {
      method: 'DELETE'
    })
    expect(mockToast.add).toHaveBeenCalledWith(expect.objectContaining({ color: 'info' }))
    expect(mockRefresh).toHaveBeenCalled()
  })
})

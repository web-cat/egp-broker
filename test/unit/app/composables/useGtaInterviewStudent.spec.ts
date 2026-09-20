import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useGtaInterviewStudent } from '../../../../app/composables/features/useGtaInterviewStudent'

const mockToast = {
  add: vi.fn()
}
vi.stubGlobal('useToast', () => mockToast)

const mockSlotsData = ref<any>({
  data: {
    blocks: [
      {
        id: '2026-10-05-morning',
        date: '2026-10-05',
        period: 'morning',
        label: 'Monday, Oct 5 (Morning)',
        openSlotsCount: 2,
        totalCapacity: 4,
        slots: [
          {
            startTime: '2026-10-05T09:00:00.000Z',
            endTime: '2026-10-05T09:10:00.000Z',
            timeLabel: '9:00 AM',
            availableCapacity: 1,
            totalGtasOnDuty: 1
          }
        ]
      }
    ]
  }
})

const mockReservationData = ref<any>({
  data: {
    id: 'res-1',
    assignmentId: 'assign-1',
    studentId: 'student-1',
    status: 'SCHEDULED',
    startTime: '2026-10-05T09:00:00.000Z',
    endTime: '2026-10-05T09:10:00.000Z',
    gta: {
      id: 'gta-1',
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'asmith@vt.edu'
    }
  }
})

const mockRefreshSlots = vi.fn()
const mockRefreshReservation = vi.fn()

vi.stubGlobal('useFetch', (url: any) => {
  const urlStr = typeof url === 'function' ? url() : (url?.value ?? url)
  if (typeof urlStr === 'string' && urlStr.includes('interview-slots')) {
    return {
      data: mockSlotsData,
      status: ref('idle'),
      refresh: mockRefreshSlots
    }
  }
  return {
    data: mockReservationData,
    status: ref('idle'),
    refresh: mockRefreshReservation
  }
})

const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

describe('useGtaInterviewStudent Composable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exposes slotsData and myReservation reactively', () => {
    const courseId = ref('course-1')
    const assignmentId = ref('assign-1')

    const { slotsData, myReservation } = useGtaInterviewStudent(courseId, assignmentId)

    expect(slotsData.value).toBeDefined()
    expect(slotsData.value?.blocks).toHaveLength(1)
    expect(myReservation.value).toBeDefined()
    expect(myReservation.value?.id).toBe('res-1')
    expect(myReservation.value?.gta?.firstName).toBe('Alice')
  })

  it('books slot successfully and triggers refreshes', async () => {
    const courseId = ref('course-1')
    const assignmentId = ref('assign-1')

    const mockBookingResponse = {
      statusCode: 200,
      data: {
        id: 'res-new',
        status: 'SCHEDULED',
        startTime: '2026-10-05T09:00:00.000Z',
        endTime: '2026-10-05T09:10:00.000Z',
        gta: { firstName: 'Alice', lastName: 'Smith' }
      }
    }
    mockFetch.mockResolvedValueOnce(mockBookingResponse)

    const { bookSlot, isBooking } = useGtaInterviewStudent(courseId, assignmentId)

    const promise = bookSlot('2026-10-05T09:00:00.000Z')
    expect(isBooking.value).toBe(true)

    const result = await promise
    expect(isBooking.value).toBe(false)
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/me/courses/course-1/assignments/assign-1/interview-reservations',
      {
        method: 'POST',
        body: { startTime: '2026-10-05T09:00:00.000Z' }
      }
    )
    expect(mockToast.add).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Interview Booked Successfully',
        color: 'success'
      })
    )
    expect(mockRefreshReservation).toHaveBeenCalled()
    expect(mockRefreshSlots).toHaveBeenCalled()
    expect(result.id).toBe('res-new')
  })

  it('passes rescheduleReservationId in POST body when provided', async () => {
    const courseId = ref('course-1')
    const assignmentId = ref('assign-1')

    mockFetch.mockResolvedValueOnce({
      statusCode: 200,
      data: {
        id: 'res-rescheduled',
        status: 'SCHEDULED',
        startTime: '2026-10-06T14:00:00.000Z',
        endTime: '2026-10-06T14:10:00.000Z',
        gta: { firstName: 'Alice', lastName: 'Smith' }
      }
    })

    const { bookSlot } = useGtaInterviewStudent(courseId, assignmentId)

    await bookSlot('2026-10-06T14:00:00.000Z', 'res-old-123')
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/me/courses/course-1/assignments/assign-1/interview-reservations',
      {
        method: 'POST',
        body: {
          startTime: '2026-10-06T14:00:00.000Z',
          rescheduleReservationId: 'res-old-123'
        }
      }
    )
  })

  it('handles booking failure gracefully', async () => {
    const courseId = ref('course-1')
    const assignmentId = ref('assign-1')

    mockFetch.mockRejectedValueOnce({
      data: { statusMessage: 'No available GTA for this slot' }
    })

    const { bookSlot } = useGtaInterviewStudent(courseId, assignmentId)

    await expect(bookSlot('2026-10-05T09:00:00.000Z')).rejects.toThrow()
    expect(mockToast.add).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Booking Failed',
        description: 'No available GTA for this slot',
        color: 'error'
      })
    )
  })

  it('cancels reservation successfully', async () => {
    const courseId = ref('course-1')
    const assignmentId = ref('assign-1')

    mockFetch.mockResolvedValueOnce({ statusCode: 200, data: { success: true } })

    const { cancelReservation, isCancelling } = useGtaInterviewStudent(courseId, assignmentId)

    const promise = cancelReservation('res-1')
    expect(isCancelling.value).toBe(true)

    await promise
    expect(isCancelling.value).toBe(false)
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/me/courses/course-1/assignments/assign-1/interview-reservations/res-1',
      { method: 'DELETE' }
    )
    expect(mockToast.add).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Interview Cancelled',
        color: 'info'
      })
    )
    expect(mockRefreshReservation).toHaveBeenCalled()
    expect(mockRefreshSlots).toHaveBeenCalled()
  })

  it('handles cancellation error gracefully', async () => {
    const courseId = ref('course-1')
    const assignmentId = ref('assign-1')

    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const { cancelReservation } = useGtaInterviewStudent(courseId, assignmentId)

    await expect(cancelReservation('res-1')).rejects.toThrow('Network error')
    expect(mockToast.add).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Cancellation Failed',
        color: 'error'
      })
    )
  })
})

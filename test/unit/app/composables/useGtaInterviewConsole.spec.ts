import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useGtaInterviewConsole } from '../../../../app/composables/features/useGtaInterviewConsole'

const mockToast = {
  add: vi.fn()
}
vi.stubGlobal('useToast', () => mockToast)

const getInitialMockData = () => [
  {
    id: 'res-sched-1',
    status: 'SCHEDULED',
    startTime: '2026-10-05T10:00:00.000Z',
    endTime: '2026-10-05T10:10:00.000Z',
    student: { firstName: 'Alice', lastName: 'Student' }
  },
  {
    id: 'res-active-1',
    status: 'CHECKED_IN',
    startTime: '2026-10-05T09:50:00.000Z',
    endTime: '2026-10-05T10:00:00.000Z',
    student: { firstName: 'Charlie', lastName: 'Student' }
  },
  {
    id: 'res-done-1',
    status: 'COMPLETED',
    startTime: '2026-10-05T09:40:00.000Z',
    endTime: '2026-10-05T09:50:00.000Z',
    student: { firstName: 'Diana', lastName: 'Student' }
  },
  {
    id: 'res-missed-1',
    status: 'MISSED',
    startTime: '2026-10-05T09:30:00.000Z',
    endTime: '2026-10-05T09:40:00.000Z',
    student: { firstName: 'Evan', lastName: 'Student' }
  },
  {
    id: 'res-cancelled-1',
    status: 'CANCELLED',
    startTime: '2026-10-05T09:20:00.000Z',
    endTime: '2026-10-05T09:30:00.000Z',
    student: { firstName: 'Fiona', lastName: 'Student' }
  }
]

const mockFeedData = ref<any>({
  data: getInitialMockData()
})

const mockRefreshFeed = vi.fn()

vi.stubGlobal('useFetch', () => ({
  data: mockFeedData,
  status: ref('idle'),
  refresh: mockRefreshFeed
}))

const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

describe('useGtaInterviewConsole Composable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFeedData.value = {
      data: getInitialMockData()
    }
  })

  it('categorizes reservations into active, expected, and completed lists including cancelled and missed', () => {
    const courseId = ref('course-1')
    const { activeInterview, expectedArrivals, completedList } = useGtaInterviewConsole(courseId)

    expect(activeInterview.value).toBeDefined()
    expect(activeInterview.value?.id).toBe('res-active-1')

    expect(expectedArrivals.value).toHaveLength(1)
    expect(expectedArrivals.value[0].id).toBe('res-sched-1')

    expect(completedList.value).toHaveLength(3)
    expect(completedList.value.map((r: any) => r.id)).toEqual([
      'res-done-1',
      'res-missed-1',
      'res-cancelled-1'
    ])
  })

  it('performs checkIn and refreshes feed', async () => {
    const courseId = ref('course-1')
    mockFetch.mockResolvedValueOnce({
      statusCode: 200,
      data: { id: 'res-sched-1', status: 'CHECKED_IN', student: { firstName: 'Alice' } }
    })

    const { checkIn } = useGtaInterviewConsole(courseId)
    const result = await checkIn('res-sched-1')

    expect(mockFetch).toHaveBeenCalledWith('/api/me/courses/course-1/interviews/res-sched-1', {
      method: 'PATCH',
      body: { status: 'CHECKED_IN' }
    })
    expect(mockToast.add).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Student Checked In',
        color: 'success'
      })
    )
    expect(mockRefreshFeed).toHaveBeenCalled()
    expect(result.status).toBe('CHECKED_IN')
  })

  it('performs checkOut and updates notes', async () => {
    const courseId = ref('course-1')
    mockFetch.mockResolvedValueOnce({
      statusCode: 200,
      data: { id: 'res-active-1', status: 'COMPLETED' }
    })

    const { checkOut } = useGtaInterviewConsole(courseId)
    const result = await checkOut('res-active-1', 'Clear explanations of pointer arithmetic.')

    expect(mockFetch).toHaveBeenCalledWith('/api/me/courses/course-1/interviews/res-active-1', {
      method: 'PATCH',
      body: {
        status: 'COMPLETED',
        notes: 'Clear explanations of pointer arithmetic.'
      }
    })
    expect(mockToast.add).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Interview Completed',
        color: 'success'
      })
    )
    expect(mockRefreshFeed).toHaveBeenCalled()
    expect(result.status).toBe('COMPLETED')
  })

  it('performs saveNotes without changing status', async () => {
    const courseId = ref('course-1')
    mockFetch.mockResolvedValueOnce({
      statusCode: 200,
      data: { id: 'res-active-1', notes: 'In-progress notes...' }
    })

    const { saveNotes } = useGtaInterviewConsole(courseId)
    await saveNotes('res-active-1', 'In-progress notes...')

    expect(mockFetch).toHaveBeenCalledWith('/api/me/courses/course-1/interviews/res-active-1', {
      method: 'PATCH',
      body: { notes: 'In-progress notes...' }
    })
    expect(mockToast.add).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Notes Saved',
        color: 'info'
      })
    )
    expect(mockRefreshFeed).toHaveBeenCalled()
  })

  it('performs markNoShow and marks as MISSED', async () => {
    const courseId = ref('course-1')
    mockFetch.mockResolvedValueOnce({
      statusCode: 200,
      data: { id: 'res-sched-1', status: 'MISSED' }
    })

    const { markNoShow } = useGtaInterviewConsole(courseId)
    await markNoShow('res-sched-1')

    expect(mockFetch).toHaveBeenCalledWith('/api/me/courses/course-1/interviews/res-sched-1', {
      method: 'PATCH',
      body: { status: 'MISSED' }
    })
    expect(mockToast.add).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Marked as No-Show',
        color: 'warning'
      })
    )
    expect(mockRefreshFeed).toHaveBeenCalled()
  })

  it('performs cancelCheckIn and reverts status to SCHEDULED', async () => {
    const courseId = ref('course-1')
    mockFetch.mockResolvedValueOnce({
      statusCode: 200,
      data: { id: 'res-active-1', status: 'SCHEDULED' }
    })

    const { cancelCheckIn } = useGtaInterviewConsole(courseId)
    await cancelCheckIn('res-active-1')

    expect(mockFetch).toHaveBeenCalledWith('/api/me/courses/course-1/interviews/res-active-1', {
      method: 'PATCH',
      body: { status: 'SCHEDULED' }
    })
    expect(mockToast.add).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Check-In Cancelled',
        color: 'info'
      })
    )
    expect(mockRefreshFeed).toHaveBeenCalled()
  })

  it('performs reinstateReservation and sets status to SCHEDULED', async () => {
    const courseId = ref('course-1')
    mockFetch.mockResolvedValueOnce({
      statusCode: 200,
      data: { id: 'res-missed-1', status: 'SCHEDULED' }
    })

    const { reinstateReservation } = useGtaInterviewConsole(courseId)
    await reinstateReservation('res-missed-1')

    expect(mockFetch).toHaveBeenCalledWith('/api/me/courses/course-1/interviews/res-missed-1', {
      method: 'PATCH',
      body: { status: 'SCHEDULED' }
    })
    expect(mockToast.add).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Appointment Reopened',
        color: 'success'
      })
    )
    expect(mockRefreshFeed).toHaveBeenCalled()
  })

  it('handles error in checkIn gracefully', async () => {
    const courseId = ref('course-1')
    mockFetch.mockRejectedValueOnce({
      data: { statusMessage: 'Reservation already cancelled' }
    })

    const { checkIn } = useGtaInterviewConsole(courseId)
    await expect(checkIn('res-sched-1')).rejects.toThrow()
    expect(mockToast.add).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Check-In Failed',
        color: 'error'
      })
    )
  })

  it('performs updateInterview with notes and status and refreshes feed', async () => {
    const courseId = ref('course-1')
    mockFetch.mockResolvedValueOnce({
      statusCode: 200,
      data: { id: 'res-done-1', notes: 'Updated notes', status: 'COMPLETED' }
    })

    const { updateInterview } = useGtaInterviewConsole(courseId)
    const result = await updateInterview('res-done-1', {
      notes: 'Updated notes',
      status: 'COMPLETED'
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/me/courses/course-1/interviews/res-done-1', {
      method: 'PATCH',
      body: { notes: 'Updated notes', status: 'COMPLETED' }
    })
    expect(mockToast.add).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Interview Updated',
        color: 'info'
      })
    )
    expect(mockRefreshFeed).toHaveBeenCalled()
    expect(result.notes).toBe('Updated notes')
  })

  describe('PassPort Submission Status & Staleness Engine', () => {
    it('performs refreshReservationStatus and updates local reservation record in-place', async () => {
      const courseId = ref('course-1')
      const updatedTimestamp = new Date().toISOString()
      mockFetch.mockResolvedValueOnce({
        statusCode: 200,
        data: {
          id: 'res-sched-1',
          submissionStatus: {
            latestSubmissionUrl: 'https://tool.com/grade/4',
            latestSubmissionNumber: 4
          },
          submissionStatusCheckedAt: updatedTimestamp
        }
      })

      const { refreshReservationStatus, refreshingStatusIds } = useGtaInterviewConsole(courseId)

      expect(refreshingStatusIds.value.has('res-sched-1')).toBe(false)
      const promise = refreshReservationStatus('res-sched-1')
      const result = await promise

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/me/courses/course-1/interviews/res-sched-1/refresh-status',
        { method: 'POST' }
      )
      expect(result.submissionStatus.latestSubmissionNumber).toBe(4)
      expect(refreshingStatusIds.value.has('res-sched-1')).toBe(false)

      const target = mockFeedData.value.data.find((r: any) => r.id === 'res-sched-1')
      expect(target.submissionStatus).toEqual({
        latestSubmissionUrl: 'https://tool.com/grade/4',
        latestSubmissionNumber: 4
      })
    })

    it('shows error toast when refreshReservationStatus fails', async () => {
      const courseId = ref('course-1')
      mockFetch.mockRejectedValueOnce({
        data: { statusMessage: 'External tool timeout' }
      })

      const { refreshReservationStatus, refreshingStatusIds } = useGtaInterviewConsole(courseId)

      await expect(refreshReservationStatus('res-sched-1')).rejects.toThrow()
      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Status Refresh Failed',
          color: 'error'
        })
      )
      expect(refreshingStatusIds.value.has('res-sched-1')).toBe(false)
    })

    it('ignores recently checked reservations in refreshVisibleStaleStatuses (<15m old)', async () => {
      const courseId = ref('course-1')
      // Mark res-active-1 as checked 2 minutes ago
      const recentCheck = new Date(Date.now() - 2 * 60 * 1000).toISOString()
      const active = mockFeedData.value.data.find((r: any) => r.id === 'res-active-1')
      active.submissionStatusCheckedAt = recentCheck

      const { refreshVisibleStaleStatuses } = useGtaInterviewConsole(courseId)
      const res = await refreshVisibleStaleStatuses(['res-active-1'])

      expect(res).toEqual([])
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('sends batch refresh for unchecked or stale reservations (>=15m old)', async () => {
      const courseId = ref('course-1')
      // res-sched-1 has no submissionStatusCheckedAt
      // res-done-1 has check from 20 minutes ago
      const staleCheck = new Date(Date.now() - 20 * 60 * 1000).toISOString()
      const done = mockFeedData.value.data.find((r: any) => r.id === 'res-done-1')
      done.submissionStatusCheckedAt = staleCheck

      mockFetch.mockResolvedValueOnce({
        statusCode: 200,
        data: [
          {
            id: 'res-sched-1',
            submissionStatus: { latestSubmissionNumber: 1 },
            submissionStatusCheckedAt: new Date().toISOString()
          },
          {
            id: 'res-done-1',
            submissionStatus: { latestSubmissionNumber: 2 },
            submissionStatusCheckedAt: new Date().toISOString()
          }
        ]
      })

      const { refreshVisibleStaleStatuses } = useGtaInterviewConsole(courseId)
      const result = await refreshVisibleStaleStatuses(['res-sched-1', 'res-done-1'])

      expect(mockFetch).toHaveBeenCalledWith('/api/me/courses/course-1/interviews/refresh-status', {
        method: 'POST',
        body: { reservationIds: ['res-sched-1', 'res-done-1'] }
      })
      expect(result).toHaveLength(2)

      const sched = mockFeedData.value.data.find((r: any) => r.id === 'res-sched-1')
      expect(sched.submissionStatus).toEqual({ latestSubmissionNumber: 1 })
    })

    it('manages polling timers correctly via startStalenessPolling and stopStalenessPolling', () => {
      vi.useFakeTimers()
      const courseId = ref('course-1')
      const { startStalenessPolling, stopStalenessPolling, STALENESS_THRESHOLD_MS } =
        useGtaInterviewConsole(courseId)

      mockFetch.mockResolvedValue({ statusCode: 200, data: [] })

      const mockGetIds = vi.fn(() => ['res-sched-1'])
      startStalenessPolling(mockGetIds)

      expect(mockGetIds).not.toHaveBeenCalled()
      vi.advanceTimersByTime(STALENESS_THRESHOLD_MS)
      expect(mockGetIds).toHaveBeenCalledTimes(1)

      stopStalenessPolling()
      vi.advanceTimersByTime(STALENESS_THRESHOLD_MS)
      expect(mockGetIds).toHaveBeenCalledTimes(1)

      vi.useRealTimers()
    })
  })
})

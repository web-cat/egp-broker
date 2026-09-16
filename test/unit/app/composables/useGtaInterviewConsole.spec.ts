import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useGtaInterviewConsole } from '../../../../app/composables/features/useGtaInterviewConsole'

const mockToast = {
  add: vi.fn()
}
vi.stubGlobal('useToast', () => mockToast)

const mockFeedData = ref<any>({
  data: [
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
    }
  ]
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
  })

  it('categorizes reservations into active, expected, and completed lists', () => {
    const courseId = ref('course-1')
    const { activeInterview, expectedArrivals, completedList } = useGtaInterviewConsole(courseId)

    expect(activeInterview.value).toBeDefined()
    expect(activeInterview.value?.id).toBe('res-active-1')

    expect(expectedArrivals.value).toHaveLength(1)
    expect(expectedArrivals.value[0].id).toBe('res-sched-1')

    expect(completedList.value).toHaveLength(2)
    expect(completedList.value.map((r: any) => r.id)).toEqual(['res-done-1', 'res-missed-1'])
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
})

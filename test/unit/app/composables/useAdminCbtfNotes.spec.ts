import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAdminCbtfNotes } from '../../../../app/composables/features/admin/useAdminCbtfNotes'

const mockToastAdd = vi.fn()
vi.stubGlobal('useToast', () => ({ add: mockToastAdd }))

const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

describe('useAdminCbtfNotes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('initializes with default filters and empty notes list', () => {
    const {
      studentFilter,
      assignmentFilter,
      courseFilter,
      dateFrom,
      dateTo,
      page,
      pageSize,
      notes,
      pagination
    } = useAdminCbtfNotes()

    expect(studentFilter.value).toBe('')
    expect(assignmentFilter.value).toBe('')
    expect(courseFilter.value).toBe('')
    expect(dateFrom.value).toBe('')
    expect(dateTo.value).toBe('')
    expect(page.value).toBe(1)
    expect(pageSize.value).toBe(20)
    expect(notes.value).toEqual([])
    expect(pagination.value.total).toBe(0)
  })

  it('fetches notes and maps pagination', async () => {
    const composable = useAdminCbtfNotes()

    mockFetch.mockResolvedValueOnce({
      statusCode: 200,
      data: [
        {
          id: 'note-1',
          reservationId: 'res-1',
          content: 'Left room without permission',
          hasPhotos: false,
          createdAt: '2026-09-24T12:00:00.000Z',
          updatedAt: '2026-09-24T12:00:00.000Z',
          author: { id: 'auth-1', name: 'Proctor P', email: 'p@vt.edu' },
          reservation: {
            id: 'res-1',
            seatNumber: 5,
            startTime: '2026-09-24T11:00:00.000Z',
            endTime: '2026-09-24T12:00:00.000Z',
            status: 'CHECKED_IN',
            student: { id: 's-1', name: 'John Doe', email: 'jdoe@vt.edu' },
            assignment: { id: 'a-1', title: 'Test 1' },
            course: { id: 'c-1', label: 'CS 1114', title: 'Intro' }
          }
        }
      ],
      pagination: {
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1
      }
    })

    await composable.fetchNotes()

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/cbtf/notes?page=1&pageSize=20')
    )
    expect(composable.notes.value.length).toBe(1)
    expect(composable.notes.value[0].content).toBe('Left room without permission')
    expect(composable.pagination.value.total).toBe(1)
  })

  it('filters by student, assignment, course, and date range', async () => {
    const composable = useAdminCbtfNotes()
    composable.studentFilter.value = 'John'
    composable.assignmentFilter.value = 'Exam'
    composable.courseFilter.value = 'CS 1114'
    composable.dateFrom.value = '2026-09-01'
    composable.dateTo.value = '2026-09-24'

    mockFetch.mockResolvedValueOnce({
      statusCode: 200,
      data: [],
      pagination: { total: 0, page: 1, pageSize: 20, totalPages: 1 }
    })

    await composable.fetchNotes()

    const calledUrl = mockFetch.mock.calls[0][0]
    expect(calledUrl).toContain('student=John')
    expect(calledUrl).toContain('assignment=Exam')
    expect(calledUrl).toContain('course=CS+1114')
    expect(calledUrl).toContain('from=2026-09-01')
    expect(calledUrl).toContain('to=2026-09-24')
  })

  it('resets all filters and navigates to page 1', () => {
    const composable = useAdminCbtfNotes()
    composable.studentFilter.value = 'John'
    composable.assignmentFilter.value = 'Exam'
    composable.courseFilter.value = 'CS 1114'
    composable.dateFrom.value = '2026-09-01'
    composable.dateTo.value = '2026-09-24'
    composable.page.value = 3

    mockFetch.mockResolvedValueOnce({
      statusCode: 200,
      data: [],
      pagination: { total: 0, page: 1, pageSize: 20, totalPages: 1 }
    })

    composable.resetFilters()

    expect(composable.studentFilter.value).toBe('')
    expect(composable.assignmentFilter.value).toBe('')
    expect(composable.courseFilter.value).toBe('')
    expect(composable.dateFrom.value).toBe('')
    expect(composable.dateTo.value).toBe('')
    expect(composable.page.value).toBe(1)
    expect(mockFetch).toHaveBeenCalled()
  })
})

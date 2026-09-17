import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useTeacherGtaShifts } from '~/composables/features/useTeacherGtaShifts'

const mockToast = {
  add: vi.fn()
}
vi.stubGlobal('useToast', () => mockToast)

const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

const mockUseFetch = vi.fn()
vi.stubGlobal('useFetch', mockUseFetch)

describe('useTeacherGtaShifts composable', () => {
  const courseId = ref('course-1')
  const refreshShiftsMock = vi.fn()
  const refreshGtasMock = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    mockUseFetch.mockImplementation((url: string | (() => string)) => {
      const urlStr = typeof url === 'function' ? url() : url
      if (urlStr.includes('/gta-shifts')) {
        return {
          data: ref({
            data: [
              {
                id: 'shift-1',
                courseId: 'course-1',
                userId: 'ta-1',
                date: '2026-09-18T00:00:00.000Z',
                startTime: '10:00',
                endTime: '12:00',
                user: {
                  id: 'ta-1',
                  firstName: 'Alice',
                  lastName: 'Smith',
                  email: 'alice@example.edu'
                }
              }
            ]
          }),
          status: ref('success'),
          refresh: refreshShiftsMock
        }
      }
      if (urlStr.includes('/gtas')) {
        return {
          data: ref({
            data: [
              {
                id: 'ta-1',
                firstName: 'Alice',
                lastName: 'Smith',
                email: 'alice@example.edu',
                avatarUrl: null
              }
            ]
          }),
          status: ref('success'),
          refresh: refreshGtasMock
        }
      }
      return { data: ref(null), status: ref('idle'), refresh: vi.fn() }
    })
  })

  it('exposes reactive shifts and gtas lists', () => {
    const { shifts, gtas } = useTeacherGtaShifts(courseId)
    expect(shifts.value).toHaveLength(1)
    expect(shifts.value[0].id).toBe('shift-1')
    expect(gtas.value).toHaveLength(1)
    expect(gtas.value[0].id).toBe('ta-1')
  })

  it('creates a single GTA shift and refreshes the list', async () => {
    mockFetch.mockResolvedValue({ statusCode: 201, data: { id: 'shift-2' } })
    const { createShift } = useTeacherGtaShifts(courseId)

    await createShift({
      userId: 'ta-1',
      date: '2026-09-20',
      startTime: '14:00',
      endTime: '16:00'
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/me/courses/course-1/gta-shifts', {
      method: 'POST',
      body: {
        courseId: 'course-1',
        userId: 'ta-1',
        date: '2026-09-20',
        startTime: '14:00',
        endTime: '16:00'
      }
    })
    expect(mockToast.add).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'GTA Shift Created', color: 'success' })
    )
    expect(refreshShiftsMock).toHaveBeenCalled()
  })

  it('updates a shift and refreshes the list', async () => {
    mockFetch.mockResolvedValue({ statusCode: 200, data: { id: 'shift-1' } })
    const { updateShift } = useTeacherGtaShifts(courseId)

    await updateShift('shift-1', {
      startTime: '11:00',
      endTime: '13:00'
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/me/courses/course-1/gta-shifts/shift-1', {
      method: 'PATCH',
      body: { startTime: '11:00', endTime: '13:00' }
    })
    expect(mockToast.add).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Shift Updated', color: 'success' })
    )
    expect(refreshShiftsMock).toHaveBeenCalled()
  })

  it('deletes a shift and refreshes the list', async () => {
    mockFetch.mockResolvedValue({ statusCode: 200, data: { success: true } })
    const { deleteShift } = useTeacherGtaShifts(courseId)

    await deleteShift('shift-1')

    expect(mockFetch).toHaveBeenCalledWith('/api/me/courses/course-1/gta-shifts/shift-1', {
      method: 'DELETE'
    })
    expect(mockToast.add).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Shift Deleted', color: 'info' })
    )
    expect(refreshShiftsMock).toHaveBeenCalled()
  })

  it('batch generates shifts and notifies user', async () => {
    mockFetch.mockResolvedValue({ statusCode: 201, data: { count: 6, shifts: [] } })
    const { batchGenerateShifts } = useTeacherGtaShifts(courseId)

    const res = await batchGenerateShifts({
      userId: 'ta-1',
      startDate: '2026-09-21',
      endDate: '2026-10-02',
      shifts: [{ dayOfWeek: 1, startTime: '10:00', endTime: '12:00' }]
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/me/courses/course-1/gta-shifts/batch', {
      method: 'POST',
      body: {
        userId: 'ta-1',
        startDate: '2026-09-21',
        endDate: '2026-10-02',
        shifts: [{ dayOfWeek: 1, startTime: '10:00', endTime: '12:00' }]
      }
    })
    expect(res).toEqual({ count: 6, shifts: [] })
    expect(mockToast.add).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Weekly Shifts Generated', color: 'success' })
    )
    expect(refreshShiftsMock).toHaveBeenCalled()
  })

  it('updates course interview location', async () => {
    mockFetch.mockResolvedValue({ statusCode: 200, data: { interviewLocation: 'McBryde 106' } })
    const { updateInterviewLocation } = useTeacherGtaShifts(courseId)

    const updated = await updateInterviewLocation('McBryde 106')
    expect(mockFetch).toHaveBeenCalledWith('/api/me/courses/course-1', {
      method: 'PATCH',
      body: { interviewLocation: 'McBryde 106' }
    })
    expect(updated).toBe('McBryde 106')
    expect(mockToast.add).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Interview Location Saved', color: 'success' })
    )
  })
})

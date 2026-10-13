import { describe, it, expect } from 'vitest'
import { ref, computed } from 'vue'
import {
  useGtaInterviewFilters,
  formatStudentName,
  getLocalDateStr
} from '~/composables/features/useGtaInterviewFilters'

describe('useGtaInterviewFilters', () => {
  it('formats student names gracefully with various inputs', () => {
    expect(formatStudentName(null)).toBe('Student')
    expect(formatStudentName({ firstName: 'Alice', lastName: 'Smith' })).toBe('Alice Smith')
    expect(formatStudentName({ email: 'bob@vt.edu' })).toBe('bob@vt.edu')
  })

  it('formats local date string consistently', () => {
    const d = new Date(2026, 8, 15) // Sep 15 2026
    expect(getLocalDateStr(d)).toBe('2026-09-15')
  })

  it('filters expected arrivals by GTA and date', () => {
    const expectedArrivals = ref([
      { id: '1', gtaId: 'gta-1', startTime: '2026-09-15T10:00:00.000Z' },
      { id: '2', gtaId: 'gta-2', startTime: '2026-09-15T11:00:00.000Z' }
    ])
    const completedList = ref([])
    const courseShiftsData = ref({ data: [] })
    const allReservationsForShifts = computed(() => [])

    const filters = useGtaInterviewFilters({
      isInstructorOrAdmin: computed(() => true),
      userId: computed(() => 'gta-1'),
      expectedArrivals,
      completedList,
      allReservationsForShifts,
      courseShiftsData
    })

    // Default shift filter is CURRENT_OR_NEXT, change to ALL to test gta filter
    filters.filterExpectedShift.value = 'ALL'
    expect(filters.filteredExpectedArrivals.value).toHaveLength(2)

    filters.filterExpectedGta.value = 'gta-1'
    expect(filters.filteredExpectedArrivals.value).toHaveLength(1)
    expect(filters.filteredExpectedArrivals.value[0].id).toBe('1')

    filters.resetExpectedFilters()
    expect(filters.filterExpectedGta.value).toBe('ALL')
  })

  it('filters completed list by student name search query', () => {
    const expectedArrivals = ref([])
    const completedList = ref([
      {
        id: '1',
        student: { firstName: 'Alice', lastName: 'Smith', email: 'alice@vt.edu' },
        status: 'COMPLETED',
        startTime: '2026-09-15T10:00:00.000Z'
      },
      {
        id: '2',
        student: { firstName: 'Bob', lastName: 'Jones', email: 'bob@vt.edu' },
        status: 'COMPLETED',
        startTime: '2026-09-15T10:00:00.000Z'
      }
    ])
    const courseShiftsData = ref({ data: [] })
    const allReservationsForShifts = computed(() => [])

    const filters = useGtaInterviewFilters({
      isInstructorOrAdmin: computed(() => true),
      userId: computed(() => 'admin-1'),
      expectedArrivals,
      completedList,
      allReservationsForShifts,
      courseShiftsData
    })

    expect(filters.filteredCompletedList.value).toHaveLength(2)

    filters.filterCompletedStudent.value = 'Alice'
    expect(filters.filteredCompletedList.value).toHaveLength(1)
    expect(filters.filteredCompletedList.value[0].id).toBe('1')

    filters.resetCompletedFilters()
    expect(filters.filterCompletedStudent.value).toBe('')
    expect(filters.filteredCompletedList.value).toHaveLength(2)
  })
})

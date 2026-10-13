import { ref, computed, watch, type Ref, type ComputedRef } from 'vue'
import { combineDateAndTime, DEFAULT_GTA_TIMEZONE, isMorningSlot } from '@@/shared/utils/timezone'

export interface ShiftCandidate {
  start: Date
  end: Date
  gtaId?: string
  label?: string
}

export const formatStudentName = (student?: any) => {
  if (!student) return 'Student'
  const first = student.firstName || ''
  const last = student.lastName || ''
  const full = `${first} ${last}`.trim()
  return full || student.email || student.studentId || 'Student'
}

export const getLocalDateStr = (dateInput: string | Date) => {
  const d = new Date(dateInput)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export interface UseGtaInterviewFiltersOptions {
  isInstructorOrAdmin: ComputedRef<boolean>
  userId: ComputedRef<string | undefined>
  expectedArrivals: Ref<any[]>
  completedList: Ref<any[]>
  allReservationsForShifts: ComputedRef<any[]>
  courseShiftsData: Ref<{ data: any[] } | null>
}

export function useGtaInterviewFilters(options: UseGtaInterviewFiltersOptions) {
  const {
    isInstructorOrAdmin,
    userId,
    expectedArrivals,
    completedList,
    allReservationsForShifts,
    courseShiftsData
  } = options

  // ─────────────────────────────────────────────────────────
  // Expected Arrivals Filter States
  // ─────────────────────────────────────────────────────────
  const filterExpectedGta = ref('ALL')
  const filterExpectedShift = ref('CURRENT_OR_NEXT')
  const filterExpectedDate = ref('')
  const expectedPage = ref(1)
  const expectedPageSize = 25

  const expectedShiftFilterOptions = [
    { label: 'Current / Next Shift (Default)', value: 'CURRENT_OR_NEXT' },
    { label: 'All Upcoming Shifts', value: 'ALL' },
    { label: 'Morning (< 12:30 PM)', value: 'MORNING' },
    { label: 'Afternoon / Evening (12:30 PM+)', value: 'AFTERNOON' }
  ]

  const resetExpectedFilters = () => {
    filterExpectedGta.value = 'ALL'
    filterExpectedShift.value = 'CURRENT_OR_NEXT'
    filterExpectedDate.value = ''
    expectedPage.value = 1
  }

  const activeExpectedFilterCount = computed(() => {
    let count = 0
    if (filterExpectedGta.value !== 'ALL') count++
    if (filterExpectedShift.value !== 'CURRENT_OR_NEXT') count++
    if (filterExpectedDate.value) count++
    return count
  })

  watch([filterExpectedGta, filterExpectedShift, filterExpectedDate], () => {
    expectedPage.value = 1
  })

  const targetExpectedGta = computed(() => {
    if (!isInstructorOrAdmin.value) {
      return userId.value || null
    }
    return filterExpectedGta.value === 'ALL' ? null : filterExpectedGta.value
  })

  const candidateShifts = computed<ShiftCandidate[]>(() => {
    const result: ShiftCandidate[] = []
    const gtaFilter = targetExpectedGta.value

    // 1. From database GtaShift records if available
    if (courseShiftsData.value?.data && courseShiftsData.value.data.length > 0) {
      for (const s of courseShiftsData.value.data) {
        if (gtaFilter && s.userId !== gtaFilter) continue
        try {
          const start = combineDateAndTime(s.date, s.startTime, DEFAULT_GTA_TIMEZONE)
          const end = combineDateAndTime(s.date, s.endTime, DEFAULT_GTA_TIMEZONE)
          result.push({
            start,
            end,
            gtaId: s.userId,
            label: `${s.startTime} – ${s.endTime}`
          })
        } catch {
          // Skip invalid date
        }
      }
    }

    // 2. Fallback / supplement from reservations if no formal shifts matched
    if (result.length === 0) {
      const clusterMap = new Map<string, { gtaId?: string; times: number[] }>()
      for (const r of allReservationsForShifts.value) {
        const gId = r.gtaId || r.gta?.id
        if (gtaFilter && gId && gId !== gtaFilter) continue
        const d = new Date(r.startTime)
        const dateStr = getLocalDateStr(d)
        const isMorning = isMorningSlot(d)
        const key = `${gId || 'any'}_${dateStr}_${isMorning ? 'am' : 'pm'}`
        if (!clusterMap.has(key)) {
          clusterMap.set(key, { gtaId: gId, times: [] })
        }
        clusterMap.get(key)!.times.push(d.getTime())
      }

      for (const cluster of clusterMap.values()) {
        if (cluster.times.length === 0) continue
        const minTime = Math.min(...cluster.times)
        const maxTime = Math.max(...cluster.times)
        result.push({
          start: new Date(minTime - 5 * 60000),
          end: new Date(maxTime + 15 * 60000),
          gtaId: cluster.gtaId
        })
      }
    }

    result.sort((a, b) => a.start.getTime() - b.start.getTime())
    return result
  })

  const currentOrNextShiftWindow = computed<{
    start: Date
    end: Date
    isCurrent: boolean
  } | null>(() => {
    const shifts = candidateShifts.value
    if (!shifts.length) return null

    const nowMs = Date.now()

    // 1. Check for currently active shift(s)
    const active = shifts.filter((s) => s.start.getTime() <= nowMs && nowMs <= s.end.getTime())
    if (active.length > 0) {
      const minStart = new Date(Math.min(...active.map((s) => s.start.getTime())))
      const maxEnd = new Date(Math.max(...active.map((s) => s.end.getTime())))
      return {
        start: minStart,
        end: maxEnd,
        isCurrent: true
      }
    }

    // 2. If none active, find upcoming shifts (end in future)
    const upcoming = shifts.filter((s) => s.end.getTime() > nowMs)
    if (upcoming.length > 0) {
      const nextStart = upcoming[0].start.getTime()
      const nextBatch = upcoming.filter((s) => Math.abs(s.start.getTime() - nextStart) < 30 * 60000)
      const minStart = new Date(Math.min(...nextBatch.map((s) => s.start.getTime())))
      const maxEnd = new Date(Math.max(...nextBatch.map((s) => s.end.getTime())))
      return {
        start: minStart,
        end: maxEnd,
        isCurrent: false
      }
    }

    return null
  })

  const filteredExpectedArrivals = computed(() => {
    return expectedArrivals.value.filter((res: any) => {
      // GTA filter
      if (filterExpectedGta.value !== 'ALL') {
        const resGtaId = res.gtaId || res.gta?.id
        if (resGtaId !== filterExpectedGta.value) return false
      } else if (!isInstructorOrAdmin.value && userId.value) {
        const resGtaId = res.gtaId || res.gta?.id
        if (resGtaId && resGtaId !== userId.value) return false
      }

      // Specific Date filter
      if (filterExpectedDate.value) {
        const resDate = getLocalDateStr(res.startTime)
        if (resDate !== filterExpectedDate.value) return false
      }

      // Shift filter
      const resTime = new Date(res.startTime).getTime()
      if (filterExpectedShift.value === 'CURRENT_OR_NEXT') {
        const window = currentOrNextShiftWindow.value
        if (window) {
          if (resTime < window.start.getTime() - 60000 || resTime > window.end.getTime() + 60000) {
            return false
          }
        }
      } else if (filterExpectedShift.value === 'MORNING') {
        if (!isMorningSlot(res.startTime)) return false
      } else if (filterExpectedShift.value === 'AFTERNOON') {
        if (isMorningSlot(res.startTime)) return false
      }

      return true
    })
  })

  const paginatedExpectedArrivals = computed(() => {
    const start = (expectedPage.value - 1) * expectedPageSize
    return filteredExpectedArrivals.value.slice(start, start + expectedPageSize)
  })

  // ─────────────────────────────────────────────────────────
  // Completed Interviews Filter States
  // ─────────────────────────────────────────────────────────
  const filterCompletedStudent = ref('')
  const filterCompletedGta = ref('ALL')
  const filterCompletedStartDate = ref('')
  const filterCompletedEndDate = ref('')
  const filterCompletedStatus = ref('COMPLETED')
  const completedPage = ref(1)
  const completedPageSize = 25

  const completedStatusFilterOptions = [
    { label: 'Completed (Default)', value: 'COMPLETED' },
    { label: 'Missed (No-Show)', value: 'MISSED' },
    { label: 'Cancelled', value: 'CANCELLED' },
    { label: 'Checked Out', value: 'CHECKED_OUT' },
    { label: 'All Statuses', value: 'ALL' }
  ]

  const resetCompletedFilters = () => {
    filterCompletedStudent.value = ''
    filterCompletedGta.value = 'ALL'
    filterCompletedStartDate.value = ''
    filterCompletedEndDate.value = ''
    filterCompletedStatus.value = 'COMPLETED'
    completedPage.value = 1
  }

  const activeCompletedFilterCount = computed(() => {
    let count = 0
    if (filterCompletedStudent.value.trim()) count++
    if (filterCompletedGta.value !== 'ALL') count++
    if (filterCompletedStartDate.value) count++
    if (filterCompletedEndDate.value) count++
    if (filterCompletedStatus.value !== 'COMPLETED') count++
    return count
  })

  watch(
    [
      filterCompletedStudent,
      filterCompletedGta,
      filterCompletedStartDate,
      filterCompletedEndDate,
      filterCompletedStatus
    ],
    () => {
      completedPage.value = 1
    }
  )

  const filteredCompletedList = computed(() => {
    return completedList.value.filter((res: any) => {
      // 1. Student Search Filter (name, email, student ID)
      if (filterCompletedStudent.value.trim()) {
        const q = filterCompletedStudent.value.trim().toLowerCase()
        const student = res.student
        const name = formatStudentName(student).toLowerCase()
        const firstName = (student?.firstName || '').toLowerCase()
        const lastName = (student?.lastName || '').toLowerCase()
        const email = (student?.email || '').toLowerCase()
        const studentId = (student?.studentId || '').toLowerCase()
        const matches =
          name.includes(q) ||
          firstName.includes(q) ||
          lastName.includes(q) ||
          email.includes(q) ||
          studentId.includes(q)
        if (!matches) return false
      }

      // 2. GTA Filter
      if (filterCompletedGta.value !== 'ALL') {
        const resGtaId = res.gtaId || res.gta?.id
        if (resGtaId !== filterCompletedGta.value) return false
      } else if (!isInstructorOrAdmin.value && userId.value) {
        const resGtaId = res.gtaId || res.gta?.id
        if (resGtaId && resGtaId !== userId.value) return false
      }

      // 3. Date Range: Start Date From
      const resDate = getLocalDateStr(res.startTime)
      if (filterCompletedStartDate.value && resDate < filterCompletedStartDate.value) {
        return false
      }

      // 4. Date Range: Start Date To
      if (filterCompletedEndDate.value && resDate > filterCompletedEndDate.value) {
        return false
      }

      // 5. Status Filter (default: COMPLETED)
      if (filterCompletedStatus.value !== 'ALL') {
        if (res.status !== filterCompletedStatus.value) return false
      }

      return true
    })
  })

  const paginatedCompletedList = computed(() => {
    const start = (completedPage.value - 1) * completedPageSize
    return filteredCompletedList.value.slice(start, start + completedPageSize)
  })

  return {
    // Expected Arrivals
    filterExpectedGta,
    filterExpectedShift,
    filterExpectedDate,
    expectedPage,
    expectedPageSize,
    expectedShiftFilterOptions,
    resetExpectedFilters,
    activeExpectedFilterCount,
    filteredExpectedArrivals,
    paginatedExpectedArrivals,
    currentOrNextShiftWindow,
    // Completed Interviews
    filterCompletedStudent,
    filterCompletedGta,
    filterCompletedStartDate,
    filterCompletedEndDate,
    filterCompletedStatus,
    completedPage,
    completedPageSize,
    completedStatusFilterOptions,
    resetCompletedFilters,
    activeCompletedFilterCount,
    filteredCompletedList,
    paginatedCompletedList
  }
}

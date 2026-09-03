import { ref, computed, onMounted, onUnmounted, getCurrentInstance } from 'vue'
import type { ApiResponse } from '@@/shared/types/api'
import { parseCardSwipe } from '~/utils/cardSwipe'

export function useCbtfProctor() {
  const toast = useToast()

  const { data: statusData, refresh: refreshStatus } =
    useFetch<ApiResponse<{ isOnDuty: boolean }>>('/api/proctor/status')

  const {
    data: feedData,
    status: feedStatus,
    refresh: refreshFeed
  } = useFetch<ApiResponse<any>>('/api/proctor/feed')

  const isOnDuty = computed(() => Boolean(statusData.value?.data?.isOnDuty))
  const facility = computed(() => feedData.value?.data?.facility)
  const counts = computed(
    () => feedData.value?.data?.counts || { seated: 0, arriving: 0, departures: 0 }
  )
  const seated = computed(() => feedData.value?.data?.seated || [])
  const arriving = computed(() => feedData.value?.data?.arriving || [])
  const departures = computed(() => feedData.value?.data?.departures || [])

  const lookupResult = ref<any | null>(null)
  const lookupLoading = ref(false)
  const lookupError = ref<string | null>(null)
  const lastAction = ref<{ message: string; type: 'checkin' | 'checkout'; time: Date } | null>(null)

  // Auto-polling feed timer (15 seconds)
  let pollInterval: any = null

  if (getCurrentInstance()) {
    onMounted(() => {
      pollInterval = setInterval(() => {
        refreshFeed()
      }, 15000)
    })

    onUnmounted(() => {
      if (pollInterval) {
        clearInterval(pollInterval)
      }
    })
  }

  const toggleDuty = async (newStatus: boolean) => {
    try {
      await $fetch('/api/proctor/status', {
        method: 'PATCH',
        body: { isOnDuty: newStatus }
      })
      await refreshStatus()
      toast.add({
        title: newStatus ? 'Checked On Duty' : 'Checked Off Duty',
        color: newStatus ? 'success' : 'neutral'
      })
    } catch (err: any) {
      toast.add({
        title: 'Failed to update duty status',
        description: err.data?.message || err.message,
        color: 'error'
      })
    }
  }

  const lookupStudent = async (rawInput: string) => {
    const studentId = parseCardSwipe(rawInput)
    if (!studentId) {
      lookupError.value = 'Please enter or swipe a valid Student ID'
      lookupResult.value = null
      return null
    }

    lookupLoading.value = true
    lookupError.value = null
    lookupResult.value = null

    try {
      const res = await $fetch<ApiResponse<any>>('/api/proctor/lookup', {
        params: { studentId }
      })
      lookupResult.value = res.data
      return res.data
    } catch (err: any) {
      lookupError.value = err.data?.message || err.message || 'Lookup failed'
      toast.add({
        title: 'Student Lookup Failed',
        description: lookupError.value || undefined,
        color: 'error'
      })
      return null
    } finally {
      lookupLoading.value = false
    }
  }

  const confirmCheckIn = async (reservationId: string) => {
    lookupLoading.value = true
    try {
      const res = await $fetch<ApiResponse<any>>('/api/proctor/check-in', {
        method: 'POST',
        body: { reservationId }
      })

      const studentName = res.data.studentName || 'Student'
      const seat = res.data.seatNumber

      lastAction.value = {
        message: `Checked in ${studentName} to Seat #${seat}. RETAIN student ID while testing.`,
        type: 'checkin',
        time: new Date()
      }

      toast.add({
        title: `Checked In: ${studentName}`,
        description: `Direct to Workstation Seat #${seat}. RETAIN student ID.`,
        color: 'success'
      })

      lookupResult.value = null
      await refreshFeed()
      return res.data
    } catch (err: any) {
      toast.add({
        title: 'Check-in Failed',
        description: err.data?.message || err.message,
        color: 'error'
      })
      throw err
    } finally {
      lookupLoading.value = false
    }
  }

  const confirmCheckOut = async (reservationId: string) => {
    lookupLoading.value = true
    try {
      const res = await $fetch<ApiResponse<any>>('/api/proctor/check-out', {
        method: 'POST',
        body: { reservationId }
      })

      const studentName = res.data.studentName || 'Student'

      lastAction.value = {
        message: `Checked out ${studentName}. RETURN student ID to student.`,
        type: 'checkout',
        time: new Date()
      }

      toast.add({
        title: `Checked Out: ${studentName}`,
        description: 'Exam session completed. RETURN student ID to student.',
        color: 'info'
      })

      lookupResult.value = null
      await refreshFeed()
      return res.data
    } catch (err: any) {
      toast.add({
        title: 'Check-out Failed',
        description: err.data?.message || err.message,
        color: 'error'
      })
      throw err
    } finally {
      lookupLoading.value = false
    }
  }

  const clearLookup = () => {
    lookupResult.value = null
    lookupError.value = null
  }

  // Note Modal State & Actions
  const isNoteModalOpen = ref(false)
  const selectedNoteTarget = ref<{
    reservationId?: string
    seatNumber?: number
    studentName?: string
    assignmentTitle?: string
    notes?: any[]
  } | null>(null)

  const openNoteModal = (target?: {
    reservationId?: string
    seatNumber?: number
    studentName?: string
    assignmentTitle?: string
    notes?: any[]
  }) => {
    selectedNoteTarget.value = target || null
    isNoteModalOpen.value = true
  }

  const closeNoteModal = () => {
    isNoteModalOpen.value = false
    selectedNoteTarget.value = null
  }

  const addNote = async (payload: {
    reservationId?: string
    seatNumber?: number
    content: string
    hasPhotos?: boolean
  }) => {
    try {
      const res = await $fetch<ApiResponse<any>>('/api/proctor/notes', {
        method: 'POST',
        body: payload
      })
      toast.add({
        title: 'Incident Note Logged',
        description: `Note saved for Seat #${res.data.seatNumber || payload.seatNumber || '—'} (${res.data.studentName || 'Student'}).`,
        color: 'warning'
      })
      await refreshFeed()
      closeNoteModal()
      return res.data
    } catch (err: any) {
      toast.add({
        title: 'Failed to Save Note',
        description: err.data?.message || err.message,
        color: 'error'
      })
      throw err
    }
  }

  const fetchNotes = async (reservationId: string) => {
    try {
      const res = await $fetch<ApiResponse<any[]>>('/api/proctor/notes', {
        params: { reservationId }
      })
      return res.data || []
    } catch (err: any) {
      console.error('Failed to fetch notes:', err)
      return []
    }
  }

  return {
    isOnDuty,
    toggleDuty,
    facility,
    counts,
    seated,
    arriving,
    departures,
    feedStatus,
    refreshFeed,
    lookupResult,
    lookupLoading,
    lookupError,
    lastAction,
    lookupStudent,
    confirmCheckIn,
    confirmCheckOut,
    clearLookup,
    isNoteModalOpen,
    selectedNoteTarget,
    openNoteModal,
    closeNoteModal,
    addNote,
    fetchNotes
  }
}

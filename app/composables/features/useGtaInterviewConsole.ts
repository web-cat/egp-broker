import { ref, computed, unref } from 'vue'
import type { Ref } from 'vue'
import type { ApiResponse } from '@@/shared/types/api'

export function useGtaInterviewConsole(courseId: string | Ref<string | null | undefined>) {
  const toast = useToast()
  const cId = computed(() => unref(courseId))

  const feedUrl = computed(() => (cId.value ? `/api/me/courses/${cId.value}/interviews` : null))

  const {
    data: feedResponse,
    status: feedStatus,
    refresh: refreshFeed
  } = useFetch<ApiResponse<any[]>>(feedUrl, {
    lazy: true,
    immediate: true
  })

  const reservations = computed<any[]>(() => feedResponse.value?.data || [])

  const activeInterview = computed<any | null>(
    () => reservations.value.find((r) => r.status === 'CHECKED_IN') || null
  )

  const expectedArrivals = computed<any[]>(() =>
    reservations.value
      .filter((r) => r.status === 'SCHEDULED')
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
  )

  const completedList = computed<any[]>(() =>
    reservations.value
      .filter((r) => r.status !== 'SCHEDULED' && r.status !== 'CHECKED_IN')
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
  )

  const isUpdating = ref(false)

  const checkIn = async (reservationId: string): Promise<any> => {
    if (!cId.value) throw new Error('Course ID is required')
    isUpdating.value = true
    try {
      const res = await $fetch<ApiResponse<any>>(
        `/api/me/courses/${cId.value}/interviews/${reservationId}`,
        {
          method: 'PATCH',
          body: { status: 'CHECKED_IN' }
        }
      )
      toast.add({
        title: 'Student Checked In',
        description: `${res.data.student?.firstName || 'Student'} is now in their interview session.`,
        color: 'success'
      })
      await refreshFeed()
      return res.data
    } catch (err: any) {
      toast.add({
        title: 'Check-In Failed',
        description: err?.data?.statusMessage || err?.message || 'Could not check in student.',
        color: 'error'
      })
      throw err
    } finally {
      isUpdating.value = false
    }
  }

  const checkOut = async (reservationId: string, notes?: string): Promise<any> => {
    if (!cId.value) throw new Error('Course ID is required')
    isUpdating.value = true
    try {
      const payload: { status: string; notes?: string } = { status: 'COMPLETED' }
      if (notes !== undefined) {
        payload.notes = notes
      }
      const res = await $fetch<ApiResponse<any>>(
        `/api/me/courses/${cId.value}/interviews/${reservationId}`,
        {
          method: 'PATCH',
          body: payload
        }
      )
      toast.add({
        title: 'Interview Completed',
        description: 'Interview session checked out and marked complete.',
        color: 'success'
      })
      await refreshFeed()
      return res.data
    } catch (err: any) {
      toast.add({
        title: 'Checkout Failed',
        description: err?.data?.statusMessage || err?.message || 'Could not check out student.',
        color: 'error'
      })
      throw err
    } finally {
      isUpdating.value = false
    }
  }

  const updateInterview = async (
    reservationId: string,
    payload: { notes?: string; status?: string }
  ): Promise<any> => {
    if (!cId.value) throw new Error('Course ID is required')
    isUpdating.value = true
    try {
      const res = await $fetch<ApiResponse<any>>(
        `/api/me/courses/${cId.value}/interviews/${reservationId}`,
        {
          method: 'PATCH',
          body: payload
        }
      )
      const isOnlyNotes = payload.notes !== undefined && payload.status === undefined
      toast.add({
        title: isOnlyNotes ? 'Notes Saved' : 'Interview Updated',
        description: isOnlyNotes
          ? 'Observation notes saved.'
          : 'Interview details have been updated.',
        color: 'info'
      })
      await refreshFeed()
      return res.data
    } catch (err: any) {
      toast.add({
        title: 'Update Failed',
        description: err?.data?.statusMessage || err?.message || 'Could not update interview.',
        color: 'error'
      })
      throw err
    } finally {
      isUpdating.value = false
    }
  }

  const saveNotes = async (reservationId: string, notes: string): Promise<any> => {
    return await updateInterview(reservationId, { notes })
  }

  const markNoShow = async (reservationId: string): Promise<any> => {
    if (!cId.value) throw new Error('Course ID is required')
    isUpdating.value = true
    try {
      const res = await $fetch<ApiResponse<any>>(
        `/api/me/courses/${cId.value}/interviews/${reservationId}`,
        {
          method: 'PATCH',
          body: { status: 'MISSED' }
        }
      )
      toast.add({
        title: 'Marked as No-Show',
        description: 'Student marked as absent/no-show.',
        color: 'warning'
      })
      await refreshFeed()
      return res.data
    } catch (err: any) {
      toast.add({
        title: 'Failed to Mark No-Show',
        description: err?.data?.statusMessage || err?.message || 'Could not update status.',
        color: 'error'
      })
      throw err
    } finally {
      isUpdating.value = false
    }
  }

  const cancelCheckIn = async (reservationId: string): Promise<any> => {
    if (!cId.value) throw new Error('Course ID is required')
    isUpdating.value = true
    try {
      const res = await $fetch<ApiResponse<any>>(
        `/api/me/courses/${cId.value}/interviews/${reservationId}`,
        {
          method: 'PATCH',
          body: { status: 'SCHEDULED' }
        }
      )
      toast.add({
        title: 'Check-In Cancelled',
        description: 'Student returned to expected arrivals queue.',
        color: 'info'
      })
      await refreshFeed()
      return res.data
    } catch (err: any) {
      toast.add({
        title: 'Failed to Cancel Check-In',
        description: err?.data?.statusMessage || err?.message || 'Could not cancel check-in.',
        color: 'error'
      })
      throw err
    } finally {
      isUpdating.value = false
    }
  }

  const reinstateReservation = async (reservationId: string): Promise<any> => {
    if (!cId.value) throw new Error('Course ID is required')
    isUpdating.value = true
    try {
      const res = await $fetch<ApiResponse<any>>(
        `/api/me/courses/${cId.value}/interviews/${reservationId}`,
        {
          method: 'PATCH',
          body: { status: 'SCHEDULED' }
        }
      )
      toast.add({
        title: 'Appointment Reopened',
        description: 'Student reinstated and returned to expected arrivals queue.',
        color: 'success'
      })
      await refreshFeed()
      return res.data
    } catch (err: any) {
      toast.add({
        title: 'Failed to Reinstate Appointment',
        description: err?.data?.statusMessage || err?.message || 'Could not reinstate appointment.',
        color: 'error'
      })
      throw err
    } finally {
      isUpdating.value = false
    }
  }

  return {
    reservations,
    activeInterview,
    expectedArrivals,
    completedList,
    feedStatus,
    isUpdating,
    refreshFeed,
    checkIn,
    cancelCheckIn,
    checkOut,
    updateInterview,
    saveNotes,
    markNoShow,
    reinstateReservation
  }
}

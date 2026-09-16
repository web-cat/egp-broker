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
      .filter(
        (r) => r.status === 'COMPLETED' || r.status === 'CHECKED_OUT' || r.status === 'MISSED'
      )
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

  const saveNotes = async (reservationId: string, notes: string): Promise<any> => {
    if (!cId.value) throw new Error('Course ID is required')
    isUpdating.value = true
    try {
      const res = await $fetch<ApiResponse<any>>(
        `/api/me/courses/${cId.value}/interviews/${reservationId}`,
        {
          method: 'PATCH',
          body: { notes }
        }
      )
      toast.add({
        title: 'Notes Saved',
        description: 'Interview observation notes updated.',
        color: 'info'
      })
      await refreshFeed()
      return res.data
    } catch (err: any) {
      toast.add({
        title: 'Failed to Save Notes',
        description: err?.data?.statusMessage || err?.message || 'Could not save notes.',
        color: 'error'
      })
      throw err
    } finally {
      isUpdating.value = false
    }
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

  return {
    reservations,
    activeInterview,
    expectedArrivals,
    completedList,
    feedStatus,
    isUpdating,
    refreshFeed,
    checkIn,
    checkOut,
    saveNotes,
    markNoShow
  }
}

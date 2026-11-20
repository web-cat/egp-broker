import { ref, computed, unref, onMounted, onUnmounted, getCurrentInstance } from 'vue'
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
    immediate: true,
    deep: true
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

  const { data: courseGtasData, refresh: refreshGtas } = useFetch<ApiResponse<any[]>>(
    computed(() => (cId.value ? `/api/me/courses/${cId.value}/gtas` : null)),
    { lazy: true }
  )

  const { data: courseShiftsData, refresh: refreshShifts } = useFetch<ApiResponse<any[]>>(
    computed(() => (cId.value ? `/api/me/courses/${cId.value}/gta-shifts` : null)),
    { lazy: true }
  )

  const STALENESS_THRESHOLD_MS = 15 * 60 * 1000 // 15 minutes
  const refreshingStatusIds = ref<Set<string>>(new Set())

  const setRefreshing = (id: string, isRefreshing: boolean) => {
    const next = new Set(refreshingStatusIds.value)
    if (isRefreshing) {
      next.add(id)
    } else {
      next.delete(id)
    }
    refreshingStatusIds.value = next
  }

  const setBatchRefreshing = (ids: string[], isRefreshing: boolean) => {
    const next = new Set(refreshingStatusIds.value)
    for (const id of ids) {
      if (isRefreshing) {
        next.add(id)
      } else {
        next.delete(id)
      }
    }
    refreshingStatusIds.value = next
  }

  const refreshReservationStatus = async (reservationId: string): Promise<any> => {
    if (!cId.value) throw new Error('Course ID is required')
    setRefreshing(reservationId, true)
    try {
      const res = await $fetch<ApiResponse<any>>(
        `/api/me/courses/${cId.value}/interviews/${reservationId}/refresh-status`,
        {
          method: 'POST'
        }
      )
      if (feedResponse.value?.data && res.data) {
        const nextData = [...feedResponse.value.data]
        const idx = nextData.findIndex((r: any) => r.id === reservationId)
        if (idx !== -1) {
          nextData[idx] = {
            ...nextData[idx],
            submissionStatus: res.data.submissionStatus,
            submissionStatusCheckedAt: res.data.submissionStatusCheckedAt
          }
          feedResponse.value = {
            ...feedResponse.value,
            data: nextData
          }
        }
      }
      return res.data
    } catch (err: any) {
      toast.add({
        title: 'Status Refresh Failed',
        description:
          err?.data?.statusMessage || err?.message || 'Could not query external tool status.',
        color: 'error'
      })
      throw err
    } finally {
      setRefreshing(reservationId, false)
    }
  }

  const refreshVisibleStaleStatuses = async (visibleReservationIds: string[]): Promise<any[]> => {
    if (!cId.value || !visibleReservationIds || visibleReservationIds.length === 0) {
      return []
    }

    const currentReservations = feedResponse.value?.data || []
    const staleIds = visibleReservationIds.filter((id) => {
      const r = currentReservations.find((item: any) => item.id === id)
      if (!r) return false
      if (!r.submissionStatusCheckedAt) return true
      return Date.now() - new Date(r.submissionStatusCheckedAt).getTime() >= STALENESS_THRESHOLD_MS
    })

    if (staleIds.length === 0) {
      return []
    }

    const batchToQuery = staleIds.slice(0, 20)
    setBatchRefreshing(batchToQuery, true)

    try {
      const res = await $fetch<ApiResponse<any[]>>(
        `/api/me/courses/${cId.value}/interviews/refresh-status`,
        {
          method: 'POST',
          body: { reservationIds: batchToQuery }
        }
      )

      if (feedResponse.value?.data && Array.isArray(res.data)) {
        const nextData = [...feedResponse.value.data]
        let didUpdate = false
        for (const updated of res.data) {
          const idx = nextData.findIndex((r: any) => r.id === updated.id)
          if (idx !== -1) {
            nextData[idx] = {
              ...nextData[idx],
              submissionStatus: updated.submissionStatus,
              submissionStatusCheckedAt: updated.submissionStatusCheckedAt
            }
            didUpdate = true
          }
        }
        if (didUpdate) {
          feedResponse.value = {
            ...feedResponse.value,
            data: nextData
          }
        }
      }

      return res.data || []
    } catch (err: any) {
      console.warn(
        '[useGtaInterviewConsole] Failed to refresh stale submission statuses:',
        err?.message
      )
      return []
    } finally {
      setBatchRefreshing(batchToQuery, false)
    }
  }

  let stalenessTimer: any = null

  const getVisibleIdsDefault = (): string[] => {
    const ids: string[] = []
    if (activeInterview.value?.id) {
      ids.push(activeInterview.value.id)
    }
    for (const r of expectedArrivals.value.slice(0, 10)) {
      if (r?.id) ids.push(r.id)
    }
    return ids
  }

  const startStalenessPolling = (getIds?: () => string[]) => {
    if (stalenessTimer) {
      clearInterval(stalenessTimer)
    }
    stalenessTimer = setInterval(() => {
      const ids = getIds ? getIds() : getVisibleIdsDefault()
      refreshVisibleStaleStatuses(ids)
    }, STALENESS_THRESHOLD_MS)
  }

  const stopStalenessPolling = () => {
    if (stalenessTimer) {
      clearInterval(stalenessTimer)
      stalenessTimer = null
    }
  }

  if (getCurrentInstance()) {
    onMounted(() => {
      startStalenessPolling()
    })

    onUnmounted(() => {
      stopStalenessPolling()
    })
  }

  return {
    reservations,
    activeInterview,
    expectedArrivals,
    completedList,
    feedStatus,
    isUpdating,
    courseGtasData,
    courseShiftsData,
    refreshingStatusIds,
    STALENESS_THRESHOLD_MS,
    refreshGtas,
    refreshShifts,
    refreshFeed,
    checkIn,
    cancelCheckIn,
    checkOut,
    updateInterview,
    saveNotes,
    markNoShow,
    reinstateReservation,
    refreshReservationStatus,
    refreshVisibleStaleStatuses,
    startStalenessPolling,
    stopStalenessPolling
  }
}

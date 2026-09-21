import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import type { ApiResponse } from '@@/shared/types/api'

export interface GtaShiftUser {
  id: string
  firstName: string
  lastName: string
  email: string
  avatarUrl?: string | null
}

export interface GtaShiftItem {
  id: string
  courseId: string
  userId: string
  date: string
  startTime: string
  endTime: string
  user: GtaShiftUser
}

export interface CourseGtaUser {
  id: string
  firstName: string
  lastName: string
  email: string
  avatarUrl: string | null
}

export const useTeacherGtaShifts = (courseIdRef: MaybeRefOrGetter<string | null | undefined>) => {
  const toast = useToast()

  const courseId = computed(() => toValue(courseIdRef) || '')

  // --- Fetch Shifts ---
  const {
    data: shiftsData,
    status: shiftsStatus,
    refresh: refreshShifts
  } = useFetch<ApiResponse<GtaShiftItem[]>>(
    () => (courseId.value ? `/api/me/courses/${courseId.value}/gta-shifts` : ''),
    {
      lazy: true,
      immediate: !!courseId.value
    }
  )

  const shifts = computed(() => shiftsData.value?.data || [])

  // --- Fetch GTAs ---
  const {
    data: gtasData,
    status: gtasStatus,
    refresh: refreshGtas
  } = useFetch<ApiResponse<CourseGtaUser[]>>(
    () => (courseId.value ? `/api/me/courses/${courseId.value}/gtas` : ''),
    {
      lazy: true,
      immediate: !!courseId.value
    }
  )

  const gtas = computed(() => gtasData.value?.data || [])

  // --- Shift Actions ---
  const createShift = async (payload: {
    userId: string
    date: string
    startTime: string
    endTime: string
  }) => {
    if (!courseId.value) return
    try {
      const res = await $fetch<ApiResponse<any>>(`/api/me/courses/${courseId.value}/gta-shifts`, {
        method: 'POST',
        body: {
          courseId: courseId.value,
          ...payload
        }
      })
      toast.add({
        title: 'GTA Shift Created',
        description: 'Successfully scheduled GTA shift.',
        color: 'success'
      })
      await refreshShifts()
      return res.data
    } catch (err: any) {
      toast.add({
        title: 'Failed to Create Shift',
        description: err.data?.statusMessage || err.data?.message || err.message,
        color: 'error'
      })
      throw err
    }
  }

  const updateShift = async (
    id: string,
    payload: { userId?: string; date?: string; startTime?: string; endTime?: string }
  ) => {
    if (!courseId.value) return
    try {
      const res = await $fetch<ApiResponse<any>>(
        `/api/me/courses/${courseId.value}/gta-shifts/${id}`,
        {
          method: 'PATCH',
          body: payload
        }
      )
      toast.add({
        title: 'Shift Updated',
        description: 'Successfully updated shift details.',
        color: 'success'
      })
      await refreshShifts()
      return res.data
    } catch (err: any) {
      toast.add({
        title: 'Failed to Update Shift',
        description: err.data?.statusMessage || err.data?.message || err.message,
        color: 'error'
      })
      throw err
    }
  }

  const deleteShift = async (id: string) => {
    if (!courseId.value) return
    try {
      const res = await $fetch<ApiResponse<{ success: boolean; impact: any }>>(
        `/api/me/courses/${courseId.value}/gta-shifts/${id}`,
        {
          method: 'DELETE'
        }
      )
      toast.add({
        title: 'Shift Deleted',
        color: 'info'
      })
      await refreshShifts()
      return res.data
    } catch (err: any) {
      toast.add({
        title: 'Failed to Delete Shift',
        description: err.data?.statusMessage || err.data?.message || err.message,
        color: 'error'
      })
      throw err
    }
  }

  const getShiftDetails = async (id: string) => {
    if (!courseId.value) return null
    try {
      const res = await $fetch<ApiResponse<any>>(
        `/api/me/courses/${courseId.value}/gta-shifts/${id}/details`
      )
      return res.data
    } catch (err: any) {
      toast.add({
        title: 'Failed to Load Shift Details',
        description: err.data?.statusMessage || err.data?.message || err.message,
        color: 'error'
      })
      throw err
    }
  }

  const rescheduleInterview = async (interviewId: string, targetGtaId?: string) => {
    if (!courseId.value) return null
    try {
      const res = await $fetch<ApiResponse<any>>(
        `/api/me/courses/${courseId.value}/interviews/${interviewId}/reschedule`,
        {
          method: 'POST',
          body: { targetGtaId }
        }
      )
      toast.add({
        title: 'Interview Rescheduled',
        description: `Successfully reassigned to ${res.data?.newGta?.name || 'new GTA'}.`,
        color: 'success'
      })
      return res.data
    } catch (err: any) {
      toast.add({
        title: 'Reschedule Failed',
        description: err.data?.statusMessage || err.data?.message || err.message,
        color: 'error'
      })
      throw err
    }
  }

  const cancelInterview = async (interviewId: string) => {
    if (!courseId.value) return null
    try {
      const res = await $fetch<ApiResponse<any>>(
        `/api/me/courses/${courseId.value}/interviews/${interviewId}/cancel`,
        {
          method: 'POST'
        }
      )
      toast.add({
        title: 'Interview Cancelled',
        description: 'Successfully cancelled student appointment.',
        color: 'info'
      })
      return res.data
    } catch (err: any) {
      toast.add({
        title: 'Cancel Failed',
        description: err.data?.statusMessage || err.data?.message || err.message,
        color: 'error'
      })
      throw err
    }
  }

  const batchGenerateShifts = async (payload: {
    userId: string
    startDate: string
    endDate: string
    shifts: Array<{ dayOfWeek: number; startTime: string; endTime: string }>
  }) => {
    if (!courseId.value) return
    try {
      const res = await $fetch<ApiResponse<{ count: number; shifts: any[] }>>(
        `/api/me/courses/${courseId.value}/gta-shifts/batch`,
        {
          method: 'POST',
          body: payload
        }
      )
      toast.add({
        title: 'Weekly Shifts Generated',
        description: `Successfully scheduled ${res.data?.count || 0} shift instances.`,
        color: 'success'
      })
      await refreshShifts()
      return res.data
    } catch (err: any) {
      toast.add({
        title: 'Failed to Generate Weekly Shifts',
        description: err.data?.statusMessage || err.data?.message || err.message,
        color: 'error'
      })
      throw err
    }
  }

  const updateInterviewLocation = async (newLocation: string | null) => {
    if (!courseId.value) return null
    try {
      const trimmed = newLocation?.trim() || null
      const res = await $fetch<ApiResponse<{ interviewLocation: string | null }>>(
        `/api/me/courses/${courseId.value}`,
        {
          method: 'PATCH',
          body: {
            interviewLocation: trimmed
          }
        }
      )
      toast.add({
        title: 'Interview Location Saved',
        description: 'Updated course GTA interview meeting location.',
        color: 'success'
      })
      return res.data?.interviewLocation ?? trimmed
    } catch (err: any) {
      toast.add({
        title: 'Failed to Save Location',
        description: err.data?.statusMessage || err.data?.message || err.message,
        color: 'error'
      })
      throw err
    }
  }

  return {
    shifts,
    shiftsStatus,
    gtas,
    gtasStatus,
    refreshShifts,
    refreshGtas,
    createShift,
    updateShift,
    deleteShift,
    batchGenerateShifts,
    updateInterviewLocation,
    getShiftDetails,
    rescheduleInterview,
    cancelInterview
  }
}

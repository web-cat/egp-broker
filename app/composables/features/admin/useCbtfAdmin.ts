import type { ApiResponse } from '@@/shared/types/api'
import type { CbtfReservationDto } from '@@/shared/models/cbtf'

export function useCbtfAdmin() {
  const toast = useToast()

  const {
    data: facilityData,
    status: facilityStatus,
    refresh: refreshFacility
  } = useFetch<ApiResponse<any>>('/api/admin/cbtf/facility')

  const {
    data: shiftsData,
    status: shiftsStatus,
    refresh: refreshShifts
  } = useFetch<ApiResponse<any[]>>('/api/admin/cbtf/shifts')

  const {
    data: reservationsData,
    status: reservationsStatus,
    refresh: refreshReservations
  } = useFetch<ApiResponse<CbtfReservationDto[]>>('/api/admin/cbtf/reservations')

  const facility = computed(() => facilityData.value?.data)
  const shifts = computed(() => shiftsData.value?.data || [])
  const reservations = computed(() => reservationsData.value?.data || [])

  const saveFacility = async (payload: {
    name?: string
    totalSeats?: number
    seatAllocationOrder?: number[]
  }) => {
    try {
      await $fetch('/api/admin/cbtf/facility', {
        method: 'PATCH',
        body: payload
      })
      toast.add({
        title: 'Facility Settings Saved',
        color: 'success'
      })
      await refreshFacility()
    } catch (err: any) {
      toast.add({
        title: 'Failed to Save Facility',
        description: err.data?.message || err.message,
        color: 'error'
      })
      throw err
    }
  }

  const upsertOperatingHours = async (dayOfWeek: number, openTime: string, closeTime: string) => {
    if (!facility.value?.id) return
    try {
      await $fetch('/api/admin/cbtf/operating-hours', {
        method: 'POST',
        body: {
          facilityId: facility.value.id,
          dayOfWeek,
          openTime,
          closeTime
        }
      })
      toast.add({
        title: 'Operating Hours Updated',
        color: 'success'
      })
      await refreshFacility()
    } catch (err: any) {
      toast.add({
        title: 'Failed to Update Hours',
        description: err.data?.message || err.message,
        color: 'error'
      })
      throw err
    }
  }

  const deleteOperatingHours = async (id: string) => {
    try {
      await $fetch(`/api/admin/cbtf/operating-hours/${id}`, {
        method: 'DELETE'
      })
      toast.add({
        title: 'Operating Hours Deleted',
        color: 'info'
      })
      await refreshFacility()
    } catch (err: any) {
      toast.add({
        title: 'Failed to Delete Hours',
        description: err.data?.message || err.message,
        color: 'error'
      })
      throw err
    }
  }

  const createException = async (payload: {
    date: string
    isClosed: boolean
    openTime?: string | null
    closeTime?: string | null
    reason?: string | null
  }) => {
    if (!facility.value?.id) return
    try {
      await $fetch('/api/admin/cbtf/exceptions', {
        method: 'POST',
        body: {
          facilityId: facility.value.id,
          ...payload
        }
      })
      toast.add({
        title: 'Schedule Exception Created',
        color: 'success'
      })
      await refreshFacility()
    } catch (err: any) {
      toast.add({
        title: 'Failed to Create Exception',
        description: err.data?.message || err.message,
        color: 'error'
      })
      throw err
    }
  }

  const deleteException = async (id: string) => {
    try {
      await $fetch(`/api/admin/cbtf/exceptions/${id}`, {
        method: 'DELETE'
      })
      toast.add({
        title: 'Exception Deleted',
        color: 'info'
      })
      await refreshFacility()
    } catch (err: any) {
      toast.add({
        title: 'Failed to Delete Exception',
        description: err.data?.message || err.message,
        color: 'error'
      })
      throw err
    }
  }

  const createShift = async (payload: { userId: string; startTime: string; endTime: string }) => {
    if (!facility.value?.id) return
    try {
      await $fetch('/api/admin/cbtf/shifts', {
        method: 'POST',
        body: {
          facilityId: facility.value.id,
          ...payload
        }
      })
      toast.add({
        title: 'Proctor Shift Created',
        color: 'success'
      })
      await refreshShifts()
    } catch (err: any) {
      toast.add({
        title: 'Failed to Create Shift',
        description: err.data?.message || err.message,
        color: 'error'
      })
      throw err
    }
  }

  const deleteShift = async (id: string) => {
    try {
      await $fetch(`/api/admin/cbtf/shifts/${id}`, {
        method: 'DELETE'
      })
      toast.add({
        title: 'Shift Deleted',
        color: 'info'
      })
      await refreshShifts()
    } catch (err: any) {
      toast.add({
        title: 'Failed to Delete Shift',
        description: err.data?.message || err.message,
        color: 'error'
      })
      throw err
    }
  }

  const updateReservation = async (
    id: string,
    updates: { status?: string; seatNumber?: number }
  ) => {
    try {
      await $fetch(`/api/admin/cbtf/reservations/${id}`, {
        method: 'PATCH',
        body: updates
      })
      toast.add({
        title: 'Reservation Updated',
        color: 'success'
      })
      await refreshReservations()
    } catch (err: any) {
      toast.add({
        title: 'Update Failed',
        description: err.data?.message || err.message,
        color: 'error'
      })
      throw err
    }
  }

  return {
    facility,
    facilityStatus,
    refreshFacility,
    shifts,
    shiftsStatus,
    refreshShifts,
    reservations,
    reservationsStatus,
    refreshReservations,
    saveFacility,
    upsertOperatingHours,
    deleteOperatingHours,
    createException,
    deleteException,
    createShift,
    deleteShift,
    updateReservation
  }
}

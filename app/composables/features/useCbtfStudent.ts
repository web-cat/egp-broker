import type { ApiResponse } from '@@/shared/types/api'
import type {
  CbtfReservationDto,
  CbtfRecommendedDay,
  CbtfHourlySlotChoice
} from '@@/shared/models/cbtf'

export interface CbtfAvailabilityData {
  assignmentTitle: string | null
  studentWindow: {
    start: string
    end: string
    isPassWindow: boolean
  }
  activeReservation: CbtfReservationDto | null
  recommendedDays: CbtfRecommendedDay[]
  hourlySlots: CbtfHourlySlotChoice[]
}

export function useCbtfStudent() {
  const toast = useToast()

  const {
    data: reservationsData,
    status: reservationsStatus,
    refresh: refreshReservations
  } = useFetch<ApiResponse<CbtfReservationDto[]>>('/api/me/cbtf/reservations')

  const reservations = computed<CbtfReservationDto[]>(() => reservationsData.value?.data || [])

  const activeReservations = computed<CbtfReservationDto[]>(() =>
    reservations.value.filter((r) => r.status === 'SCHEDULED' || r.status === 'CHECKED_IN')
  )

  const nextUpcomingReservation = computed<CbtfReservationDto | null>(() => {
    const now = new Date()
    const future = activeReservations.value.filter((r) => new Date(r.endTime) >= now)
    if (!future.length) return null
    return future.sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    )[0]
  })

  const getReservationForAssignment = (assignmentId: string): CbtfReservationDto | undefined => {
    return reservations.value.find(
      (r) =>
        r.assignmentId === assignmentId &&
        (r.status === 'SCHEDULED' || r.status === 'CHECKED_IN' || r.status === 'MISSED')
    )
  }

  const fetchAvailability = async (
    assignmentId: string,
    timeOfDayPreference?: 'morning' | 'afternoon',
    selectedDate?: string
  ): Promise<CbtfAvailabilityData> => {
    const params: Record<string, string> = { assignmentId }
    if (timeOfDayPreference) params.timeOfDayPreference = timeOfDayPreference
    if (selectedDate) params.selectedDate = selectedDate

    const res = await $fetch<ApiResponse<CbtfAvailabilityData>>('/api/me/cbtf/availability', {
      params
    })
    return res.data
  }

  const createReservation = async (
    assignmentId: string,
    startTime: string
  ): Promise<CbtfReservationDto> => {
    try {
      const res = await $fetch<ApiResponse<CbtfReservationDto>>('/api/me/cbtf/reservations', {
        method: 'POST',
        body: { assignmentId, startTime }
      })
      toast.add({
        title: 'Exam Scheduled Successfully',
        description: `Your workstation seat #${res.data.seatNumber} has been reserved.`,
        color: 'success'
      })
      await refreshReservations()
      return res.data
    } catch (err: any) {
      toast.add({
        title: 'Booking Failed',
        description: err.data?.message || err.message || 'Could not reserve slot.',
        color: 'error'
      })
      throw err
    }
  }

  const rescheduleReservation = async (
    reservationId: string,
    newStartTime: string
  ): Promise<CbtfReservationDto> => {
    try {
      const res = await $fetch<ApiResponse<CbtfReservationDto>>(
        `/api/me/cbtf/reservations/${reservationId}`,
        {
          method: 'PATCH',
          body: { startTime: newStartTime }
        }
      )
      toast.add({
        title: 'Reservation Rescheduled',
        description: `Your new workstation seat is #${res.data.seatNumber}.`,
        color: 'success'
      })
      await refreshReservations()
      return res.data
    } catch (err: any) {
      toast.add({
        title: 'Reschedule Failed',
        description: err.data?.message || err.message || 'Could not reschedule slot.',
        color: 'error'
      })
      throw err
    }
  }

  const cancelReservation = async (reservationId: string): Promise<void> => {
    try {
      await $fetch<ApiResponse<CbtfReservationDto>>(`/api/me/cbtf/reservations/${reservationId}`, {
        method: 'DELETE'
      })
      toast.add({
        title: 'Reservation Cancelled',
        description: 'Your testing center reservation has been cancelled.',
        color: 'info'
      })
      await refreshReservations()
    } catch (err: any) {
      toast.add({
        title: 'Cancellation Failed',
        description: err.data?.message || err.message || 'Could not cancel reservation.',
        color: 'error'
      })
      throw err
    }
  }

  return {
    reservations,
    reservationsStatus,
    refreshReservations,
    activeReservations,
    nextUpcomingReservation,
    getReservationForAssignment,
    fetchAvailability,
    createReservation,
    rescheduleReservation,
    cancelReservation
  }
}

import { ref, computed, unref } from 'vue'
import type { Ref } from 'vue'
import type { ApiResponse } from '@@/shared/types/api'
import type {
  GtaInterviewSlotsResponse,
  GtaInterviewReservationDto
} from '@@/shared/schemas/gta-interview.schema'

export function useGtaInterviewStudent(
  courseId: string | Ref<string | null | undefined>,
  assignmentId: string | Ref<string | null | undefined>
) {
  const toast = useToast()

  const cId = computed(() => unref(courseId))
  const aId = computed(() => unref(assignmentId))

  const slotsUrl = computed(() =>
    cId.value && aId.value
      ? `/api/me/courses/${cId.value}/assignments/${aId.value}/interview-slots`
      : null
  )

  const reservationUrl = computed(() =>
    cId.value && aId.value
      ? `/api/me/courses/${cId.value}/assignments/${aId.value}/interview-reservations/my`
      : null
  )

  const {
    data: slotsResponse,
    status: slotsStatus,
    refresh: refreshSlots
  } = useFetch<ApiResponse<GtaInterviewSlotsResponse>>(slotsUrl, {
    lazy: true,
    immediate: true
  })

  const {
    data: reservationResponse,
    status: reservationStatus,
    refresh: refreshReservation
  } = useFetch<ApiResponse<GtaInterviewReservationDto | null>>(reservationUrl, {
    lazy: true,
    immediate: true
  })

  const slotsData = computed<GtaInterviewSlotsResponse | null>(
    () => slotsResponse.value?.data || null
  )
  const myReservation = computed<GtaInterviewReservationDto | null>(
    () => reservationResponse.value?.data || null
  )

  const isBooking = ref(false)
  const isCancelling = ref(false)

  const bookSlot = async (
    startTime: string,
    rescheduleReservationId?: string
  ): Promise<GtaInterviewReservationDto> => {
    if (!cId.value || !aId.value) {
      throw new Error('Course and assignment IDs are required')
    }

    isBooking.value = true
    try {
      const res = await $fetch<ApiResponse<GtaInterviewReservationDto>>(
        `/api/me/courses/${cId.value}/assignments/${aId.value}/interview-reservations`,
        {
          method: 'POST',
          body: {
            startTime,
            ...(rescheduleReservationId ? { rescheduleReservationId } : {})
          }
        }
      )

      const gtaName = res.data.gta
        ? `${res.data.gta.firstName || ''} ${res.data.gta.lastName || ''}`.trim() ||
          res.data.gta.email
        : 'Graduate TA'

      toast.add({
        title: 'Interview Booked Successfully',
        description: `Your grading interview with ${gtaName} has been confirmed.`,
        color: 'success'
      })

      await Promise.all([refreshReservation(), refreshSlots()])
      return res.data
    } catch (err: any) {
      toast.add({
        title: 'Booking Failed',
        description:
          err?.data?.statusMessage || err?.message || 'Could not schedule interview slot.',
        color: 'error'
      })
      throw err
    } finally {
      isBooking.value = false
    }
  }

  const cancelReservation = async (reservationId: string): Promise<void> => {
    if (!cId.value || !aId.value) {
      throw new Error('Course and assignment IDs are required')
    }

    isCancelling.value = true
    try {
      await $fetch(
        `/api/me/courses/${cId.value}/assignments/${aId.value}/interview-reservations/${reservationId}`,
        {
          method: 'DELETE'
        }
      )

      toast.add({
        title: 'Interview Cancelled',
        description: 'Your scheduled interview has been cancelled.',
        color: 'info'
      })

      await Promise.all([refreshReservation(), refreshSlots()])
    } catch (err: any) {
      toast.add({
        title: 'Cancellation Failed',
        description: err?.data?.statusMessage || err?.message || 'Could not cancel interview.',
        color: 'error'
      })
      throw err
    } finally {
      isCancelling.value = false
    }
  }

  return {
    slotsData,
    slotsStatus,
    refreshSlots,
    myReservation,
    reservationStatus,
    refreshReservation,
    isBooking,
    isCancelling,
    bookSlot,
    cancelReservation
  }
}

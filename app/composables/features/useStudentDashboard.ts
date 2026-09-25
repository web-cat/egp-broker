import type { SimplePassPool, RedemptionRow, PassTypeData } from '@@/shared/models/pass'
import type { ApiResponse } from '@@/shared/types/api'
import type { AssignmentRow } from '@@/shared/models/assignment'
import { filterStudentAssignments } from '@@/shared/utils/student-assignments'
import { createStudentAssignmentColumns } from '~/composables/features/useStudentAssignmentTable'
import { useCbtfStudent } from '~/composables/features/useCbtfStudent'
import { useCurrentEnrollment } from '~/composables/features/useEnrollmentsFeature'

export const useStudentDashboard = (isPreview = false) => {
  const toast = useToast()

  const {
    nextUpcomingReservation,
    getReservationForAssignment,
    refreshReservations: refreshCbtfReservations
  } = useCbtfStudent()

  // Fetch pass pools for the current course
  const { data: passPools, refresh: refreshPassPools } =
    useFetch<ApiResponse<SimplePassPool[]>>('/api/me/pass-pools')

  // Fetch pass types for the current course (used for preview fallback)
  const { data: passTypesData } = useFetch<ApiResponse<PassTypeData[]>>('/api/me/pass-types', {
    lazy: true
  })

  // Fetch assignments for the current course
  const {
    data: assignmentsData,
    status: assignmentsStatus,
    refresh: refreshAssignments
  } = useFetch<ApiResponse<AssignmentRow[]>>('/api/me/assignments')

  // Fetch redemptions for the current course
  const {
    data: redemptionsData,
    status: redemptionsStatus,
    refresh: refreshRedemptions
  } = useFetch<ApiResponse<RedemptionRow[]>>('/api/me/redemptions')

  // Fetch current enrollment for courseId
  const { data: currentEnrollmentData } = useCurrentEnrollment({ immediate: true })
  const courseId = computed(() => currentEnrollmentData.value?.data?.courseId || '')

  // Fetch GTA interview reservations for the student in this course
  const gtaReservationsUrl = computed(() =>
    courseId.value ? `/api/me/courses/${courseId.value}/interview-reservations` : null
  )

  const { data: gtaReservationsData, refresh: refreshGtaReservations } = useFetch<
    ApiResponse<any[]>
  >(gtaReservationsUrl, {
    lazy: true
  })

  const gtaReservations = computed<any[]>(() => gtaReservationsData.value?.data || [])

  const nextUpcomingGtaReservation = computed<any | null>(() => {
    const now = new Date()
    const active = gtaReservations.value.filter(
      (r) => (r.status === 'SCHEDULED' || r.status === 'CHECKED_IN') && new Date(r.endTime) >= now
    )
    if (!active.length) return null
    return active.sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    )[0]
  })

  const getGtaReservationForAssignment = (assignmentId: string): any | undefined => {
    const active = gtaReservations.value.find(
      (r) =>
        r.assignmentId === assignmentId && (r.status === 'SCHEDULED' || r.status === 'CHECKED_IN')
    )
    if (active) return active

    const completed = gtaReservations.value.find(
      (r) =>
        r.assignmentId === assignmentId && (r.status === 'COMPLETED' || r.status === 'CHECKED_OUT')
    )
    if (completed) return completed

    return gtaReservations.value.find(
      (r) => r.assignmentId === assignmentId && (r.status === 'MISSED' || r.status === 'CANCELLED')
    )
  }

  // Effective pass pools: use student pass pools if available; otherwise use course pass types with initial balances in preview
  const effectivePassPools = computed<SimplePassPool[]>(() => {
    if (passPools.value?.data && passPools.value.data.length > 0) {
      return passPools.value.data
    }
    if (passTypesData.value?.data) {
      return passTypesData.value.data.map((pt) => ({
        id: pt.id,
        name: pt.name,
        balance: pt.initialBalance,
        hoursPerPass: pt.hoursPerPass
      }))
    }
    return []
  })

  const redeemPass = async (assignmentId: string, passTypeId: string) => {
    if (isPreview) {
      toast.add({
        title: 'Redemption Simulated',
        description: 'Pass redemption confirmed in preview mode. No live tokens were deducted.',
        color: 'success'
      })
      return { data: { success: true }, error: null }
    }

    const { data, error } = await useFetch('/api/me/redemptions', {
      method: 'POST',
      body: { assignmentId, passTypeId }
    })

    if (!error.value) {
      // Refresh data after successful redemption
      await Promise.all([refreshAssignments(), refreshRedemptions(), refreshPassPools()])
    }

    return { data, error }
  }

  const filteredAssignments = computed(() => {
    if (!assignmentsData.value?.data) return []

    return filterStudentAssignments({
      assignments: assignmentsData.value.data,
      redemptions: redemptionsData.value?.data || [],
      getCbtfReservation: getReservationForAssignment,
      getGtaReservation: getGtaReservationForAssignment
    })
  })

  // Modal & Selection State
  const showRedemptionModal = ref(false)
  const selectedAssignment = ref<AssignmentRow | null>(null)
  const selectedPassType = ref<any>(null)
  const selectedPassHours = ref(24)
  const redemptionLoading = ref(false)

  // CBTF Modal & Selection State
  const showCbtfModal = ref(false)
  const selectedCbtfAssignment = ref<AssignmentRow | null>(null)
  const selectedCbtfReservation = computed(() => {
    if (!selectedCbtfAssignment.value) return null
    const res = getReservationForAssignment(selectedCbtfAssignment.value.id)
    if (res && res.status !== 'CHECKED_OUT' && res.status !== 'COMPLETED') {
      return res
    }
    return null
  })

  const openCbtfModal = (assignment: AssignmentRow) => {
    selectedCbtfAssignment.value = assignment
    showCbtfModal.value = true
  }

  // GTA Interview Modal & Selection State
  const showGtaModal = ref(false)
  const selectedGtaAssignment = ref<AssignmentRow | null>(null)
  const selectedGtaReservation = computed(() => {
    if (!selectedGtaAssignment.value) return null
    const res = getGtaReservationForAssignment(selectedGtaAssignment.value.id)
    if (res && (res.status === 'COMPLETED' || res.status === 'CHECKED_OUT')) {
      const completionTime = res.checkedOutAt || res.updatedAt || res.startTime
      const eligibleRedemption = redemptionsData.value?.data?.find(
        (r: any) =>
          (r.assignmentId === selectedGtaAssignment.value!.id ||
            r.assignmentTitle === selectedGtaAssignment.value!.title) &&
          !r.extensionOnly &&
          (!completionTime || new Date(r.createdAt) >= new Date(completionTime))
      )
      if (eligibleRedemption) {
        return null
      }
    }
    return res || null
  })

  const openGtaModal = (assignment: AssignmentRow) => {
    selectedGtaAssignment.value = assignment
    showGtaModal.value = true
  }

  const selectedLatestRedemption = computed(() => {
    if (!selectedAssignment.value || !redemptionsData.value?.data) return null
    return (
      redemptionsData.value.data.find(
        (r: any) => r.assignmentTitle === selectedAssignment.value?.title
      ) || null
    )
  })

  const handleRedeemClick = (assignment: AssignmentRow, passType: { id: string; name: string }) => {
    const pool = effectivePassPools.value.find((p) => p.name === passType.name)
    if (!pool || pool.balance <= 0) return

    const fullPassType = assignment.eligiblePassTypes?.find((pt) => pt.id === passType.id) || {
      id: passType.id,
      name: passType.name,
      hoursPerPass: pool.hoursPerPass || 0,
      extensionOnly: false,
      minDaysPastDue: null,
      maxDaysPastDue: null
    }

    selectedAssignment.value = assignment
    selectedPassType.value = {
      ...fullPassType,
      balance: pool.balance,
      hoursPerPass: fullPassType.hoursPerPass || pool.hoursPerPass || 0
    }
    selectedPassHours.value = selectedPassType.value.hoursPerPass || 0
    showRedemptionModal.value = true
  }

  const handleConfirmRedemption = async () => {
    if (!selectedAssignment.value || !selectedPassType.value) return

    redemptionLoading.value = true
    try {
      const { error } = await redeemPass(selectedAssignment.value.id, selectedPassType.value.id)

      if (!error.value) {
        showRedemptionModal.value = false
        toast.add({
          title: 'Pass Redeemed',
          description: `Successfully applied ${selectedPassType.value.name} to ${selectedAssignment.value.title}.`,
          color: 'success'
        })
      } else {
        toast.add({
          title: 'Redemption Failed',
          description: error.value.data?.message || error.value.message || 'Could not redeem pass.',
          color: 'error'
        })
      }
    } finally {
      redemptionLoading.value = false
    }
  }

  const dateCellRenderer =
    (key: string) =>
    ({ row }: { row: any }) => {
      return formatDate(row.getValue(key)) || '—'
    }

  const assignmentColumns = createStudentAssignmentColumns({
    interactive: true,
    redemptions: () => redemptionsData.value?.data || [],
    passPools: () => effectivePassPools.value,
    getCbtfReservation: getReservationForAssignment,
    getGtaReservation: getGtaReservationForAssignment,
    onRedeemClick: handleRedeemClick,
    onCbtfClick: openCbtfModal,
    onGtaClick: openGtaModal
  })

  return {
    passPools: effectivePassPools,
    refreshPassPools,
    assignmentsData,
    assignmentsStatus,
    filteredAssignments,
    refreshAssignments,
    redemptionsData,
    redemptionsStatus,
    refreshRedemptions,
    redeemPass,

    // Modal & Table State
    showRedemptionModal,
    selectedAssignment,
    selectedPassType,
    selectedPassHours,
    selectedLatestRedemption,
    redemptionLoading,
    handleConfirmRedemption,
    assignmentColumns,
    dateCellRenderer,

    // CBTF State
    showCbtfModal,
    selectedCbtfAssignment,
    selectedCbtfReservation,
    openCbtfModal,
    nextUpcomingReservation,
    refreshCbtfReservations,

    // GTA Interview State
    courseId,
    showGtaModal,
    selectedGtaAssignment,
    selectedGtaReservation,
    nextUpcomingGtaReservation,
    openGtaModal,
    refreshGtaReservations
  }
}

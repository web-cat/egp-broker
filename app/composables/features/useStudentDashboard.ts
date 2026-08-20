import type { SimplePassPool, RedemptionRow, PassTypeData } from '@@/shared/models/pass'
import type { ApiResponse } from '@@/shared/types/api'
import type { AssignmentRow } from '@@/shared/models/assignment'

export const useStudentDashboard = (isPreview = false) => {
  const toast = useToast()

  // Fetch pass pools for the current course
  const { data: passPools } = useFetch<ApiResponse<SimplePassPool[]>>('/api/me/pass-pools')

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
      await Promise.all([refreshAssignments(), refreshRedemptions()])
    }

    return { data, error }
  }

  const filteredAssignments = computed(() => {
    if (!assignmentsData.value?.data) return []

    const now = new Date()

    return assignmentsData.value.data
      .filter((a) => {
        // 0. Availability check: Hide if not yet available
        if (a.availableFrom && new Date(a.availableFrom) > now) return false

        const { dueDate, acceptUntil, eligibleUntil, eligiblePassTypeNames } = a

        // 1. Implicit Infinite: explicit eligibility but no cutoff date => Always Eligible
        const hasPassTypes = eligiblePassTypeNames && eligiblePassTypeNames.length > 0
        if (hasPassTypes && !eligibleUntil) return true

        // 2. Max Date Logic
        const dates = []
        if (dueDate) dates.push(new Date(dueDate))
        if (acceptUntil) dates.push(new Date(acceptUntil))
        if (eligibleUntil) dates.push(new Date(eligibleUntil))

        // If all dates are missing, treat as inactive/hidden (unless caught by implicit infinite above)
        if (dates.length === 0) return false

        // Calculate max date
        const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())))

        // Keep if max date is in the future
        return maxDate > now
      })
      .sort((a, b) => {
        // Priority 1: Eligible for redemption first
        const aEligible = (a.eligiblePassTypeNames?.length ?? 0) > 0
        const bEligible = (b.eligiblePassTypeNames?.length ?? 0) > 0

        if (aEligible && !bEligible) return -1
        if (!aEligible && bEligible) return 1

        // Priority 2: Due Date Ascending (Nulls last)
        if (!a.dueDate) return 1
        if (!b.dueDate) return -1

        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      })
      .map((a) => ({
        ...a,
        highlight: (a.eligiblePassTypeNames?.length ?? 0) > 0
      }))
  })

  // Modal & Selection State
  const showRedemptionModal = ref(false)
  const selectedAssignment = ref<AssignmentRow | null>(null)
  const selectedPassType = ref<{ id: string; name: string } | null>(null)
  const selectedPassHours = ref(24)
  const redemptionLoading = ref(false)

  const handleRedeemClick = (assignment: AssignmentRow, passType: { id: string; name: string }) => {
    const pool = effectivePassPools.value.find((p) => p.name === passType.name)
    if (!pool || pool.balance <= 0) return

    selectedAssignment.value = assignment
    selectedPassType.value = passType
    selectedPassHours.value = pool.hoursPerPass || 0
    showRedemptionModal.value = true
  }

  const handleConfirmRedemption = async () => {
    if (!selectedAssignment.value || !selectedPassType.value) return

    redemptionLoading.value = true
    try {
      await redeemPass(selectedAssignment.value.id, selectedPassType.value.id)
      showRedemptionModal.value = false
    } finally {
      redemptionLoading.value = false
    }
  }

  const dateCellRenderer =
    (key: string) =>
    ({ row }: { row: any }) => {
      return formatDate(row.getValue(key)) || '—'
    }

  const assignmentColumns: any[] = [
    {
      accessorKey: 'title',
      header: 'Title',
      cell: ({ row }: { row: any }) => {
        const isEligible = (row.original.eligiblePassTypeNames?.length ?? 0) > 0
        return h(
          'span',
          {
            class: isEligible
              ? 'font-bold text-gray-900 dark:text-white'
              : 'text-gray-500 dark:text-gray-400'
          },
          row.getValue('title') || '—'
        )
      }
    },
    {
      accessorKey: 'eligiblePassTypes',
      header: 'Eligible Pass Types',
      cell: ({ row }: { row: any }) => {
        const types = row.original.eligiblePassTypes || []
        if (!types.length) return '—'

        return h(
          'div',
          { class: 'flex flex-wrap gap-3' },
          types.map((pt: any) => {
            const pool = effectivePassPools.value.find((p) => p.name === pt.name)
            const hasBalance = (pool?.balance ?? 0) > 0

            return h(
              'button',
              {
                class: [
                  'flex items-center gap-1.5 font-medium text-sm transition-colors',
                  hasBalance
                    ? 'text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 cursor-pointer'
                    : 'text-gray-400 dark:text-gray-500 cursor-not-allowed opacity-50'
                ],
                disabled: !hasBalance,
                onClick: (e: MouseEvent) => {
                  e.stopPropagation()
                  handleRedeemClick(row.original, pt)
                }
              },
              [h(resolveComponent('UIcon'), { name: 'i-lucide-ticket', class: 'w-4 h-4' }), pt.name]
            )
          })
        )
      }
    },
    {
      accessorKey: 'dueDate',
      header: 'Due Date',
      cell: ({ row }: { row: any }) => {
        const isEligible = (row.original.eligiblePassTypeNames?.length ?? 0) > 0
        const content = formatDate(row.getValue('dueDate')) || '—'
        return h('span', { class: isEligible ? '' : 'text-gray-400 dark:text-gray-500' }, content)
      }
    },
    {
      accessorKey: 'availableFrom',
      header: 'Available From',
      cell: ({ row }: { row: any }) => {
        const isEligible = (row.original.eligiblePassTypeNames?.length ?? 0) > 0
        const content = formatDate(row.getValue('availableFrom')) || '—'
        return h('span', { class: isEligible ? '' : 'text-gray-400 dark:text-gray-500' }, content)
      }
    }
  ]

  return {
    passPools: effectivePassPools,
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
    redemptionLoading,
    handleConfirmRedemption,
    assignmentColumns,
    dateCellRenderer
  }
}

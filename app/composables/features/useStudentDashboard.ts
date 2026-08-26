import type { SimplePassPool, RedemptionRow, PassTypeData } from '@@/shared/models/pass'
import type { ApiResponse } from '@@/shared/types/api'
import type { AssignmentRow } from '@@/shared/models/assignment'
import { calculatePassExtension } from '@@/shared/utils/extension'

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
        // 0. Published check: Hide if unpublished
        if (a.published === false) return false

        // 1. Only show assignments where passes can be used
        const hasPassTypes =
          (a.eligiblePassTypes && a.eligiblePassTypes.length > 0) ||
          (a.eligiblePassTypeNames && a.eligiblePassTypeNames.length > 0)
        if (!hasPassTypes) return false

        // 2. Availability check: Hide if not yet unlocked
        if (a.availableFrom && new Date(a.availableFrom) > now) return false

        // 3. Check if there is an active extension currently in progress
        const latestRedemption = redemptionsData.value?.data?.find(
          (r: any) => r.assignmentTitle === a.title
        )
        if (latestRedemption?.dueDate && new Date(latestRedemption.dueDate) > now) {
          return true
        }

        // 4. Keep if upcoming due date is in the future
        if (a.dueDate && new Date(a.dueDate) > now) {
          return true
        }

        // 5. If past due, keep only if at least one pass type is still within its redemption window
        const passTypes = a.eligiblePassTypes || []
        if (passTypes.length > 0) {
          const hasOpenWindow = passTypes.some((pt) => {
            if (pt.maxDaysPastDue !== null && pt.maxDaysPastDue !== undefined) {
              const origDue = a.dueDate ? new Date(a.dueDate) : now
              const maxAllowed = new Date(
                origDue.getTime() + pt.maxDaysPastDue * 24 * 60 * 60 * 1000
              )
              return now <= maxAllowed
            }
            if (a.acceptUntil) return new Date(a.acceptUntil) > now
            if (a.eligibleUntil) return new Date(a.eligibleUntil) > now
            return true
          })
          if (hasOpenWindow) return true
        }

        return false
      })
      .sort((a, b) => {
        // Keep assignments in chronological order by due date (earliest due date first, nulls last)
        if (!a.dueDate && !b.dueDate) return (a.title || '').localeCompare(b.title || '')
        if (!a.dueDate) return 1
        if (!b.dueDate) return -1
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      })
      .map((a) => ({
        ...a,
        highlight: true
      }))
  })

  // Modal & Selection State
  const showRedemptionModal = ref(false)
  const selectedAssignment = ref<AssignmentRow | null>(null)
  const selectedPassType = ref<any>(null)
  const selectedPassHours = ref(24)
  const redemptionLoading = ref(false)

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

  const assignmentColumns: any[] = [
    {
      accessorKey: 'title',
      header: 'Title',
      cell: ({ row }: { row: any }) => {
        return h(
          'span',
          { class: 'font-bold text-gray-900 dark:text-white' },
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

        const now = new Date()
        const latestRedemption = redemptionsData.value?.data?.find(
          (r: any) => r.assignmentTitle === row.original.title
        )

        return h(
          'div',
          { class: 'flex flex-wrap gap-2.5 items-center' },
          types.map((pt: any) => {
            const pool = effectivePassPools.value.find((p) => p.name === pt.name)
            const balance = pool?.balance ?? 0
            const hasBalance = balance > 0

            const ext = calculatePassExtension({
              assignment: row.original,
              passType: {
                extensionOnly: pt.extensionOnly ?? false,
                hoursPerPass: pt.hoursPerPass || 24,
                minDaysPastDue: pt.minDaysPastDue,
                maxDaysPastDue: pt.maxDaysPastDue
              },
              latestRedemption,
              now
            })

            // State 1: Active extension currently in progress
            if (latestRedemption?.dueDate && now <= new Date(latestRedemption.dueDate)) {
              return h(
                'span',
                {
                  class:
                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300 border border-green-200 dark:border-green-800'
                },
                [
                  h(resolveComponent('UIcon'), { name: 'i-lucide-clock', class: 'w-3.5 h-3.5' }),
                  `Active: Due ${formatDate(latestRedemption.dueDate)}`
                ]
              )
            }

            // State 2: Redemption window closed / ineligible
            if (!ext.isEligible) {
              return h(
                'span',
                {
                  class:
                    'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700 cursor-not-allowed'
                },
                [
                  h(resolveComponent('UIcon'), { name: 'i-lucide-ban', class: 'w-3.5 h-3.5' }),
                  pt.name
                ]
              )
            }

            // State 3: Zero Balance
            if (!hasBalance) {
              return h(
                'button',
                {
                  class:
                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-neutral-50 text-neutral-400 dark:bg-neutral-900 dark:text-neutral-500 border border-neutral-200 dark:border-neutral-800 cursor-not-allowed opacity-60',
                  disabled: true
                },
                [
                  h(resolveComponent('UIcon'), { name: 'i-lucide-ticket', class: 'w-3.5 h-3.5' }),
                  `${pt.name} (0 left)`
                ]
              )
            }

            // State 4: Available to redeem
            return h(
              'button',
              {
                class:
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-primary-50 text-primary-700 dark:bg-primary-950/50 dark:text-primary-300 border border-primary-200 dark:border-primary-800 hover:bg-primary-100 dark:hover:bg-primary-900 transition-colors cursor-pointer',
                onClick: (e: MouseEvent) => {
                  e.stopPropagation()
                  handleRedeemClick(row.original, pt)
                }
              },
              [
                h(resolveComponent('UIcon'), { name: 'i-lucide-ticket', class: 'w-3.5 h-3.5' }),
                pt.name
              ]
            )
          })
        )
      }
    },
    {
      accessorKey: 'dueDate',
      header: 'Due Date',
      cell: ({ row }: { row: any }) => {
        const content = formatDate(row.getValue('dueDate')) || '—'
        return h('span', { class: 'text-gray-900 dark:text-white font-medium' }, content)
      }
    },
    {
      accessorKey: 'availableFrom',
      header: 'Available From',
      cell: ({ row }: { row: any }) => {
        const content = formatDate(row.getValue('availableFrom')) || '—'
        return h('span', { class: 'text-gray-500 dark:text-gray-400' }, content)
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
    selectedLatestRedemption,
    redemptionLoading,
    handleConfirmRedemption,
    assignmentColumns,
    dateCellRenderer
  }
}

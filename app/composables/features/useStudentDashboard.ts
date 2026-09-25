import type { SimplePassPool, RedemptionRow, PassTypeData } from '@@/shared/models/pass'
import type { ApiResponse } from '@@/shared/types/api'
import type { AssignmentRow } from '@@/shared/models/assignment'
import { calculatePassExtension } from '@@/shared/utils/extension'
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

    const now = new Date()

    return assignmentsData.value.data
      .filter((a) => {
        // 0. Published check: Hide if unpublished
        if (a.published === false) return false

        // 1. Availability check: Hide if not yet unlocked
        if (a.availableFrom && new Date(a.availableFrom) > now) return false

        // 2. Actionability check:
        // Must either be schedulable (CBTF/GTA) or have eligible pass types
        const hasPassTypes =
          (a.eligiblePassTypes && a.eligiblePassTypes.length > 0) ||
          (a.eligiblePassTypeNames && a.eligiblePassTypeNames.length > 0)
        if (!a.isSchedulable && !a.hasInterviews && !hasPassTypes) return false

        // 3. Active reservation check: Keep visible if student has an upcoming/active reservation
        const cbtfRes = getReservationForAssignment?.(a.id)
        if (
          cbtfRes &&
          ['SCHEDULED', 'CHECKED_IN'].includes(cbtfRes.status) &&
          new Date(cbtfRes.endTime) >= now
        ) {
          return true
        }

        const gtaRes = getGtaReservationForAssignment?.(a.id)
        if (
          gtaRes &&
          ['SCHEDULED', 'CHECKED_IN'].includes(gtaRes.status) &&
          new Date(gtaRes.endTime) >= now
        ) {
          return true
        }

        // 4. Active extension check: Keep visible if an extension is currently active
        const latestRedemption = redemptionsData.value?.data?.find(
          (r: any) => r.assignmentTitle === a.title
        )
        if (latestRedemption?.acceptUntil && new Date(latestRedemption.acceptUntil) > now) {
          return true
        }
        if (latestRedemption?.dueDate && new Date(latestRedemption.dueDate) > now) {
          return true
        }

        // 5. Initial window check:
        // Keep visible if not yet past accept until, due date, or scheduling windows
        if (a.acceptUntil && new Date(a.acceptUntil) > now) {
          return true
        }
        if (a.dueDate && new Date(a.dueDate) > now) {
          return true
        }
        if (a.isSchedulable && a.scheduleWindowEnd && new Date(a.scheduleWindowEnd) > now) {
          return true
        }
        if (a.hasInterviews && a.interviewWindowEnd && new Date(a.interviewWindowEnd) > now) {
          return true
        }

        // 6. Pass redemption window check:
        // If past accept until and due date, keep only if at least one pass type is still within its redemption window
        const passTypes = a.eligiblePassTypes || []
        if (passTypes.length > 0) {
          const hasOpenWindow = passTypes.some((pt) => {
            if (pt.maxDaysPastDue !== null && pt.maxDaysPastDue !== undefined) {
              const origDue = a.dueDate
                ? new Date(a.dueDate)
                : a.acceptUntil
                  ? new Date(a.acceptUntil)
                  : null
              if (!origDue) return false
              const maxAllowed = new Date(
                origDue.getTime() + pt.maxDaysPastDue * 24 * 60 * 60 * 1000
              )
              return now <= maxAllowed
            }
            if (a.eligibleUntil) return new Date(a.eligibleUntil) > now
            // If maxDaysPastDue is null/undefined and no eligibleUntil cutoff is specified,
            // it means there is no expiration limit for pass redemption
            return true
          })
          if (hasOpenWindow) return true
        } else if (a.eligibleUntil && new Date(a.eligibleUntil) > now) {
          return true
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
            const pool = effectivePassPools.value.find((p) => p.id === pt.id || p.name === pt.name)
            const balance = pool?.balance ?? 0
            const hasBalance = balance > 0

            const assignmentRedemptions =
              redemptionsData.value?.data?.filter(
                (r: any) => r.assignmentTitle === row.original.title
              ) || []
            const priorRedemptionsCount = assignmentRedemptions.length

            const ext = calculatePassExtension({
              assignment: row.original,
              passType: {
                extensionOnly: pt.extensionOnly ?? false,
                hoursPerPass: pt.hoursPerPass || 24,
                minDaysPastDue: pt.minDaysPastDue,
                maxDaysPastDue: pt.maxDaysPastDue,
                maxRedemptionsPerAssignment: pt.maxRedemptionsPerAssignment
              },
              latestRedemption,
              priorRedemptionsCount,
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
    },
    {
      accessorKey: 'cbtfSlot',
      header: 'Testing Center',
      cell: ({ row }: { row: any }) => {
        if (!row.original.isSchedulable) return '—'

        const res = getReservationForAssignment(row.original.id)

        if (!res) {
          return h(
            'button',
            {
              type: 'button',
              class:
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-primary-50 text-primary-700 dark:bg-primary-950/50 dark:text-primary-300 border border-primary-200 dark:border-primary-800 hover:bg-primary-100 dark:hover:bg-primary-900 transition-colors cursor-pointer',
              onClick: (e: MouseEvent) => {
                e.stopPropagation()
                openCbtfModal(row.original)
              }
            },
            [
              h(resolveComponent('UIcon'), {
                name: 'i-lucide-calendar-plus',
                class: 'w-3.5 h-3.5'
              }),
              'Schedule Exam'
            ]
          )
        }

        if (res.status === 'SCHEDULED') {
          return h(
            'button',
            {
              type: 'button',
              class:
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300 border border-green-200 dark:border-green-800 hover:bg-green-100 transition-colors cursor-pointer',
              onClick: (e: MouseEvent) => {
                e.stopPropagation()
                openCbtfModal(row.original)
              }
            },
            [
              h(resolveComponent('UIcon'), {
                name: 'i-lucide-calendar-check',
                class: 'w-3.5 h-3.5'
              }),
              `Seat #${res.seatNumber}`
            ]
          )
        }

        if (res.status === 'CHECKED_IN') {
          return h(
            'span',
            {
              class:
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
            },
            [
              h(resolveComponent('UIcon'), { name: 'i-lucide-user-check', class: 'w-3.5 h-3.5' }),
              `In Exam (Seat #${res.seatNumber})`
            ]
          )
        }

        if (res.status === 'MISSED') {
          return h(
            'button',
            {
              type: 'button',
              class:
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800 hover:bg-red-100 transition-colors cursor-pointer',
              onClick: (e: MouseEvent) => {
                e.stopPropagation()
                openCbtfModal(row.original)
              }
            },
            [
              h(resolveComponent('UIcon'), { name: 'i-lucide-alert-circle', class: 'w-3.5 h-3.5' }),
              'Missed (Reschedule)'
            ]
          )
        }

        if (res.status === 'CANCELLED') {
          return h(
            'button',
            {
              type: 'button',
              class:
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 transition-colors cursor-pointer',
              onClick: (e: MouseEvent) => {
                e.stopPropagation()
                openCbtfModal(row.original)
              }
            },
            [
              h(resolveComponent('UIcon'), { name: 'i-lucide-calendar-x', class: 'w-3.5 h-3.5' }),
              'Cancelled (Reschedule)'
            ]
          )
        }

        if (res.status === 'CHECKED_OUT' || res.status === 'COMPLETED') {
          // Check if student has redeemed a pass for this assignment (e.g. retake pass)
          const latestRedemption = redemptionsData.value?.data?.find(
            (r: any) => r.assignmentTitle === row.original.title
          )
          const isRetakeEligible =
            latestRedemption &&
            (!res.checkedOutAt ||
              new Date(latestRedemption.createdAt) >= new Date(res.checkedOutAt))

          if (isRetakeEligible) {
            return h(
              'button',
              {
                type: 'button',
                class:
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-primary-50 text-primary-700 dark:bg-primary-950/50 dark:text-primary-300 border border-primary-200 dark:border-primary-800 hover:bg-primary-100 dark:hover:bg-primary-900 transition-colors cursor-pointer',
                onClick: (e: MouseEvent) => {
                  e.stopPropagation()
                  openCbtfModal(row.original)
                }
              },
              [
                h(resolveComponent('UIcon'), {
                  name: 'i-lucide-calendar-plus',
                  class: 'w-3.5 h-3.5'
                }),
                'Schedule Retake'
              ]
            )
          }

          return h(
            'span',
            {
              class:
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
            },
            [
              h(resolveComponent('UIcon'), {
                name: 'i-lucide-check-circle-2',
                class: 'w-3.5 h-3.5'
              }),
              'Completed'
            ]
          )
        }

        return h('span', { class: 'text-xs text-neutral-500 font-medium' }, res.status)
      }
    },
    {
      accessorKey: 'gtaInterviewSlot',
      header: 'GTA Interview',
      cell: ({ row }: { row: any }) => {
        if (!row.original.hasInterviews) return '—'

        const res = getGtaReservationForAssignment(row.original.id)

        if (!res) {
          return h(
            'button',
            {
              type: 'button',
              class:
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-primary-50 text-primary-700 dark:bg-primary-950/50 dark:text-primary-300 border border-primary-200 dark:border-primary-800 hover:bg-primary-100 dark:hover:bg-primary-900 transition-colors cursor-pointer',
              onClick: (e: MouseEvent) => {
                e.stopPropagation()
                openGtaModal(row.original)
              }
            },
            [
              h(resolveComponent('UIcon'), {
                name: 'i-lucide-calendar-plus',
                class: 'w-3.5 h-3.5'
              }),
              'Schedule Interview'
            ]
          )
        }

        if (res.status === 'SCHEDULED') {
          const startTimeStr = new Date(res.startTime).toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit'
          })
          return h(
            'button',
            {
              type: 'button',
              class:
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300 border border-green-200 dark:border-green-800 hover:bg-green-100 transition-colors cursor-pointer',
              onClick: (e: MouseEvent) => {
                e.stopPropagation()
                openGtaModal(row.original)
              }
            },
            [
              h(resolveComponent('UIcon'), {
                name: 'i-lucide-calendar-check',
                class: 'w-3.5 h-3.5'
              }),
              `Scheduled (${startTimeStr})`
            ]
          )
        }

        if (res.status === 'CHECKED_IN') {
          return h(
            'span',
            {
              class:
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
            },
            [
              h(resolveComponent('UIcon'), { name: 'i-lucide-user-check', class: 'w-3.5 h-3.5' }),
              'In Interview'
            ]
          )
        }

        if (res.status === 'COMPLETED' || res.status === 'CHECKED_OUT') {
          // Check if student has redeemed a regular (non-extension) pass for this assignment
          const completionTime = res.checkedOutAt || res.updatedAt || res.startTime
          const eligibleRedemption = redemptionsData.value?.data?.find(
            (r: any) =>
              (r.assignmentId === row.original.id || r.assignmentTitle === row.original.title) &&
              !r.extensionOnly &&
              (!completionTime || new Date(r.createdAt) >= new Date(completionTime))
          )

          if (eligibleRedemption) {
            return h(
              'button',
              {
                type: 'button',
                class:
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-primary-50 text-primary-700 dark:bg-primary-950/50 dark:text-primary-300 border border-primary-200 dark:border-primary-800 hover:bg-primary-100 dark:hover:bg-primary-900 transition-colors cursor-pointer',
                onClick: (e: MouseEvent) => {
                  e.stopPropagation()
                  openGtaModal(row.original)
                }
              },
              [
                h(resolveComponent('UIcon'), {
                  name: 'i-lucide-calendar-plus',
                  class: 'w-3.5 h-3.5'
                }),
                'Schedule Interview'
              ]
            )
          }

          return h(
            'span',
            {
              class:
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
            },
            [
              h(resolveComponent('UIcon'), {
                name: 'i-lucide-check-circle-2',
                class: 'w-3.5 h-3.5'
              }),
              'Completed'
            ]
          )
        }

        if (res.status === 'MISSED') {
          return h(
            'button',
            {
              type: 'button',
              class:
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800 hover:bg-red-100 transition-colors cursor-pointer',
              onClick: (e: MouseEvent) => {
                e.stopPropagation()
                openGtaModal(row.original)
              }
            },
            [
              h(resolveComponent('UIcon'), { name: 'i-lucide-alert-circle', class: 'w-3.5 h-3.5' }),
              'Missed (Reschedule)'
            ]
          )
        }

        if (res.status === 'CANCELLED') {
          return h(
            'button',
            {
              type: 'button',
              class:
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 transition-colors cursor-pointer',
              onClick: (e: MouseEvent) => {
                e.stopPropagation()
                openGtaModal(row.original)
              }
            },
            [
              h(resolveComponent('UIcon'), { name: 'i-lucide-calendar-x', class: 'w-3.5 h-3.5' }),
              'Cancelled (Reschedule)'
            ]
          )
        }

        return h('span', { class: 'text-xs text-neutral-500 font-medium' }, res.status)
      }
    }
  ]

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

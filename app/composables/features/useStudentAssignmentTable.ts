import { h, resolveComponent, toValue, type MaybeRefOrGetter } from 'vue'
import type { AssignmentRow } from '@@/shared/models/assignment'
import { calculatePassExtension } from '@@/shared/utils/extension'
import { formatDate } from '~/utils/date'

export interface CreateStudentAssignmentColumnsOptions {
  interactive?: boolean
  redemptions: MaybeRefOrGetter<any[]>
  passPools: MaybeRefOrGetter<
    { id?: string; name: string; balance: number; hoursPerPass?: number; passTypeId?: string }[]
  >
  getCbtfReservation: (assignmentId: string) => any
  getGtaReservation: (assignmentId: string) => any
  onRedeemClick?: (assignment: AssignmentRow, passType: any) => void
  onCbtfClick?: (assignment: AssignmentRow) => void
  onGtaClick?: (assignment: AssignmentRow) => void
}

export const studentAssignmentRowClass = (row: any) => {
  if (row.original?.highlight) {
    return 'bg-primary-50/50 dark:bg-primary-900/10 border-l-4 border-l-primary-500 dark:border-l-primary-400'
  }
  return 'border-l-4 border-l-transparent opacity-75 hover:opacity-100 transition-opacity'
}

/**
 * Creates the columns for the student assignments table.
 * Shared between the Student Dashboard and the Teacher Student Detail modal.
 * When `interactive` is false, buttons/links are rendered as inactive presentational elements.
 */
export function createStudentAssignmentColumns(
  options: CreateStudentAssignmentColumnsOptions
): any[] {
  const {
    interactive = true,
    redemptions,
    passPools,
    getCbtfReservation,
    getGtaReservation,
    onRedeemClick,
    onCbtfClick,
    onGtaClick
  } = options

  return [
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

        const redemptionsList = toValue(redemptions) || []
        const passPoolsList = toValue(passPools) || []
        const now = new Date()
        const latestRedemption = redemptionsList.find(
          (r: any) =>
            (r.assignmentId && r.assignmentId === row.original.id) ||
            (r.assignmentTitle && r.assignmentTitle === row.original.title)
        )

        return h(
          'div',
          { class: 'flex flex-wrap gap-2.5 items-center' },
          types.map((pt: any) => {
            const pool = passPoolsList.find(
              (p: any) => p.passTypeId === pt.id || p.id === pt.id || p.name === pt.name
            )
            const balance = pool?.balance ?? 0
            const hasBalance = balance > 0

            const assignmentRedemptions = redemptionsList.filter(
              (r: any) =>
                (r.assignmentId && r.assignmentId === row.original.id) ||
                (r.assignmentTitle && r.assignmentTitle === row.original.title)
            )
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
                interactive ? 'button' : 'span',
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
              interactive ? 'button' : 'span',
              {
                class:
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-primary-50 text-primary-700 dark:bg-primary-950/50 dark:text-primary-300 border border-primary-200 dark:border-primary-800' +
                  (interactive
                    ? ' hover:bg-primary-100 dark:hover:bg-primary-900 transition-colors cursor-pointer'
                    : ' cursor-default select-none'),
                ...(interactive
                  ? {
                      onClick: (e: MouseEvent) => {
                        e.stopPropagation()
                        onRedeemClick?.(row.original, pt)
                      }
                    }
                  : {})
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

        const res = getCbtfReservation(row.original.id)

        if (!res) {
          return h(
            interactive ? 'button' : 'span',
            {
              ...(interactive ? { type: 'button' } : {}),
              class:
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-primary-50 text-primary-700 dark:bg-primary-950/50 dark:text-primary-300 border border-primary-200 dark:border-primary-800' +
                (interactive
                  ? ' hover:bg-primary-100 dark:hover:bg-primary-900 transition-colors cursor-pointer'
                  : ' cursor-default select-none'),
              ...(interactive
                ? {
                    onClick: (e: MouseEvent) => {
                      e.stopPropagation()
                      onCbtfClick?.(row.original)
                    }
                  }
                : {})
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
            interactive ? 'button' : 'span',
            {
              ...(interactive ? { type: 'button' } : {}),
              class:
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300 border border-green-200 dark:border-green-800' +
                (interactive
                  ? ' hover:bg-green-100 transition-colors cursor-pointer'
                  : ' cursor-default select-none'),
              ...(interactive
                ? {
                    onClick: (e: MouseEvent) => {
                      e.stopPropagation()
                      onCbtfClick?.(row.original)
                    }
                  }
                : {})
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
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800 cursor-default select-none'
            },
            [
              h(resolveComponent('UIcon'), { name: 'i-lucide-user-check', class: 'w-3.5 h-3.5' }),
              `In Exam (Seat #${res.seatNumber})`
            ]
          )
        }

        if (res.status === 'MISSED') {
          return h(
            interactive ? 'button' : 'span',
            {
              ...(interactive ? { type: 'button' } : {}),
              class:
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800' +
                (interactive
                  ? ' hover:bg-red-100 transition-colors cursor-pointer'
                  : ' cursor-default select-none'),
              ...(interactive
                ? {
                    onClick: (e: MouseEvent) => {
                      e.stopPropagation()
                      onCbtfClick?.(row.original)
                    }
                  }
                : {})
            },
            [
              h(resolveComponent('UIcon'), { name: 'i-lucide-alert-circle', class: 'w-3.5 h-3.5' }),
              'Missed (Reschedule)'
            ]
          )
        }

        if (res.status === 'CANCELLED') {
          return h(
            interactive ? 'button' : 'span',
            {
              ...(interactive ? { type: 'button' } : {}),
              class:
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800' +
                (interactive
                  ? ' hover:bg-amber-100 transition-colors cursor-pointer'
                  : ' cursor-default select-none'),
              ...(interactive
                ? {
                    onClick: (e: MouseEvent) => {
                      e.stopPropagation()
                      onCbtfClick?.(row.original)
                    }
                  }
                : {})
            },
            [
              h(resolveComponent('UIcon'), { name: 'i-lucide-calendar-x', class: 'w-3.5 h-3.5' }),
              'Cancelled (Reschedule)'
            ]
          )
        }

        if (res.status === 'CHECKED_OUT' || res.status === 'COMPLETED') {
          const redemptionsList = toValue(redemptions) || []
          const latestRedemption = redemptionsList.find(
            (r: any) =>
              (r.assignmentId && r.assignmentId === row.original.id) ||
              (r.assignmentTitle && r.assignmentTitle === row.original.title)
          )
          const resCheckedOutTime = res.checkedOutAt || res.updatedAt || res.startTime
          const redemptionTime = latestRedemption?.createdAt || latestRedemption?.redeemedAt
          const isRetakeEligible =
            latestRedemption &&
            (!resCheckedOutTime ||
              (redemptionTime && new Date(redemptionTime) >= new Date(resCheckedOutTime)))

          if (isRetakeEligible) {
            return h(
              interactive ? 'button' : 'span',
              {
                ...(interactive ? { type: 'button' } : {}),
                class:
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-primary-50 text-primary-700 dark:bg-primary-950/50 dark:text-primary-300 border border-primary-200 dark:border-primary-800' +
                  (interactive
                    ? ' hover:bg-primary-100 dark:hover:bg-primary-900 transition-colors cursor-pointer'
                    : ' cursor-default select-none'),
                ...(interactive
                  ? {
                      onClick: (e: MouseEvent) => {
                        e.stopPropagation()
                        onCbtfClick?.(row.original)
                      }
                    }
                  : {})
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
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 cursor-default select-none'
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
    } as any,
    {
      accessorKey: 'gtaInterviewSlot',
      header: 'GTA Interview',
      cell: ({ row }: { row: any }) => {
        if (!row.original.hasInterviews) return '—'

        const res = getGtaReservation(row.original.id)

        if (!res) {
          return h(
            interactive ? 'button' : 'span',
            {
              ...(interactive ? { type: 'button' } : {}),
              class:
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-primary-50 text-primary-700 dark:bg-primary-950/50 dark:text-primary-300 border border-primary-200 dark:border-primary-800' +
                (interactive
                  ? ' hover:bg-primary-100 dark:hover:bg-primary-900 transition-colors cursor-pointer'
                  : ' cursor-default select-none'),
              ...(interactive
                ? {
                    onClick: (e: MouseEvent) => {
                      e.stopPropagation()
                      onGtaClick?.(row.original)
                    }
                  }
                : {})
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
            interactive ? 'button' : 'span',
            {
              ...(interactive ? { type: 'button' } : {}),
              class:
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300 border border-green-200 dark:border-green-800' +
                (interactive
                  ? ' hover:bg-green-100 transition-colors cursor-pointer'
                  : ' cursor-default select-none'),
              ...(interactive
                ? {
                    onClick: (e: MouseEvent) => {
                      e.stopPropagation()
                      onGtaClick?.(row.original)
                    }
                  }
                : {})
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
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800 cursor-default select-none'
            },
            [
              h(resolveComponent('UIcon'), { name: 'i-lucide-user-check', class: 'w-3.5 h-3.5' }),
              'In Interview'
            ]
          )
        }

        if (res.status === 'COMPLETED' || res.status === 'CHECKED_OUT') {
          const redemptionsList = toValue(redemptions) || []
          const completionTime = res.checkedOutAt || res.updatedAt || res.startTime
          const eligibleRedemption = redemptionsList.find((r: any) => {
            const matchesAssignment =
              (r.assignmentId && r.assignmentId === row.original.id) ||
              (r.assignmentTitle && r.assignmentTitle === row.original.title)
            const isNotExtensionOnly = !r.extensionOnly
            const redemptionTime = r.createdAt || r.redeemedAt
            const isAfterCompletion =
              !completionTime ||
              (redemptionTime && new Date(redemptionTime) >= new Date(completionTime))
            return matchesAssignment && isNotExtensionOnly && isAfterCompletion
          })

          if (eligibleRedemption) {
            return h(
              interactive ? 'button' : 'span',
              {
                ...(interactive ? { type: 'button' } : {}),
                class:
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-primary-50 text-primary-700 dark:bg-primary-950/50 dark:text-primary-300 border border-primary-200 dark:border-primary-800' +
                  (interactive
                    ? ' hover:bg-primary-100 dark:hover:bg-primary-900 transition-colors cursor-pointer'
                    : ' cursor-default select-none'),
                ...(interactive
                  ? {
                      onClick: (e: MouseEvent) => {
                        e.stopPropagation()
                        onGtaClick?.(row.original)
                      }
                    }
                  : {})
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
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 cursor-default select-none'
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
            interactive ? 'button' : 'span',
            {
              ...(interactive ? { type: 'button' } : {}),
              class:
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800' +
                (interactive
                  ? ' hover:bg-red-100 transition-colors cursor-pointer'
                  : ' cursor-default select-none'),
              ...(interactive
                ? {
                    onClick: (e: MouseEvent) => {
                      e.stopPropagation()
                      onGtaClick?.(row.original)
                    }
                  }
                : {})
            },
            [
              h(resolveComponent('UIcon'), { name: 'i-lucide-alert-circle', class: 'w-3.5 h-3.5' }),
              'Missed (Reschedule)'
            ]
          )
        }

        if (res.status === 'CANCELLED') {
          return h(
            interactive ? 'button' : 'span',
            {
              ...(interactive ? { type: 'button' } : {}),
              class:
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800' +
                (interactive
                  ? ' hover:bg-amber-100 transition-colors cursor-pointer'
                  : ' cursor-default select-none'),
              ...(interactive
                ? {
                    onClick: (e: MouseEvent) => {
                      e.stopPropagation()
                      onGtaClick?.(row.original)
                    }
                  }
                : {})
            },
            [
              h(resolveComponent('UIcon'), { name: 'i-lucide-calendar-x', class: 'w-3.5 h-3.5' }),
              'Cancelled (Reschedule)'
            ]
          )
        }

        return h('span', { class: 'text-xs text-neutral-500 font-medium' }, res.status)
      }
    } as any
  ]
}

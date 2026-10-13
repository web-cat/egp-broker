import { h, resolveComponent } from 'vue'
import type { ColumnDef } from '@tanstack/vue-table'
import type {
  StudentRedemptionHistoryRow,
  StudentInterviewHistoryRow
} from '@@/shared/models/teacher'
import { formatDate } from '~/utils/date'

export function createStudentRedemptionLogColumns(): ColumnDef<StudentRedemptionHistoryRow, any>[] {
  return [
    {
      accessorKey: 'assignmentTitle',
      header: 'Assignment',
      cell: ({ row }) => {
        return h(
          'span',
          { class: 'font-medium text-neutral-900 dark:text-neutral-100' },
          row.getValue('assignmentTitle') || '—'
        )
      }
    },
    {
      accessorKey: 'passTypeName',
      header: 'Pass Type',
      cell: ({ row }) => {
        return h(
          'span',
          {
            class:
              'inline-flex items-center gap-1 font-medium text-primary-600 dark:text-primary-400'
          },
          [
            h(resolveComponent('UIcon'), { name: 'i-lucide-ticket', class: 'w-3.5 h-3.5' }),
            row.getValue('passTypeName')
          ]
        )
      }
    },
    {
      accessorKey: 'cost',
      header: 'Cost',
      cell: ({ row }) => `${row.getValue('cost')} pass(es)`
    },
    {
      accessorKey: 'redeemedAt',
      header: 'Redeemed',
      cell: ({ row }) => formatDate(row.getValue('redeemedAt')) || '—'
    },
    {
      accessorKey: 'dueDate',
      header: 'New Deadline',
      cell: ({ row }) => formatDate(row.getValue('dueDate')) || '—'
    },
    {
      accessorKey: 'isActive',
      header: 'Status',
      cell: ({ row }) => {
        const active = row.getValue('isActive')
        return h('div', { class: 'flex items-center gap-1.5' }, [
          h('div', {
            class: [
              'w-2 h-2 rounded-full',
              active ? 'bg-green-500' : 'bg-neutral-300 dark:bg-neutral-600'
            ]
          }),
          h(
            'span',
            {
              class: active
                ? 'text-green-600 dark:text-green-400 font-medium text-xs'
                : 'text-neutral-500 text-xs'
            },
            active ? 'Active' : 'Expired'
          )
        ])
      }
    }
  ]
}

export function createStudentInterviewHistoryColumns(): ColumnDef<
  StudentInterviewHistoryRow,
  any
>[] {
  return [
    {
      accessorKey: 'assignmentTitle',
      header: 'Assignment',
      cell: ({ row }) => {
        return h(
          'span',
          { class: 'font-medium text-neutral-900 dark:text-neutral-100' },
          row.getValue('assignmentTitle') || '—'
        )
      }
    },
    {
      accessorKey: 'gtaName',
      header: 'Teaching Assistant',
      cell: ({ row }) => {
        const name = row.getValue('gtaName') || '—'
        const email = row.original.gtaEmail
        return h('div', { class: 'flex flex-col' }, [
          h('span', { class: 'font-medium text-neutral-900 dark:text-neutral-100' }, name),
          email ? h('span', { class: 'text-xs text-neutral-400' }, email) : null
        ])
      }
    },
    {
      accessorKey: 'startTime',
      header: 'Scheduled Time',
      cell: ({ row }) => formatDate(row.getValue('startTime')) || '—'
    },
    {
      accessorKey: 'checkedOutAt',
      header: 'Completed At',
      cell: ({ row }) => formatDate(row.getValue('checkedOutAt')) || '—'
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.getValue('status') as string
        const color = (() => {
          switch (status) {
            case 'COMPLETED':
            case 'CHECKED_OUT':
              return 'success'
            case 'CHECKED_IN':
              return 'primary'
            case 'MISSED':
              return 'error'
            case 'SCHEDULED':
              return 'info'
            default:
              return 'neutral'
          }
        })()

        return h(
          resolveComponent('UBadge'),
          {
            variant: 'subtle',
            color,
            size: 'sm'
          },
          () => status
        )
      }
    }
  ]
}

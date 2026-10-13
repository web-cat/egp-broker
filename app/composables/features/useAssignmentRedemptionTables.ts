import { h, resolveComponent } from 'vue'
import type { ColumnDef } from '@tanstack/vue-table'
import type { AssignmentRedemptionRow } from '@@/shared/models/teacher'
import type { AssignmentOverrideDetails } from '@@/shared/models/override'
import { formatDate } from '~/utils/date'

export function createAssignmentOverrideColumns(): ColumnDef<AssignmentOverrideDetails, any>[] {
  return [
    {
      accessorKey: 'targetName',
      header: 'Target / Scope',
      cell: ({ row }) => {
        const isSection = row.original.type === 'SECTION'
        return h('div', { class: 'flex items-center gap-2' }, [
          h(resolveComponent('UIcon'), {
            name: isSection ? 'i-lucide-users' : 'i-lucide-user',
            class: 'w-4 h-4 text-neutral-500'
          }),
          h(
            'span',
            { class: 'font-medium text-neutral-900 dark:text-neutral-100' },
            row.getValue('targetName')
          )
        ])
      }
    },
    {
      accessorKey: 'title',
      header: 'Override Title',
      cell: ({ row }) => row.getValue('title') || '—'
    },
    {
      accessorKey: 'availableFrom',
      header: 'Available From',
      cell: ({ row }) => formatDate(row.getValue('availableFrom')) || '—'
    },
    {
      accessorKey: 'dueDate',
      header: 'Due Date',
      cell: ({ row }) => {
        const formatted = formatDate(row.getValue('dueDate')) || '—'
        return h(
          'span',
          { class: 'font-semibold text-neutral-900 dark:text-neutral-100' },
          formatted
        )
      }
    },
    {
      accessorKey: 'acceptUntil',
      header: 'Accept Until',
      cell: ({ row }) => formatDate(row.getValue('acceptUntil')) || '—'
    }
  ]
}

export function createAssignmentRedemptionColumns(): ColumnDef<AssignmentRedemptionRow, any>[] {
  return [
    {
      accessorKey: 'studentName',
      header: 'Student',
      cell: ({ row }) => {
        const name = row.getValue('studentName') || '—'
        const email = row.original.studentEmail
        return h('div', { class: 'flex flex-col' }, [
          h('span', { class: 'font-medium text-neutral-900 dark:text-neutral-100' }, name),
          email
            ? h('span', { class: 'text-xs text-neutral-500 dark:text-neutral-400' }, email)
            : null
        ])
      }
    },
    {
      accessorKey: 'sectionName',
      header: 'Section',
      cell: ({ row }) => row.getValue('sectionName') || '—'
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
      cell: ({ row }) => formatDate(row.original.acceptUntil || row.original.dueDate) || '—'
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

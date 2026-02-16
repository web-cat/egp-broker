import { h } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import BaseRowActions from '~/components/base/BaseRowActions.vue'

/**
 * Create a table column cell renderer that displays a numeric count as a
 * colored UBadge (colored when > 0, neutral when 0).
 *
 * @param key - The accessor key to read from the row
 * @param color - Badge color when count > 0 (default: 'success')
 */
export function countBadgeCell<T extends object>(
  key: string,
  color: string = 'success'
): TableColumn<T>['cell'] {
  return ({ row }) => {
    const count = row.getValue(key) as number
    return h('UBadge', { variant: 'subtle', color: count > 0 ? color : 'neutral' }, String(count))
  }
}

/**
 * Create a standard actions column definition for admin tables.
 *
 * @param itemsFn - Function receiving the row and returning the dropdown
 *                  menu items array (grouped arrays for sections)
 */
export function actionsColumn<T extends object>(
  itemsFn: (row: { original: T; getValue: (key: string) => unknown }) => unknown[][]
): TableColumn<T> {
  return {
    id: 'actions',
    header: '',
    meta: { class: { td: 'text-right' } },
    cell: ({ row }) => h(BaseRowActions, { items: itemsFn(row) })
  }
}

/**
 * Create a cell renderer that formats a date column using the shared formatDate utility.
 *
 * @param key - The accessor key to read from the row
 */
export function dateCellRenderer<T extends object>(key: string): TableColumn<T>['cell'] {
  return ({ row }) => formatDate(row.getValue(key) as string | null) || '—'
}

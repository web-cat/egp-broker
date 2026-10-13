import { describe, it, expect } from 'vitest'
import {
  createAssignmentOverrideColumns,
  createAssignmentRedemptionColumns
} from '~/composables/features/useAssignmentRedemptionTables'

describe('useAssignmentRedemptionTables', () => {
  it('creates override columns with expected accessor keys', () => {
    const columns = createAssignmentOverrideColumns()
    expect(columns).toHaveLength(5)
    const keys = columns.map((c: any) => c.accessorKey)
    expect(keys).toEqual(['targetName', 'title', 'availableFrom', 'dueDate', 'acceptUntil'])
  })

  it('creates redemption columns with expected accessor keys', () => {
    const columns = createAssignmentRedemptionColumns()
    expect(columns).toHaveLength(7)
    const keys = columns.map((c: any) => c.accessorKey)
    expect(keys).toEqual([
      'studentName',
      'sectionName',
      'passTypeName',
      'cost',
      'redeemedAt',
      'dueDate',
      'isActive'
    ])
  })
})

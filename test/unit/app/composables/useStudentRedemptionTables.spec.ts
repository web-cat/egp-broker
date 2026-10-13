import { describe, it, expect } from 'vitest'
import {
  createStudentRedemptionLogColumns,
  createStudentInterviewHistoryColumns
} from '~/composables/features/useStudentRedemptionTables'

describe('useStudentRedemptionTables', () => {
  it('creates student redemption log columns with expected accessor keys', () => {
    const columns = createStudentRedemptionLogColumns()
    expect(columns).toHaveLength(6)
    const keys = columns.map((c: any) => c.accessorKey)
    expect(keys).toEqual([
      'assignmentTitle',
      'passTypeName',
      'cost',
      'redeemedAt',
      'dueDate',
      'isActive'
    ])
  })

  it('creates student interview history columns with expected accessor keys', () => {
    const columns = createStudentInterviewHistoryColumns()
    expect(columns).toHaveLength(5)
    const keys = columns.map((c: any) => c.accessorKey)
    expect(keys).toEqual(['assignmentTitle', 'gtaName', 'startTime', 'checkedOutAt', 'status'])
  })
})

import { describe, it, expect } from 'vitest'
import {
  assignmentRedemptionRowSchema,
  studentPassBalanceSchema,
  studentRosterRowSchema,
  studentRedemptionHistoryRowSchema
} from '../../../../shared/models/teacher'

describe('Teacher Shared Schemas', () => {
  it('validates assignmentRedemptionRowSchema', () => {
    const valid = {
      id: 'red-1',
      assignmentId: 'asg-1',
      assignmentTitle: 'Homework 1',
      studentId: 'user-1',
      studentName: 'Alice Smith',
      studentEmail: 'alice@example.com',
      sectionName: 'Section 001',
      passTypeName: 'Late Pass',
      cost: 1,
      hoursPerPass: 24,
      redeemedAt: '2026-08-25T10:00:00.000Z',
      dueDate: '2026-08-26T23:59:00.000Z',
      acceptUntil: '2026-08-26T23:59:00.000Z',
      isActive: true
    }

    const result = assignmentRedemptionRowSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('validates studentPassBalanceSchema', () => {
    const valid = {
      passTypeId: 'pt-1',
      passTypeName: 'Late Pass',
      balance: 2,
      initialBalance: 3
    }
    const result = studentPassBalanceSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('validates studentRosterRowSchema with pass balances', () => {
    const valid = {
      userId: 'user-1',
      studentName: 'Bob Jones',
      studentEmail: 'bob@example.com',
      sectionName: null,
      passBalances: [
        {
          passTypeId: 'pt-1',
          passTypeName: 'Homework Pass',
          balance: 2,
          initialBalance: 3
        }
      ],
      totalRedemptions: 1
    }

    const result = studentRosterRowSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('validates studentRedemptionHistoryRowSchema', () => {
    const valid = {
      id: 'red-2',
      assignmentId: 'asg-2',
      assignmentTitle: 'Quiz 2',
      passTypeName: 'Quiz Retry',
      cost: 2,
      hoursPerPass: 48,
      redeemedAt: '2026-08-25T12:00:00.000Z',
      dueDate: null,
      acceptUntil: null,
      isActive: false
    }

    const result = studentRedemptionHistoryRowSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })
})

import { z } from 'zod'

/**
 * Single student redemption record for a specific assignment (Option B)
 */
export const assignmentRedemptionRowSchema = z.object({
  id: z.string(),
  assignmentId: z.string(),
  assignmentTitle: z.string(),
  studentId: z.string(),
  studentName: z.string(),
  studentEmail: z.string().nullable(),
  sectionName: z.string().nullable(),
  passTypeName: z.string(),
  cost: z.number(),
  hoursPerPass: z.number(),
  redeemedAt: z.string(),
  dueDate: z.string().nullable(),
  acceptUntil: z.string().nullable(),
  isActive: z.boolean()
})

export type AssignmentRedemptionRow = z.infer<typeof assignmentRedemptionRowSchema>

/**
 * Student pass balance chip for roster display
 */
export const studentPassBalanceSchema = z.object({
  passTypeId: z.string(),
  passTypeName: z.string(),
  balance: z.number(),
  initialBalance: z.number()
})

export type StudentPassBalance = z.infer<typeof studentPassBalanceSchema>

/**
 * Student roster row with pass balances and total redemption count (Option C)
 */
export const studentRosterRowSchema = z.object({
  userId: z.string(),
  studentName: z.string(),
  studentEmail: z.string().nullable(),
  sectionName: z.string().nullable(),
  passBalances: z.array(studentPassBalanceSchema),
  totalRedemptions: z.number()
})

export type StudentRosterRow = z.infer<typeof studentRosterRowSchema>

/**
 * Individual student's pass redemption history row (Option C drill-down)
 */
export const studentRedemptionHistoryRowSchema = z.object({
  id: z.string(),
  assignmentId: z.string(),
  assignmentTitle: z.string(),
  passTypeName: z.string(),
  cost: z.number(),
  hoursPerPass: z.number(),
  redeemedAt: z.string(),
  dueDate: z.string().nullable(),
  acceptUntil: z.string().nullable(),
  isActive: z.boolean()
})

export type StudentRedemptionHistoryRow = z.infer<typeof studentRedemptionHistoryRowSchema>

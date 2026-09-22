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

/**
 * Schema for teacher updating a student's pass pool balances
 */
export const updateStudentPassPoolsSchema = z.object({
  balances: z
    .array(
      z.object({
        passTypeId: z.string().min(1, 'Pass type ID is required'),
        balance: z.number().int().min(0, 'Balance cannot be negative').max(1000)
      })
    )
    .min(1, 'At least one pass pool balance must be provided')
})

export type UpdateStudentPassPoolsInput = z.infer<typeof updateStudentPassPoolsSchema>

/**
 * Schema for teacher forcibly redeeming a pass for a student
 */
export const teacherForceRedeemPassSchema = z.object({
  assignmentId: z.string().min(1, 'Assignment is required'),
  passTypeId: z.string().min(1, 'Pass type is required'),
  deductFromBalance: z.boolean().default(true),
  availableFrom: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  acceptUntil: z.string().nullable().optional()
})

export type TeacherForceRedeemPassInput = z.infer<typeof teacherForceRedeemPassSchema>

export interface TeacherForceRedeemPassResponse {
  redemption: {
    id: string
    poolId: string
    assignmentId: string
    cost: number
    availableFrom: string | null
    dueDate: string | null
    acceptUntil: string | null
    canvasOverrideId?: string | null
    createdAt: string
  }
  passBalances: StudentPassBalance[]
  warning?: string
}

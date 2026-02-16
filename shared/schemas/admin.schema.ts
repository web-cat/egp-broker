import { z } from 'zod'

export const AdminAssignmentQuerySchema = z.object({
  c: z.string().optional()
})

export type AdminAssignmentQueryInput = z.infer<typeof AdminAssignmentQuerySchema>

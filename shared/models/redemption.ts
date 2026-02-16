import { z } from 'zod'

export const redeemPassSchema = z.object({
  assignmentId: z.string().min(1, 'Assignment ID is required'),
  passTypeId: z.string().min(1, 'Pass Type ID is required'),
  // Future proofing: prompts will go here
  promptResponses: z.record(z.string(), z.any()).optional()
})

export type RedeemPassData = z.infer<typeof redeemPassSchema>

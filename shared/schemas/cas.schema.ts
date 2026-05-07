import { z } from 'zod'

export const CasCallbackSchema = z.object({
  ticket: z.string().min(1),
  serverId: z.string().min(1)
})

export type CasCallbackInput = z.infer<typeof CasCallbackSchema>

export const CasLoginSchema = z.object({
  serverId: z.string().min(1)
})

export type CasLoginInput = z.infer<typeof CasLoginSchema>

export const CasServerPublicSchema = z.object({
  id: z.string(),
  name: z.string()
})

export type CasServerPublic = z.infer<typeof CasServerPublicSchema>

// =============================================================================
// ADMIN SCHEMAS
// =============================================================================

export const casServerAdminRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  baseUrl: z.string(),
  serviceValidateVersion: z.enum(['1.0', '2.0', '3.0']).default('2.0'),
  identityCount: z.number().default(0),
  createdAt: z.string()
})
export type CasServerAdminRow = z.infer<typeof casServerAdminRowSchema>

export const createCasServerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  baseUrl: z.string().url('Must be a valid URL'),
  serviceValidateVersion: z.enum(['1.0', '2.0', '3.0']).default('2.0')
})
export type CreateCasServerInput = z.infer<typeof createCasServerSchema>

export const updateCasServerSchema = createCasServerSchema.partial()
export type UpdateCasServerInput = z.infer<typeof updateCasServerSchema>

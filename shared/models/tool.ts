/**
 * LtiTool Model
 *
 * This file contains LtiTool-related types, interfaces and validation schemas
 */

import { z } from 'zod'
import { passPortRegistrationStatusSchema } from './passport'

export type { LtiTool, Protocol } from '@prisma/client'

// =============================================================================
// INTERFACES
// =============================================================================

export const toolRowSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  baseUrl: z.string(),
  protocol: z.enum(['LTI11', 'LTI13', 'SPLICE']),
  key: z.string().nullable(),
  supportsProxy: z.boolean(),
  supportsPassport: z.boolean(),
  supportsExtensionApi: z.boolean(),
  passportClientId: z.string().nullable(),
  passportRegistrationUrl: z.string().nullable(),
  passportExtensionUrl: z.string().nullable(),
  passportRegistrationStatus: passPortRegistrationStatusSchema,
  passportRegistrationError: z.string().nullable(),
  passportRegisteredAt: z.string().nullable(),
  passportRequestedProperties: z.array(z.string()).nullable(),
  platformId: z.string().nullable(),
  platformIssuer: z.string().nullable(),
  createdAt: z.string()
})

export type ToolRow = z.infer<typeof toolRowSchema>

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

export const createToolSchema = z.object({
  name: z.string().nullable().optional(),
  baseUrl: z.string().url('Must be a valid URL'),
  protocol: z.enum(['LTI11', 'LTI13', 'SPLICE']),
  key: z.string().nullable().optional(),
  secret: z.string().nullable().optional(),
  supportsProxy: z.boolean().default(true),
  supportsPassport: z.boolean().default(false),
  supportsExtensionApi: z.boolean().default(false),
  passportClientId: z.string().nullable().optional(),
  passportClientSecret: z.string().nullable().optional(),
  passportRegistrationUrl: z
    .string()
    .url('Must be a valid URL')
    .nullable()
    .optional()
    .or(z.literal('')),
  passportExtensionUrl: z
    .string()
    .url('Must be a valid URL')
    .nullable()
    .optional()
    .or(z.literal('')),
  passportRegistrationStatus: passPortRegistrationStatusSchema.optional(),
  passportRegistrationError: z.string().nullable().optional(),
  passportRequestedProperties: z.array(z.string()).nullable().optional(),
  platformId: z.string().nullable().optional()
})

export const updateToolSchema = createToolSchema.partial()

export const adminToolQuerySchema = z.object({
  p: z.string().optional() // platformId
})

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type CreateToolData = z.infer<typeof createToolSchema>
export type UpdateToolData = z.infer<typeof updateToolSchema>
export type AdminToolQuery = z.infer<typeof adminToolQuerySchema>

// =============================================================================
// INITIAL STATES
// =============================================================================

export const initialToolState: CreateToolData = {
  name: '',
  baseUrl: '',
  protocol: 'LTI13',
  key: '',
  secret: '',
  supportsProxy: true,
  supportsPassport: false,
  supportsExtensionApi: false,
  passportClientId: '',
  passportClientSecret: '',
  passportRegistrationUrl: '',
  passportExtensionUrl: '',
  platformId: null
}

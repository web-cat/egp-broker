/**
 * LtiTool Model
 *
 * This file contains LtiTool-related types, interfaces and validation schemas
 */

import { z } from 'zod'

export type { LtiTool, Protocol } from '@prisma/client'

// =============================================================================
// INTERFACES
// =============================================================================

export interface ToolRow {
  id: string
  name: string | null
  baseUrl: string
  protocol: 'LTI11' | 'LTI13' | 'SPLICE'
  key: string | null
  secret: string | null
  supportsExtensionApi: boolean
  platformId: string | null
  platformIssuer: string | null
  createdAt: string
}

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

export const createToolSchema = z.object({
  name: z.string().nullable().optional(),
  baseUrl: z.string().url('Must be a valid URL'),
  protocol: z.enum(['LTI11', 'LTI13', 'SPLICE']),
  key: z.string().nullable().optional(),
  secret: z.string().nullable().optional(),
  supportsExtensionApi: z.boolean().default(false),
  platformId: z.string().nullable().optional()
})

export const updateToolSchema = createToolSchema.partial()

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type CreateToolData = z.infer<typeof createToolSchema>
export type UpdateToolData = z.infer<typeof updateToolSchema>

// =============================================================================
// INITIAL STATES
// =============================================================================

export const initialToolState: CreateToolData = {
  name: '',
  baseUrl: '',
  protocol: 'LTI13',
  key: '',
  secret: '',
  supportsExtensionApi: false,
  platformId: null
}

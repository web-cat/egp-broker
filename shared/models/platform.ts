/**
 * Platform Model
 *
 * This file contains Platform-related types, interfaces and validation schemas
 */

import { z } from 'zod'

export type { LtiPlatform } from '@prisma/client'

// =============================================================================
// INTERFACES
// =============================================================================

export const platformRowSchema = z.object({
  id: z.string(),
  issuer: z.string(),
  clientId: z.string(),
  name: z.string().nullable(),
  authEndpoint: z.string(),
  tokenEndpoint: z.string(),
  jwksEndpoint: z.string(),
  deploymentCount: z.number(),
  createdAt: z.string()
})

export type PlatformRow = z.infer<typeof platformRowSchema>

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

// Placeholder for future schemas
export const createPlatformSchema = z.object({})
export const updatePlatformSchema = z.object({})

// =============================================================================
// TYPE EXPORTS
// =============================================================================

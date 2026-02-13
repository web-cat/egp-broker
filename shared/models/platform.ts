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

export interface PlatformRow {
    id: string
    issuer: string
    clientId: string
    name: string | null
    deploymentCount: number
    createdAt: string
}

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

// Placeholder for future schemas
export const createPlatformSchema = z.object({})
export const updatePlatformSchema = z.object({})

// =============================================================================
// TYPE EXPORTS
// =============================================================================

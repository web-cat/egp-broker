/**
 * Deployment Model
 *
 * This file contains LtiDeployment-related types, interfaces and validation schemas
 */

import { z } from 'zod'

export type { LtiDeployment } from '@prisma/client'

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

export const createDeploymentSchema = z.object({
    platformId: z.string().min(1, 'Platform is required'),
    deploymentId: z.string().min(1, 'Deployment ID is required'),
    deploymentHost: z.string().nullable().optional()
})

export const updateDeploymentSchema = z.object({
    deploymentId: z.string().optional(),
    deploymentHost: z.string().nullable().optional()
})

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type CreateDeploymentData = z.infer<typeof createDeploymentSchema>
export type UpdateDeploymentData = z.infer<typeof updateDeploymentSchema>

// =============================================================================
// INITIAL STATES
// =============================================================================

export const initialDeploymentState: Omit<CreateDeploymentData, 'platformId'> = {
    deploymentId: '',
    deploymentHost: ''
}

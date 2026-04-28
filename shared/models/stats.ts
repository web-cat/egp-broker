/**
 * Stats Model
 *
 * This file contains statistics-related types and interfaces
 */

// =============================================================================
// INTERFACES
// =============================================================================

export interface AdminPlatformSummary {
  id: string
  issuer: string
  name: string | null
}

export interface AdminDeploymentSummary {
  id: string
  deploymentId: string
}

export interface AdminStats {
  platforms: number
  deployments: number
  courses: number
  users: number
  tools: number
  gradeTranslations: number
  platformList: AdminPlatformSummary[]
  deploymentList: AdminDeploymentSummary[]
}

import prisma from '@@/lib/prisma'
import type {
  DeploymentRow,
  AdminDeploymentQuery,
  CreateDeploymentData,
  UpdateDeploymentData
} from '@@/shared/models/deployment'

/**
 * Validates and retrieves all LTI deployments, formatted as strict DeploymentRows.
 * Supports filtering by platformId.
 */
export async function getAllDeployments(filters?: AdminDeploymentQuery): Promise<DeploymentRow[]> {
  const where: Record<string, unknown> = {}
  if (filters?.p) {
    where.platformId = filters.p
  }

  const deployments = await prisma.ltiDeployment.findMany({
    where,
    include: {
      platform: { select: { issuer: true, name: true } },
      _count: { select: { courses: true } }
    },
    orderBy: { createdAt: 'desc' }
  })

  return deployments.map((d) => ({
    id: d.id,
    platformId: d.platformId,
    platformIssuer: d.platform.issuer,
    platformName: d.platform.name,
    deploymentId: d.deploymentId,
    deploymentHost: d.deploymentHost,
    courseCount: d._count.courses,
    createdAt: d.createdAt.toISOString()
  }))
}

/**
 * Retrieves a single deployment by ID.
 */
export async function getDeployment(id: string): Promise<DeploymentRow | null> {
  const d = await prisma.ltiDeployment.findUnique({
    where: { id },
    include: {
      platform: { select: { issuer: true, name: true } },
      _count: { select: { courses: true } }
    }
  })

  if (!d) return null

  return {
    id: d.id,
    platformId: d.platformId,
    platformIssuer: d.platform.issuer,
    platformName: d.platform.name,
    deploymentId: d.deploymentId,
    deploymentHost: d.deploymentHost,
    courseCount: d._count.courses,
    createdAt: d.createdAt.toISOString()
  }
}

/**
 * Creates a new deployment.
 */
export async function createDeployment(data: CreateDeploymentData): Promise<DeploymentRow> {
  const d = await prisma.ltiDeployment.create({
    data,
    include: {
      platform: { select: { issuer: true, name: true } },
      _count: { select: { courses: true } }
    }
  })

  return {
    id: d.id,
    platformId: d.platformId,
    platformIssuer: d.platform.issuer,
    platformName: d.platform.name,
    deploymentId: d.deploymentId,
    deploymentHost: d.deploymentHost,
    courseCount: d._count.courses,
    createdAt: d.createdAt.toISOString()
  }
}

/**
 * Updates an existing deployment.
 */
export async function updateDeployment(
  id: string,
  data: UpdateDeploymentData
): Promise<DeploymentRow> {
  const d = await prisma.ltiDeployment.update({
    where: { id },
    data,
    include: {
      platform: { select: { issuer: true, name: true } },
      _count: { select: { courses: true } }
    }
  })

  return {
    id: d.id,
    platformId: d.platformId,
    platformIssuer: d.platform.issuer,
    platformName: d.platform.name,
    deploymentId: d.deploymentId,
    deploymentHost: d.deploymentHost,
    courseCount: d._count.courses,
    createdAt: d.createdAt.toISOString()
  }
}

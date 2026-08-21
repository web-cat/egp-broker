import prisma from '@@/server/utils/db'
import type { PlatformRow } from '@@/shared/models/platform'

/**
 * Validates and retrieves all LTI platforms, formatted as strict PlatformRows.
 */
export async function getAllPlatforms(): Promise<PlatformRow[]> {
  const platforms = await prisma.ltiPlatform.findMany({
    include: {
      _count: {
        select: { deployments: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  return platforms.map((p) => ({
    id: p.id,
    issuer: p.issuer,
    clientId: p.clientId,
    name: p.name,
    authEndpoint: p.authEndpoint,
    tokenEndpoint: p.tokenEndpoint,
    jwksEndpoint: p.jwksEndpoint,
    deploymentCount: p._count.deployments,
    createdAt: p.createdAt.toISOString()
  }))
}

/**
 * Retrieves a single platform by ID.
 */
export async function getPlatform(id: string): Promise<PlatformRow | null> {
  const p = await prisma.ltiPlatform.findUnique({
    where: { id },
    include: {
      _count: {
        select: { deployments: true }
      }
    }
  })

  if (!p) return null

  return {
    id: p.id,
    issuer: p.issuer,
    clientId: p.clientId,
    name: p.name,
    authEndpoint: p.authEndpoint,
    tokenEndpoint: p.tokenEndpoint,
    jwksEndpoint: p.jwksEndpoint,
    deploymentCount: p._count.deployments,
    createdAt: p.createdAt.toISOString()
  }
}

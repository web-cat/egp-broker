import prisma from '@@/lib/prisma'
// Need to add DeploymentRowSchema to shared/models/deployment.ts first! 
// Assuming it exists for now based on previous pattern
import type { DeploymentRow } from '@@/shared/models/deployment'

/**
 * Validates and retrieves all LTI deployments, formatted as strict DeploymentRows.
 */
export async function getAllDeployments(): Promise<DeploymentRow[]> {
    const deployments = await prisma.ltiDeployment.findMany({
        include: { platform: { select: { issuer: true } } },
        orderBy: { createdAt: 'desc' }
    })

    return deployments.map((d) => ({
        id: d.id,
        platformId: d.platformId,
        platformIssuer: d.platform.issuer,
        deploymentId: d.deploymentId,
        deploymentHost: d.deploymentHost,
        createdAt: d.createdAt.toISOString()
    }))
}

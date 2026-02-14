import prisma from '@@/lib/prisma'
import type { ToolRow } from '@@/shared/models/tool'

/**
 * Validates and retrieves all LTI tools, formatted as strict ToolRows.
 */
export async function getAllTools(): Promise<ToolRow[]> {
    const tools = await prisma.ltiTool.findMany({
        include: { platform: { select: { issuer: true } } },
        orderBy: { createdAt: 'desc' }
    })

    return tools.map((t) => ({
        id: t.id,
        name: t.name,
        baseUrl: t.baseUrl,
        protocol: t.protocol,
        key: t.key,
        supportsExtensionApi: t.supportsExtensionApi,
        platformId: t.platformId,
        platformIssuer: t.platform?.issuer ?? null,
        createdAt: t.createdAt.toISOString()
    }))
}

/**
 * Retrieves a single tool by ID.
 */
export async function getTool(id: string): Promise<ToolRow | null> {
    const t = await prisma.ltiTool.findUnique({
        where: { id },
        include: { platform: { select: { issuer: true } } }
    })

    if (!t) return null

    return {
        id: t.id,
        name: t.name,
        baseUrl: t.baseUrl,
        protocol: t.protocol,
        key: t.key,
        supportsExtensionApi: t.supportsExtensionApi,
        platformId: t.platformId,
        platformIssuer: t.platform?.issuer ?? null,
        createdAt: t.createdAt.toISOString()
    }
}

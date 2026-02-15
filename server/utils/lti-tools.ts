import prisma from '@@/lib/prisma'
import type { ToolRow, AdminToolQuery, CreateToolData, UpdateToolData } from '@@/shared/models/tool'

/**
 * Validates and retrieves all LTI tools, formatted as strict ToolRows.
 * Supports filtering by platformId.
 */
export async function getAllTools(filters?: AdminToolQuery): Promise<ToolRow[]> {
  const where: Record<string, unknown> = {}
  if (filters?.p) {
    where.platformId = filters.p
  }

  const tools = await prisma.ltiTool.findMany({
    where,
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

/**
 * Creates a new tool.
 */
export async function createTool(data: CreateToolData): Promise<ToolRow> {
  const t = await prisma.ltiTool.create({
    data,
    include: { platform: { select: { issuer: true } } }
  })

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

/**
 * Updates an existing tool.
 */
export async function updateTool(id: string, data: UpdateToolData): Promise<ToolRow> {
  const t = await prisma.ltiTool.update({
    where: { id },
    data,
    include: { platform: { select: { issuer: true } } }
  })

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

/**
 * Deletes a tool by ID.
 */
export async function deleteTool(id: string): Promise<void> {
  await prisma.ltiTool.delete({
    where: { id }
  })
}

import prisma from '@@/server/utils/db'
import type { ToolRow, AdminToolQuery, CreateToolData, UpdateToolData } from '@@/shared/models/tool'

/**
 * Transforms a Prisma LtiTool record into a projected ToolRow.
 */
function toToolRow(t: any): ToolRow {
  return {
    id: t.id,
    name: t.name,
    baseUrl: t.baseUrl,
    protocol: t.protocol,
    key: t.key,
    supportsProxy: t.supportsProxy ?? true,
    supportsPassport: t.supportsPassport ?? false,
    supportsExtensionApi: t.supportsExtensionApi ?? false,
    passportClientId: t.passportClientId ?? null,
    passportRegistrationUrl: t.passportRegistrationUrl ?? null,
    passportExtensionUrl: t.passportExtensionUrl ?? null,
    passportRegistrationStatus: t.passportRegistrationStatus ?? 'NOT_REGISTERED',
    passportRegistrationError: t.passportRegistrationError ?? null,
    passportRegisteredAt: t.passportRegisteredAt
      ? t.passportRegisteredAt instanceof Date
        ? t.passportRegisteredAt.toISOString()
        : String(t.passportRegisteredAt)
      : null,
    passportRequestedProperties: Array.isArray(t.passportRequestedProperties)
      ? (t.passportRequestedProperties as string[])
      : null,
    platformId: t.platformId,
    platformIssuer: t.platform?.issuer ?? null,
    createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : String(t.createdAt)
  }
}

/**
 * Sanitizes tool input data before Prisma persistence.
 */
function sanitizeToolData<T extends CreateToolData | UpdateToolData>(
  data: T
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...data }
  if (result.passportRegistrationUrl === '') {
    result.passportRegistrationUrl = null
  }
  if (result.passportExtensionUrl === '') {
    result.passportExtensionUrl = null
  }
  return result
}

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

  return tools.map(toToolRow)
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
  return toToolRow(t)
}

/**
 * Creates a new tool.
 */
export async function createTool(data: CreateToolData): Promise<ToolRow> {
  const sanitized = sanitizeToolData(data)
  const t = await prisma.ltiTool.create({
    data: sanitized as any,
    include: { platform: { select: { issuer: true } } }
  })

  return toToolRow(t)
}

/**
 * Updates an existing tool.
 */
export async function updateTool(id: string, data: UpdateToolData): Promise<ToolRow> {
  const sanitized = sanitizeToolData(data)
  const t = await prisma.ltiTool.update({
    where: { id },
    data: sanitized as any,
    include: { platform: { select: { issuer: true } } }
  })

  return toToolRow(t)
}

/**
 * Deletes a tool by ID.
 */
export async function deleteTool(id: string): Promise<void> {
  await prisma.ltiTool.delete({
    where: { id }
  })
}

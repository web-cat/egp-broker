import prisma from '@@/server/utils/db'
import type { CasServerPublic } from '@@/shared/schemas/cas.schema'

/**
 * List all CAS servers (public endpoint)
 *
 * Returns only the id and name — used by the login page
 * to render one "Login with <name>" button per server.
 */
export default defineEventHandler(async (): Promise<CasServerPublic[]> => {
  const servers = await prisma.casServer.findMany({
    select: {
      id: true,
      name: true
    },
    orderBy: { name: 'asc' }
  })

  return servers
})

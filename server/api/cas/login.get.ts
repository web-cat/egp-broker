import type { H3Event } from 'h3'
import { getValidatedQuery } from 'h3'
import prisma from '@@/lib/prisma'
import { CasLoginSchema } from '@@/shared/schemas/cas.schema'

/**
 * CAS Login Redirect
 *
 * Accepts ?serverId=<id>, looks up the CasServer,
 * and redirects the user to the CAS login page.
 */
export default defineEventHandler(async (event: H3Event) => {
  const { serverId } = await getValidatedQuery(event, CasLoginSchema.parse)

  // Look up the CAS server configuration
  const casServer = await prisma.casServer.findUnique({
    where: { id: serverId }
  })

  if (!casServer) {
    throw createError({
      statusCode: 404,
      statusMessage: 'CAS server not found'
    })
  }

  // Build the service URL (our callback endpoint)
  const siteUrl = process.env.NUXT_SITE_URL || 'http://localhost:3000'
  const serviceUrl = buildCasServiceUrl(siteUrl, serverId)

  // Redirect to CAS login page
  const casLoginUrl = buildCasLoginUrl(casServer.baseUrl, serviceUrl)
  return sendRedirect(event, casLoginUrl)
})

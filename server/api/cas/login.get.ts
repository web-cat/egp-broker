import type { H3Event } from 'h3'
import { defineEventHandler, getValidatedQuery } from 'h3'
import { getServerSiteUrl } from '../../utils/site'
import prisma from '@@/server/utils/db'
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
  const siteUrl = getServerSiteUrl(event)
  const serviceUrl = buildCasServiceUrl(siteUrl, serverId)

  // Redirect to CAS login page
  const casLoginUrl = buildCasLoginUrl(casServer.baseUrl, serviceUrl)
  return sendRedirect(event, casLoginUrl)
})

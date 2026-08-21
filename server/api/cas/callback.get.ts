import type { H3Event } from 'h3'
import { defineEventHandler, getValidatedQuery } from 'h3'
import { getServerSiteUrl } from '../../utils/site'
import prisma from '@@/server/utils/db'
import { CasCallbackSchema } from '@@/shared/schemas/cas.schema'

/**
 * CAS Callback — Ticket Validation
 *
 * CAS redirects back here with ?ticket=<ST>&serverId=<id>.
 * We validate the ticket, find-or-create the user, set the session,
 * and redirect to the app.
 */
export default defineEventHandler(async (event: H3Event) => {
  const { ticket, serverId } = await getValidatedQuery(event, CasCallbackSchema.parse)

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

  try {
    // Build the service URL (must match exactly what was sent in /login)
    const siteUrl = getServerSiteUrl(event)
    const serviceUrl = buildCasServiceUrl(siteUrl, serverId)

    // Validate the CAS ticket
    const { username, attributes } = await validateCasTicket(ticket, serviceUrl, casServer)

    // Find or create the local user
    const user = await findOrCreateCasUser(username, attributes, casServer.id)

    // Set the session
    await setUserSession(event, {
      user,
      loggedInAt: new Date(),
      authMethod: 'cas'
    })

    // Redirect to home
    return sendRedirect(event, '/')
  } catch (error: unknown) {
    // If it's already an H3 error, re-throw
    if (error && typeof error === 'object' && 'statusCode' in error) throw error

    logger.error('CAS callback error:', { error })
    throw createError({
      statusCode: 401,
      statusMessage: 'CAS authentication failed'
    })
  }
})

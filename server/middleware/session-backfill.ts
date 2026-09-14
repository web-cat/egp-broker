import { defineEventHandler } from 'h3'
import prisma from '@@/server/utils/db'

/**
 * Server Middleware: session-backfill
 *
 * Checks active user sessions. If an active session exists but is missing
 * `globalRole` (e.g. created prior to LTI session update), it backfills
 * `globalRole` and `avatarUrl` from the database and updates the sealed session.
 */
export default defineEventHandler(async (event) => {
  const path = event.path || ''

  // Skip static assets and internal Nuxt asset pipelines
  if (path.startsWith('/_nuxt') || path.startsWith('/__nuxt') || path.startsWith('/favicon.ico')) {
    return
  }

  try {
    const session = await getUserSession(event)
    if (session?.user?.id && !session.user.globalRole) {
      const dbUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          globalRole: true,
          avatarUrl: true
        }
      })

      if (dbUser) {
        const updatedUser = {
          ...session.user,
          globalRole: dbUser.globalRole,
          avatarUrl: session.user.avatarUrl ?? dbUser.avatarUrl
        }

        await setUserSession(event, {
          ...session,
          user: updatedUser
        })

        // Also update local in-memory object on event context if present
        session.user.globalRole = dbUser.globalRole
      }
    }
  } catch {
    // Gracefully handle any session read/write error without failing the request
  }
})

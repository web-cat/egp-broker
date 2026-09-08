import { importPKCS8, SignJWT } from 'jose'
import crypto from 'node:crypto'
import prisma from '@@/server/utils/db'
import { parseCourseRole } from '@@/server/utils/lti'
import { getGravatarUrl } from '@@/server/utils/gravatar'

const STALE_LOCK_MS = 10 * 60 * 1000 // 10 minutes

/**
 * Atomically acquires the roster sync lock for a course.
 * Returns true if the lock was acquired, false if a sync is already running.
 */
export async function acquireRosterSyncLock(courseId: string): Promise<boolean> {
  // 1. Try atomic acquire
  const result = await prisma.course.updateMany({
    where: {
      id: courseId,
      isRosterSyncing: false
    },
    data: {
      isRosterSyncing: true
    }
  })

  if (result.count > 0) {
    return true
  }

  // 2. Check for stale lock (> 10 minutes)
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, isRosterSyncing: true, updatedAt: true }
  })

  if (course?.isRosterSyncing && course.updatedAt) {
    const elapsed = Date.now() - new Date(course.updatedAt).getTime()
    if (elapsed > STALE_LOCK_MS) {
      console.warn(
        `[NRPS] Overriding stale roster sync lock for course ${courseId} (${Math.round(elapsed / 1000)}s old)`
      )
      const overrideResult = await prisma.course.updateMany({
        where: { id: courseId },
        data: { isRosterSyncing: true }
      })
      return overrideResult.count > 0
    }
  }

  return false
}

/**
 * Releases the roster sync lock and optionally updates lastRosterSyncAt.
 */
export async function releaseRosterSyncLock(courseId: string, success: boolean): Promise<void> {
  try {
    await prisma.course.update({
      where: { id: courseId },
      data: success
        ? { isRosterSyncing: false, lastRosterSyncAt: new Date() }
        : { isRosterSyncing: false }
    })
  } catch (err) {
    console.error(`[NRPS] Failed to release sync lock for course ${courseId}:`, err)
  }
}

/**
 * Synchronizes course members and section enrollments from the LTI 1.3 NRPS endpoint.
 */
export async function syncCourseRosterFromNrps(courseId: string): Promise<{
  success: boolean
  memberCount?: number
  error?: string
}> {
  try {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        deployment: {
          include: {
            platform: true
          }
        }
      }
    })

    if (!course) {
      throw new Error(`Course not found: ${courseId}`)
    }

    const platform = course.deployment?.platform
    if (!platform || !platform.tokenEndpoint) {
      throw new Error(`Platform or token endpoint missing for course ${courseId}`)
    }

    const nrpsUrl = course.nrpsContextMembershipsUrl
    if (!nrpsUrl) {
      throw new Error(`NRPS context memberships URL missing for course ${courseId}`)
    }

    const config = useRuntimeConfig()
    const privateKeyPem = config.ltiPrivateKeyPem
    const toolKid = config.ltiKeyId

    if (!privateKeyPem) {
      throw new Error('LTI private key PEM not configured in environment')
    }

    // 1. Generate client assertion JWT
    const privateKey = await importPKCS8(privateKeyPem, 'RS256')
    const signedJwt = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: toolKid })
      .setIssuer(platform.clientId)
      .setSubject(platform.clientId)
      .setAudience(platform.tokenEndpoint)
      .setExpirationTime('5m')
      .setIssuedAt()
      .setJti(crypto.randomUUID())
      .sign(privateKey)

    // 2. Request OAuth2 access token for NRPS scope
    const tokenResponse: any = await $fetch(platform.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
        client_assertion: signedJwt,
        scope: 'https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly'
      })
    })

    const accessToken = tokenResponse?.access_token
    if (!accessToken) {
      throw new Error('Failed to obtain access token for NRPS')
    }

    // 3. Fetch membership pages from NRPS
    let currentUrl: string | null = nrpsUrl
    const allMembers: any[] = []

    const fetchRaw =
      typeof ($fetch as any).raw === 'function'
        ? ($fetch as any).raw
        : async (url: string, opts: any) => {
            const data = await $fetch(url, opts)
            return { _data: data, headers: new Headers() }
          }

    while (currentUrl) {
      const response: any = await fetchRaw(currentUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.ims.lti-nrps.v2.membershipcontainer+json'
        }
      })

      const data = response._data || response
      const members = data.members || []
      allMembers.push(...members)

      // Parse pagination Link header
      const linkHeader = response.headers?.get?.('link') || ''
      const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/i)
      currentUrl = nextMatch ? nextMatch[1] : null
    }

    console.info(`[NRPS] Fetched ${allMembers.length} member(s) for course ${courseId}`)

    // 4. Process members and update database
    for (const member of allMembers) {
      const ltiSub = member.user_id
      if (!ltiSub) continue

      const email = member.email || null
      const firstName = member.given_name || member.name?.split(' ')[0] || 'LTI'
      const lastName = member.family_name || 'User'
      const courseRole = parseCourseRole(member.roles)

      // Extract custom Canvas parameters from message claim if present
      const message = member.message?.[0]
      const custom = message?.['https://purl.imsglobal.org/spec/lti/claim/custom'] || {}
      const platformUserId = custom.canvas_user_id?.toString() || null
      const rawSectionIds = custom.canvas_section_ids?.toString() || null

      // Resolve section if available
      let sectionDbId: string | null = null
      if (rawSectionIds) {
        // May be a comma-separated list of section IDs; pick the first
        const sectionIdStr = rawSectionIds.split(',')[0].trim()
        if (sectionIdStr && !sectionIdStr.startsWith('$')) {
          const section = await prisma.courseSection.upsert({
            where: {
              courseId_canvasSectionId: {
                courseId,
                canvasSectionId: sectionIdStr
              }
            },
            create: {
              courseId,
              canvasSectionId: sectionIdStr,
              name: `Section ${sectionIdStr}`
            },
            update: {}
          })
          sectionDbId = section.id
        }
      }

      // Upsert User
      let user = await prisma.user.findFirst({
        where: {
          ltiIdentities: {
            some: {
              platformId: platform.id,
              ltiSub
            }
          }
        }
      })

      if (!user && email) {
        user = await prisma.user.upsert({
          where: { email },
          update: {
            firstName: firstName || undefined,
            lastName: lastName || undefined
          },
          create: {
            email,
            firstName,
            lastName,
            avatarUrl: getGravatarUrl(email),
            globalRole: 'USER'
          }
        })
      } else if (!user) {
        // User has no email and no prior identity; create user shell
        user = await prisma.user.create({
          data: {
            firstName,
            lastName,
            globalRole: 'USER'
          }
        })
      }

      // Upsert LtiIdentity
      await prisma.ltiIdentity.upsert({
        where: {
          platformId_ltiSub: {
            platformId: platform.id,
            ltiSub
          }
        },
        update: {
          platformUserId: platformUserId || undefined,
          deploymentId: course.deploymentId || undefined
        },
        create: {
          userId: user.id,
          platformId: platform.id,
          ltiSub,
          platformUserId,
          deploymentId: course.deploymentId || ''
        }
      })

      // Upsert Enrollment
      await prisma.enrollment.upsert({
        where: {
          userId_courseId: {
            userId: user.id,
            courseId
          }
        },
        update: {
          role: courseRole as any,
          ...(sectionDbId ? { courseSectionId: sectionDbId } : {})
        },
        create: {
          userId: user.id,
          courseId,
          role: courseRole as any,
          courseSectionId: sectionDbId
        }
      })
    }

    // 5. Release lock and update sync timestamp
    await releaseRosterSyncLock(courseId, true)

    return {
      success: true,
      memberCount: allMembers.length
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error(`[NRPS] Roster sync failed for course ${courseId}:`, errorMsg)
    await releaseRosterSyncLock(courseId, false)
    return {
      success: false,
      error: errorMsg
    }
  }
}

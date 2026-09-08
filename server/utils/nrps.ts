import { importPKCS8, SignJWT } from 'jose'
import crypto from 'node:crypto'
import prisma from '@@/server/utils/db'
import { parseCourseRole } from '@@/server/utils/lti'
import { getGravatarUrl } from '@@/server/utils/gravatar'
import { fetchCanvasSections, getPlatformCanvasDomain } from '@@/server/utils/canvas'

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
  sectionCount?: number
  studentsWithSection?: number
  studentsWithoutSection?: number
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
    const rawKey = (config.ltiPrivateKey || config.ltiPrivateKeyPem) as string | undefined
    const privateKeyPem = rawKey ? rawKey.replace(/\\n/g, '\n') : undefined
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

    // Resolve resource link ID (rlid) to receive expanded message custom claims (section IDs)
    let rlid = course.resourceLinkId
    if (!rlid) {
      const assignmentWithRlid = await prisma.assignment.findFirst({
        where: {
          courseId,
          resourceLinkId: { not: null }
        },
        select: { resourceLinkId: true }
      })
      if (assignmentWithRlid?.resourceLinkId) {
        rlid = assignmentWithRlid.resourceLinkId
      }
    }

    // 3. Fetch membership pages from NRPS
    let currentUrl: string | null = nrpsUrl
    if (rlid && !currentUrl.includes('rlid=')) {
      const separator = currentUrl.includes('?') ? '&' : '?'
      currentUrl = `${currentUrl}${separator}rlid=${encodeURIComponent(rlid)}`
    }

    console.info(
      `[NRPS] Starting sync for course ${courseId}. rlid: ${rlid || 'NONE'}. Request URL: ${currentUrl}`
    )
    const allMembers: any[] = []

    const fetchRaw =
      typeof ($fetch as any).raw === 'function'
        ? ($fetch as any).raw
        : async (url: string, opts: any) => {
            const data = await $fetch(url, opts)
            return { _data: data, headers: new Headers() }
          }

    while (currentUrl) {
      let response: any
      try {
        response = await fetchRaw(currentUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.ims.lti-nrps.v2.membershipcontainer+json'
          }
        })
      } catch (err: any) {
        if (currentUrl.includes('rlid=')) {
          console.warn(
            `[NRPS] Fetch with rlid failed (${err?.message || err}). Falling back to base NRPS URL without rlid.`
          )
          currentUrl = nrpsUrl
          response = await fetchRaw(currentUrl, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/vnd.ims.lti-nrps.v2.membershipcontainer+json'
            }
          })
        } else {
          throw err
        }
      }

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
    let sectionsUpsertedCount = 0
    let studentsWithSectionCount = 0
    let studentsWithoutSectionCount = 0
    const knownSectionIds = new Set<string>()

    for (const member of allMembers) {
      const ltiSub = member.user_id
      if (!ltiSub) continue

      const email = member.email || null
      const nameParts = (member.name || '').trim().split(/\s+/)
      const firstName = member.given_name || nameParts[0] || 'LTI'
      const lastName = member.family_name || nameParts.slice(1).join(' ') || 'User'
      const courseRole = parseCourseRole(member.roles)

      // Extract custom parameters across all standard and vendor locations:
      // 1. member.message[i]['https://purl.imsglobal.org/spec/lti/claim/custom']
      // 2. member.message[i].custom
      // 3. member['https://purl.imsglobal.org/spec/lti/claim/custom']
      // 4. member.custom
      // 5. Vendor claims: https://www.instructure.com/canvas_user_id, https://www.instructure.com/canvas_section_ids
      let custom: Record<string, any> = {}
      const messages = Array.isArray(member.message)
        ? member.message
        : member.message
          ? [member.message]
          : []

      for (const msg of messages) {
        if (msg && typeof msg === 'object') {
          const ltiCustom = msg['https://purl.imsglobal.org/spec/lti/claim/custom']
          if (ltiCustom && typeof ltiCustom === 'object') {
            custom = { ...custom, ...ltiCustom }
          }
          if (msg.custom && typeof msg.custom === 'object') {
            custom = { ...custom, ...msg.custom }
          }
          if (msg['https://www.instructure.com/canvas_user_id']) {
            custom.canvas_user_id =
              custom.canvas_user_id ?? msg['https://www.instructure.com/canvas_user_id']
          }
          if (msg['https://www.instructure.com/canvas_section_ids']) {
            custom.canvas_section_ids =
              custom.canvas_section_ids ?? msg['https://www.instructure.com/canvas_section_ids']
          }
        }
      }

      if (
        member['https://purl.imsglobal.org/spec/lti/claim/custom'] &&
        typeof member['https://purl.imsglobal.org/spec/lti/claim/custom'] === 'object'
      ) {
        custom = { ...custom, ...member['https://purl.imsglobal.org/spec/lti/claim/custom'] }
      }
      if (member.custom && typeof member.custom === 'object') {
        custom = { ...custom, ...member.custom }
      }
      if (member['https://www.instructure.com/canvas_user_id']) {
        custom.canvas_user_id =
          custom.canvas_user_id ?? member['https://www.instructure.com/canvas_user_id']
      }
      if (member['https://www.instructure.com/canvas_section_ids']) {
        custom.canvas_section_ids =
          custom.canvas_section_ids ?? member['https://www.instructure.com/canvas_section_ids']
      }

      const platformUserId = (custom.canvas_user_id ?? custom.user_id)?.toString() || null

      const rawSectionIds =
        (
          custom.canvas_section_ids ??
          custom.section_ids ??
          custom.canvas_section_id ??
          custom.section_id ??
          custom.user_section_ids ??
          custom.course_section_ids
        )?.toString() || null

      const rawSectionNames =
        (
          custom.canvas_section_names ??
          custom.section_names ??
          custom.canvas_section_name ??
          custom.section_name ??
          custom.user_section_names
        )?.toString() || null

      if (rawSectionIds?.startsWith('$')) {
        console.warn(
          `[NRPS] Canvas variable substitution not evaluated: received literal "${rawSectionIds}". Ensure the LMS Developer Key has permission for section variable substitution.`
        )
      }

      // Resolve section if available
      let sectionDbId: string | null = null
      if (rawSectionIds) {
        // May be a comma-separated list of section IDs; pick the first
        const sectionIdStr = rawSectionIds.split(',')[0].trim()
        if (sectionIdStr && !sectionIdStr.startsWith('$')) {
          let sectionName = `Section ${sectionIdStr}`
          if (rawSectionNames && !rawSectionNames.startsWith('$')) {
            const parsedName = rawSectionNames.split(',')[0].trim()
            if (parsedName) {
              sectionName = parsedName
            }
          }

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
              name: sectionName
            },
            update: sectionName !== `Section ${sectionIdStr}` ? { name: sectionName } : {}
          })
          sectionDbId = section.id
          if (!knownSectionIds.has(section.id)) {
            knownSectionIds.add(section.id)
            sectionsUpsertedCount++
          }
        }
      }

      if (courseRole === 'STUDENT') {
        if (sectionDbId) {
          studentsWithSectionCount++
        } else {
          studentsWithoutSectionCount++
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

      const syntheticEmail = `${ltiSub}@synthetic.canvas.local`
      const effectiveEmail = email || syntheticEmail

      if (!user) {
        user = await prisma.user.upsert({
          where: { email: effectiveEmail },
          update: {
            firstName: firstName || undefined,
            lastName: lastName || undefined
          },
          create: {
            email: effectiveEmail,
            firstName,
            lastName,
            avatarUrl: email ? getGravatarUrl(email) : null,
            globalRole: 'USER'
          }
        })
      }

      // Upsert LtiIdentity
      // Note: LtiIdentity has compound foreign key on (platformId, deploymentId) referencing LtiDeployment(platformId, deploymentId).
      // deploymentIdClaim is course.deployment?.deploymentId (the LTI deployment_id string claim, NOT the deployment CUID id).
      const deploymentIdClaim = course.deployment?.deploymentId ?? null
      const existingIdentity = await prisma.ltiIdentity.findFirst({
        where: {
          platformId: platform.id,
          OR: [{ ltiSub }, { userId: user.id }]
        }
      })

      if (existingIdentity) {
        await prisma.ltiIdentity.update({
          where: { id: existingIdentity.id },
          data: {
            userId: user.id,
            ltiSub,
            platformUserId: platformUserId ?? existingIdentity.platformUserId,
            deploymentId: deploymentIdClaim ?? existingIdentity.deploymentId
          }
        })
      } else {
        await prisma.ltiIdentity.create({
          data: {
            userId: user.id,
            platformId: platform.id,
            ltiSub,
            platformUserId,
            deploymentId: deploymentIdClaim
          }
        })
      }

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

    console.info(
      `[NRPS] Sync result for course ${courseId}: ${allMembers.length} members processed, ${sectionsUpsertedCount} section(s) upserted, ${studentsWithSectionCount} student(s) linked to a section, ${studentsWithoutSectionCount} student(s) without a section.`
    )

    if (studentsWithSectionCount === 0 && allMembers.length > 0) {
      const sample = allMembers[0]
      console.info(
        `[NRPS Diagnostic] 0 students linked to sections. Sample member keys: [${Object.keys(sample || {}).join(', ')}], message: ${JSON.stringify(sample?.message || null)}`
      )
    }

    // 5. Fallback to Canvas API for section enrollments if NRPS did not retrieve any sections
    if (studentsWithSectionCount === 0) {
      try {
        const teacherIdentity = await prisma.ltiIdentity.findFirst({
          where: {
            platformId: platform.id,
            platformApiKey: { not: null },
            user: {
              enrollments: {
                some: {
                  courseId,
                  role: { in: ['TEACHER', 'TA', 'ADMIN', 'DESIGNER'] }
                }
              }
            }
          },
          select: {
            platformApiKey: true
          }
        })

        if (teacherIdentity?.platformApiKey) {
          const domain = getPlatformCanvasDomain(platform, course.deployment?.deploymentHost)
          const courseIdMatch = nrpsUrl.match(/\/courses\/(\d+)/)
          const canvasCourseId =
            course.canvasCourseId && !course.canvasCourseId.startsWith('$')
              ? course.canvasCourseId
              : courseIdMatch?.[1]

          if (canvasCourseId) {
            console.info(
              `[NRPS Fallback] 0 sections from LTI NRPS, but found teacher Canvas API key. Fetching sections from Canvas API (${domain}, course ${canvasCourseId})...`
            )

            const canvasSections = await fetchCanvasSections(
              domain,
              canvasCourseId,
              teacherIdentity.platformApiKey
            )

            for (const cs of canvasSections) {
              const canvasSecIdStr = cs.id.toString()
              const sectionName = cs.name || `Section ${canvasSecIdStr}`

              const dbSection = await prisma.courseSection.upsert({
                where: {
                  courseId_canvasSectionId: {
                    courseId,
                    canvasSectionId: canvasSecIdStr
                  }
                },
                create: {
                  courseId,
                  canvasSectionId: canvasSecIdStr,
                  name: sectionName
                },
                update: {
                  name: sectionName
                }
              })

              if (!knownSectionIds.has(dbSection.id)) {
                knownSectionIds.add(dbSection.id)
                sectionsUpsertedCount++
              }

              if (cs.enrollments && Array.isArray(cs.enrollments)) {
                for (const en of cs.enrollments) {
                  const platformUserId = en.user_id?.toString()
                  const userEmail = en.user?.email || null
                  const userLoginId = en.user?.login_id || null

                  let matchedUserId: string | null = null

                  if (platformUserId) {
                    const ltiIdent = await prisma.ltiIdentity.findFirst({
                      where: {
                        platformId: platform.id,
                        platformUserId
                      },
                      select: { userId: true }
                    })
                    if (ltiIdent) {
                      matchedUserId = ltiIdent.userId
                    }
                  }

                  if (!matchedUserId && userEmail) {
                    const userByEmail = await prisma.user.findUnique({
                      where: { email: userEmail },
                      select: { id: true }
                    })
                    if (userByEmail) {
                      matchedUserId = userByEmail.id
                    }
                  }

                  if (!matchedUserId && userLoginId) {
                    const userByLogin = await prisma.user.findFirst({
                      where: {
                        email: { startsWith: `${userLoginId}@` },
                        enrollments: { some: { courseId } }
                      },
                      select: { id: true }
                    })
                    if (userByLogin) {
                      matchedUserId = userByLogin.id
                    }
                  }

                  if (matchedUserId) {
                    if (platformUserId) {
                      await prisma.ltiIdentity.updateMany({
                        where: {
                          platformId: platform.id,
                          userId: matchedUserId,
                          platformUserId: null
                        },
                        data: { platformUserId }
                      })
                    }

                    await prisma.enrollment.updateMany({
                      where: {
                        userId: matchedUserId,
                        courseId,
                        role: 'STUDENT'
                      },
                      data: { courseSectionId: dbSection.id }
                    })
                  }
                }
              }
            }

            studentsWithSectionCount = await prisma.enrollment.count({
              where: { courseId, role: 'STUDENT', courseSectionId: { not: null } }
            })
            studentsWithoutSectionCount = await prisma.enrollment.count({
              where: { courseId, role: 'STUDENT', courseSectionId: null }
            })

            console.info(
              `[NRPS Fallback] Canvas API section sync complete: ${sectionsUpsertedCount} section(s), ${studentsWithSectionCount} student(s) in sections.`
            )
          }
        }
      } catch (fallbackErr: any) {
        console.warn(
          `[NRPS Fallback] Canvas API section sync fallback failed (${fallbackErr?.message || fallbackErr}). Continuing with NRPS data.`
        )
      }
    }

    // 6. Release lock and update sync timestamp
    await releaseRosterSyncLock(courseId, true)

    return {
      success: true,
      memberCount: allMembers.length,
      sectionCount: sectionsUpsertedCount,
      studentsWithSection: studentsWithSectionCount,
      studentsWithoutSection: studentsWithoutSectionCount
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

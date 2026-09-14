import { describe, it, expect, vi, beforeEach } from 'vitest'
import launchPost from '../../../../../server/api/lti13/launch.post'
import prisma from '@@/server/utils/db'
import { handleLtiLaunch } from '@@/server/utils/lti-launch'
import { verifyLtiToken } from '@@/server/utils/lti'

vi.mock('@@/server/utils/db', () => ({
  default: {
    ltiPlatform: {
      findUnique: vi.fn()
    }
  }
}))

vi.mock('@@/server/utils/lti-launch', () => ({
  handleLtiLaunch: vi.fn()
}))

vi.mock('@@/server/utils/lti', () => ({
  verifyLtiToken: vi.fn()
}))

vi.stubGlobal('getUserSession', vi.fn())
vi.stubGlobal('setUserSession', vi.fn())

describe('LTI 1.3 Launch Handler', () => {
  const mockEvent = (body: any = {}) =>
    ({
      context: {},
      node: { req: { method: 'POST' } },
      _body: body
    }) as any

  vi.mock('h3', async () => {
    const actual = await vi.importActual('h3')
    return {
      ...actual,
      defineEventHandler: (handler: any) => handler,
      readValidatedBody: (event: any, _validator: any) => Promise.resolve(event._body),
      sendRedirect: (event: any, location: string, status: number) => ({
        redirectedTo: location,
        status
      }),
      createError: (opts: any) => {
        const err = new Error(opts.statusMessage || 'Error')
        Object.assign(err, opts)
        return err
      }
    }
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects invalid state', async () => {
    vi.mocked(getUserSession).mockResolvedValue({
      lti: { state: 'expected-state', nonce: 'nonce-1' }
    } as any)

    const event = mockEvent({ id_token: 'tok-1', state: 'different-state' })
    await expect(launchPost(event)).rejects.toThrow('Invalid state')
  })

  it('rejects when platform is not found', async () => {
    vi.mocked(getUserSession).mockResolvedValue({
      lti: { state: 'valid-state', nonce: 'nonce-1', issuer: 'https://unknown.issuer' }
    } as any)
    vi.mocked(prisma.ltiPlatform.findUnique).mockResolvedValue(null)

    const event = mockEvent({ id_token: 'tok-1', state: 'valid-state' })
    await expect(launchPost(event)).rejects.toThrow('Platform not found')
  })

  it('saves session with globalRole and avatarUrl, and redirects PROCTOR to /proctor on course nav launch', async () => {
    vi.mocked(getUserSession).mockResolvedValue({
      lti: {
        state: 'valid-state',
        nonce: 'nonce-1',
        issuer: 'https://canvas.vt.edu'
      }
    } as any)

    vi.mocked(prisma.ltiPlatform.findUnique).mockResolvedValue({
      id: 'plat-vt',
      issuer: 'https://canvas.vt.edu',
      clientId: '10000',
      jwksEndpoint: 'https://canvas.vt.edu/api/jwks'
    } as any)

    vi.mocked(verifyLtiToken).mockResolvedValue({
      nonce: 'nonce-1',
      sub: 'canvas-sub-1'
    } as any)

    vi.mocked(handleLtiLaunch).mockResolvedValue({
      user: {
        id: 'usr-proctor-1',
        email: 'proctor@vt.edu',
        firstName: 'Jane',
        lastName: 'Proctor',
        currentCourseId: 'course-1',
        globalRole: 'PROCTOR',
        avatarUrl: 'https://example.com/avatar.jpg'
      },
      assignmentId: null, // Course navigation launch (no assignment)
      userRole: 'OBSERVER',
      isTechSupport: true,
      sourcedId: 'sourced-1',
      needsConfiguration: false,
      syncRequired: false
    } as any)

    const event = mockEvent({ id_token: 'tok-1', state: 'valid-state' })
    const result: any = await launchPost(event)

    expect(setUserSession).toHaveBeenCalledWith(event, {
      user: {
        id: 'usr-proctor-1',
        email: 'proctor@vt.edu',
        firstName: 'Jane',
        lastName: 'Proctor',
        currentCourseId: 'course-1',
        role: 'OBSERVER',
        globalRole: 'PROCTOR',
        avatarUrl: 'https://example.com/avatar.jpg'
      },
      lti: {
        state: 'valid-state',
        nonce: 'nonce-1',
        issuer: 'https://canvas.vt.edu',
        sourcedId: 'sourced-1'
      }
    })

    // PROCTOR enrolled as Tech Support should be routed straight to /proctor
    expect(result.redirectedTo).toBe('/proctor')
    expect(result.status).toBe(303)
  })

  it('redirects user with PROCTOR globalRole to / when enrolled as regular student', async () => {
    vi.mocked(getUserSession).mockResolvedValue({
      lti: {
        state: 'valid-state',
        nonce: 'nonce-1',
        issuer: 'https://canvas.vt.edu'
      }
    } as any)

    vi.mocked(prisma.ltiPlatform.findUnique).mockResolvedValue({
      id: 'plat-vt',
      issuer: 'https://canvas.vt.edu',
      clientId: '10000',
      jwksEndpoint: 'https://canvas.vt.edu/api/jwks'
    } as any)

    vi.mocked(verifyLtiToken).mockResolvedValue({
      nonce: 'nonce-1',
      sub: 'canvas-sub-proctor-student'
    } as any)

    vi.mocked(handleLtiLaunch).mockResolvedValue({
      user: {
        id: 'usr-proctor-student',
        email: 'proctor.student@vt.edu',
        firstName: 'Jane',
        lastName: 'StudentProctor',
        currentCourseId: 'course-1',
        globalRole: 'PROCTOR',
        avatarUrl: null
      },
      assignmentId: null,
      userRole: 'STUDENT',
      isTechSupport: false,
      sourcedId: 'sourced-ps',
      needsConfiguration: false,
      syncRequired: false
    } as any)

    const event = mockEvent({ id_token: 'tok-1', state: 'valid-state' })
    const result: any = await launchPost(event)

    // Proctor enrolled as regular student in this course lands on student dashboard /
    expect(result.redirectedTo).toBe('/')
    expect(result.status).toBe(303)
  })

  it('redirects regular student user to / on course nav launch', async () => {
    vi.mocked(getUserSession).mockResolvedValue({
      lti: {
        state: 'valid-state',
        nonce: 'nonce-1',
        issuer: 'https://canvas.vt.edu'
      }
    } as any)

    vi.mocked(prisma.ltiPlatform.findUnique).mockResolvedValue({
      id: 'plat-vt',
      issuer: 'https://canvas.vt.edu',
      clientId: '10000',
      jwksEndpoint: 'https://canvas.vt.edu/api/jwks'
    } as any)

    vi.mocked(verifyLtiToken).mockResolvedValue({
      nonce: 'nonce-1',
      sub: 'canvas-sub-2'
    } as any)

    vi.mocked(handleLtiLaunch).mockResolvedValue({
      user: {
        id: 'usr-student-1',
        email: 'student@vt.edu',
        firstName: 'Sam',
        lastName: 'Student',
        currentCourseId: 'course-1',
        globalRole: 'USER',
        avatarUrl: null
      },
      assignmentId: null,
      userRole: 'STUDENT',
      sourcedId: 'sourced-2',
      needsConfiguration: false,
      syncRequired: false
    } as any)

    const event = mockEvent({ id_token: 'tok-1', state: 'valid-state' })
    const result: any = await launchPost(event)

    expect(result.redirectedTo).toBe('/')
    expect(result.status).toBe(303)
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleLtiLaunch } from '@@/server/utils/lti-launch'
import * as nrpsModule from '@@/server/utils/nrps'

vi.mock('@@/server/utils/gravatar', () => ({
  getGravatarUrl: (email: string) => `https://gravatar.com/avatar/${email}`
}))

vi.mock('@@/server/utils/nrps', () => ({
  acquireRosterSyncLock: vi.fn(),
  syncCourseRosterFromNrps: vi.fn().mockResolvedValue({ success: true })
}))

describe('LTI Launch NRPS Integration & Concurrency Gating', () => {
  const platform = { id: 'plat-1' }

  const baseClaims = {
    sub: 'user-sub-1',
    email: 'user@example.edu',
    given_name: 'Alex',
    family_name: 'Smith',
    name: 'Alex Smith',
    'https://purl.imsglobal.org/spec/lti/claim/deployment_id': 'dep-1',
    'https://purl.imsglobal.org/spec/lti/claim/context': {
      id: 'ctx-1',
      label: 'CS 101',
      title: 'Intro to CS'
    },
    'https://purl.imsglobal.org/spec/lti/claim/roles': [
      'http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor'
    ],
    'https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice': {
      context_memberships_url: 'https://canvas.example.edu/api/lti/courses/101/names_and_roles',
      service_versions: ['2.0']
    },
    'https://purl.imsglobal.org/spec/lti/claim/custom': {
      canvas_course_id: '101'
    }
  }

  function makeTx(courseOverrides = {}, enrollmentOverrides = {}) {
    const course = {
      id: 'course-1',
      nrpsContextMembershipsUrl: 'https://canvas.example.edu/api/lti/courses/101/names_and_roles',
      lastRosterSyncAt: null,
      isRosterSyncing: false,
      ...courseOverrides
    }
    const enrollment = {
      userId: 'user-1',
      courseId: 'course-1',
      role: 'TEACHER',
      courseSectionId: null,
      ...enrollmentOverrides
    }
    return {
      ltiDeployment: { upsert: vi.fn().mockResolvedValue({ id: 'dep-1' }) },
      course: { upsert: vi.fn().mockResolvedValue(course) },
      user: {
        findFirst: vi.fn().mockResolvedValue({ id: 'user-1', email: 'user@example.edu' }),
        update: vi.fn().mockResolvedValue({ id: 'user-1', currentCourseId: 'course-1' })
      },
      ltiIdentity: { upsert: vi.fn().mockResolvedValue({}) },
      courseSection: { upsert: vi.fn().mockResolvedValue({ id: 'sec-db-1' }) },
      enrollment: { upsert: vi.fn().mockResolvedValue(enrollment) },
      assignment: { findUnique: vi.fn(), create: vi.fn() }
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('triggers sync on teacher launch if roster has never been synced', async () => {
    const tx = makeTx({ lastRosterSyncAt: null, isRosterSyncing: false })
    const prismaMock = { $transaction: vi.fn((cb) => cb(tx)) }
    vi.mocked(nrpsModule.acquireRosterSyncLock).mockResolvedValue(true)

    const result = await handleLtiLaunch(prismaMock as any, { claims: baseClaims, platform } as any)

    expect(nrpsModule.acquireRosterSyncLock).toHaveBeenCalledWith('course-1')
    expect(nrpsModule.syncCourseRosterFromNrps).toHaveBeenCalledWith('course-1')
    expect(result.syncRequired).toBe(true)
  })

  it('skips sync on teacher launch if roster was synced within the last 24 hours', async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
    const tx = makeTx({ lastRosterSyncAt: twoHoursAgo, isRosterSyncing: false })
    const prismaMock = { $transaction: vi.fn((cb) => cb(tx)) }

    const result = await handleLtiLaunch(prismaMock as any, { claims: baseClaims, platform } as any)

    expect(nrpsModule.acquireRosterSyncLock).not.toHaveBeenCalled()
    expect(nrpsModule.syncCourseRosterFromNrps).not.toHaveBeenCalled()
    expect(result.syncRequired).toBe(false)
  })

  it('triggers sync on teacher launch if roster was synced more than 24 hours ago', async () => {
    const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000)
    const tx = makeTx({ lastRosterSyncAt: twentyFiveHoursAgo, isRosterSyncing: false })
    const prismaMock = { $transaction: vi.fn((cb) => cb(tx)) }
    vi.mocked(nrpsModule.acquireRosterSyncLock).mockResolvedValue(true)

    const result = await handleLtiLaunch(prismaMock as any, { claims: baseClaims, platform } as any)

    expect(nrpsModule.acquireRosterSyncLock).toHaveBeenCalledWith('course-1')
    expect(nrpsModule.syncCourseRosterFromNrps).toHaveBeenCalledWith('course-1')
    expect(result.syncRequired).toBe(true)
  })

  it('triggers sync on student launch if student has no section enrollment', async () => {
    const studentClaims = {
      ...baseClaims,
      'https://purl.imsglobal.org/spec/lti/claim/roles': [
        'http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'
      ]
    }
    const tx = makeTx(
      { lastRosterSyncAt: new Date(), isRosterSyncing: false },
      { role: 'STUDENT', courseSectionId: null }
    )
    const prismaMock = { $transaction: vi.fn((cb) => cb(tx)) }
    vi.mocked(nrpsModule.acquireRosterSyncLock).mockResolvedValue(true)

    const result = await handleLtiLaunch(
      prismaMock as any,
      { claims: studentClaims, platform } as any
    )

    expect(nrpsModule.acquireRosterSyncLock).toHaveBeenCalledWith('course-1')
    expect(nrpsModule.syncCourseRosterFromNrps).toHaveBeenCalledWith('course-1')
    expect(result.syncRequired).toBe(true)
  })

  it('skips sync on student launch if student already has a section enrollment', async () => {
    const studentClaims = {
      ...baseClaims,
      'https://purl.imsglobal.org/spec/lti/claim/roles': [
        'http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'
      ]
    }
    const tx = makeTx(
      { lastRosterSyncAt: new Date(), isRosterSyncing: false },
      { role: 'STUDENT', courseSectionId: 'sec-db-1' }
    )
    const prismaMock = { $transaction: vi.fn((cb) => cb(tx)) }

    const result = await handleLtiLaunch(
      prismaMock as any,
      { claims: studentClaims, platform } as any
    )

    expect(nrpsModule.acquireRosterSyncLock).not.toHaveBeenCalled()
    expect(nrpsModule.syncCourseRosterFromNrps).not.toHaveBeenCalled()
    expect(result.syncRequired).toBe(false)
  })

  it('concurrency gating: returns syncRequired: true but skips new sync if sync is already in progress', async () => {
    const tx = makeTx({ isRosterSyncing: true })
    const prismaMock = { $transaction: vi.fn((cb) => cb(tx)) }

    const result = await handleLtiLaunch(prismaMock as any, { claims: baseClaims, platform } as any)

    expect(nrpsModule.acquireRosterSyncLock).not.toHaveBeenCalled()
    expect(nrpsModule.syncCourseRosterFromNrps).not.toHaveBeenCalled()
    expect(result.syncRequired).toBe(true)
  })
})

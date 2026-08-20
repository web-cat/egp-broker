import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests
// ─────────────────────────────────────────────────────────────────────────────

import {
  upsertDeployment,
  resolveUser,
  resolveAssignment,
  handleLtiLaunch
} from '@@/server/utils/lti-launch'

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('@@/server/utils/gravatar', () => ({
  getGravatarUrl: (email: string) => `https://gravatar.com/avatar/${email}`
}))

vi.mock('@prisma/client', () => ({
  CourseRole: {
    TEACHER: 'TEACHER',
    STUDENT: 'STUDENT',
    TA: 'TA',
    OBSERVER: 'OBSERVER',
    DESIGNER: 'DESIGNER',
    ADMIN: 'ADMIN'
  },
  PrismaClient: vi.fn()
}))

// ─── Prisma transaction mock factory ─────────────────────────────────────────

function makeTx(overrides: Record<string, any> = {}) {
  return {
    ltiDeployment: { upsert: vi.fn().mockResolvedValue({ id: 'dep-1' }) },
    ltiIdentity: { findUnique: vi.fn(), create: vi.fn(), upsert: vi.fn() },
    user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
    course: { upsert: vi.fn().mockResolvedValue({ id: 'course-1' }) },
    enrollment: { upsert: vi.fn() },
    assignment: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
    ...overrides
  }
}

describe('lti-launch utils', () => {
  // ── upsertDeployment ────────────────────────────────────────────────────────

  describe('upsertDeployment', () => {
    it('calls tx.ltiDeployment.upsert with correct args', async () => {
      const tx = makeTx()
      tx.ltiDeployment.upsert.mockResolvedValue({ id: 'dep-99' })

      const result = await upsertDeployment(tx as any, {
        platformId: 'plat-1',
        deploymentId: 'deploy-1',
        deploymentHost: 'canvas.example.com'
      })

      expect(result.id).toBe('dep-99')
      expect(tx.ltiDeployment.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { platformId_deploymentId: { platformId: 'plat-1', deploymentId: 'deploy-1' } },
          create: expect.objectContaining({ deploymentHost: 'canvas.example.com' })
        })
      )
    })
  })

  // ── resolveUser ─────────────────────────────────────────────────────────────

  describe('resolveUser', () => {
    const baseArgs = {
      platformId: 'plat-1',
      ltiSub: 'sub-abc',
      email: 'jane@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
      platformUserId: '42',
      deploymentId: 'deploy-1'
    }

    it('returns existing user when LTI identity found', async () => {
      const existingUser = { id: 'user-1', email: 'jane@example.com' }
      const tx = makeTx()
      tx.ltiIdentity.findUnique.mockResolvedValue({ user: existingUser })

      const result = await resolveUser(tx as any, baseArgs)
      expect(result).toEqual(existingUser)
      expect(tx.user.create).not.toHaveBeenCalled()
    })

    it('finds user by email if no LTI identity exists', async () => {
      const existingUser = { id: 'user-2', email: 'jane@example.com' }
      const tx = makeTx()
      tx.ltiIdentity.findUnique.mockResolvedValue(null)
      tx.user.findUnique.mockResolvedValue(existingUser)
      tx.ltiIdentity.create.mockResolvedValue({})

      const result = await resolveUser(tx as any, baseArgs)
      expect(result).toEqual(existingUser)
      expect(tx.user.create).not.toHaveBeenCalled()
    })

    it('creates a new user and identity when neither exist', async () => {
      const newUser = { id: 'user-3', email: 'new@example.com' }
      const tx = makeTx()
      tx.ltiIdentity.findUnique.mockResolvedValue(null)
      tx.user.findUnique.mockResolvedValue(null)
      tx.user.create.mockResolvedValue(newUser)
      tx.ltiIdentity.create.mockResolvedValue({})

      const result = await resolveUser(tx as any, { ...baseArgs, email: 'new@example.com' })
      expect(result).toEqual(newUser)
      expect(tx.user.create).toHaveBeenCalledOnce()
      expect(tx.ltiIdentity.create).toHaveBeenCalledOnce()
    })
  })

  // ── resolveAssignment ───────────────────────────────────────────────────────

  describe('resolveAssignment', () => {
    const baseArgs = {
      courseId: 'course-1',
      resourceLinkId: 'link-1',
      canvasAssignmentId: undefined,
      title: 'Homework 1'
    }

    beforeEach(() => {})

    it('returns id from existing assignment found by resourceLinkId', async () => {
      const tx = makeTx()
      tx.assignment.findUnique.mockResolvedValue({ id: 'asgn-1' })
      tx.assignment.update.mockResolvedValue({})

      const { id } = await resolveAssignment(tx as any, baseArgs)
      expect(id).toBe('asgn-1')
      expect(tx.assignment.findFirst).not.toHaveBeenCalled()
    })

    it('creates a new assignment when resourceLinkId not found', async () => {
      const tx = makeTx()
      tx.assignment.findUnique.mockResolvedValue(null)
      tx.assignment.create.mockResolvedValue({ id: 'asgn-new' })

      const { id } = await resolveAssignment(tx as any, {
        ...baseArgs,
        resourceLinkId: 'link-new'
      })

      expect(id).toBe('asgn-new')
      expect(tx.assignment.create).toHaveBeenCalledOnce()
    })

    it('creates a new assignment when none found', async () => {
      const tx = makeTx()
      tx.assignment.findUnique.mockResolvedValue(null)
      tx.assignment.findFirst.mockResolvedValue(null)
      tx.assignment.create.mockResolvedValue({ id: 'asgn-created' })

      const { id } = await resolveAssignment(tx as any, {
        ...baseArgs,
        canvasAssignmentId: undefined
      })
      expect(id).toBe('asgn-created')
      expect(tx.assignment.create).toHaveBeenCalledOnce()
    })
  })

  // ── handleLtiLaunch ─────────────────────────────────────────────────────────

  describe('handleLtiLaunch', () => {
    const platform = {
      id: 'plat-1',
      issuer: 'https://canvas.instructure.com',
      clientId: 'client-1'
    }

    const baseClaims = {
      sub: 'user-sub-123',
      email: 'teacher@vt.edu',
      name: 'Teacher User',
      'https://purl.imsglobal.org/spec/lti/claim/deployment_id': 'dep-1',
      'https://purl.imsglobal.org/spec/lti/claim/resource_link': {
        id: 'resource-link-1',
        title: 'EGP Broker'
      },
      'https://purl.imsglobal.org/spec/lti/claim/context': {
        id: 'canvas-course-231884',
        label: 'CS 1114',
        title: 'Intro to Software Design'
      },
      'https://purl.imsglobal.org/spec/lti/claim/roles': [
        'http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor'
      ]
    }

    it('returns assignmentId: null and skips assignment creation when launched from Course Navigation', async () => {
      const tx = makeTx({
        user: {
          findFirst: vi.fn().mockResolvedValue({ id: 'user-1', email: 'teacher@vt.edu' }),
          update: vi.fn().mockResolvedValue({ id: 'user-1', currentCourseId: 'course-1' })
        },
        assignment: {
          findUnique: vi.fn(),
          create: vi.fn()
        }
      })
      const prismaMock = { $transaction: vi.fn((cb) => cb(tx)) }

      const claims = {
        ...baseClaims,
        'https://purl.imsglobal.org/spec/lti/claim/custom': {
          canvas_assignment_id: '$Canvas.assignment.id',
          canvas_course_id: '231884'
        }
      }

      const result = await handleLtiLaunch(prismaMock as any, { claims, platform } as any)

      expect(result.assignmentId).toBeNull()
      expect(result.needsConfiguration).toBe(false)
      expect(tx.assignment.findUnique).not.toHaveBeenCalled()
      expect(tx.assignment.create).not.toHaveBeenCalled()
    })

    it('creates/resolves assignment when launched from an Assignment with expanded canvas_assignment_id', async () => {
      const tx = makeTx({
        user: {
          findFirst: vi.fn().mockResolvedValue({ id: 'user-1', email: 'teacher@vt.edu' }),
          update: vi.fn().mockResolvedValue({ id: 'user-1', currentCourseId: 'course-1' })
        },
        assignment: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: 'asgn-456', toolId: null })
        },
        ltiResult: {
          upsert: vi.fn().mockResolvedValue({ id: 'result-1' })
        }
      })
      const prismaMock = { $transaction: vi.fn((cb) => cb(tx)) }

      const claims = {
        ...baseClaims,
        'https://purl.imsglobal.org/spec/lti/claim/custom': {
          canvas_assignment_id: '98765',
          canvas_course_id: '231884'
        }
      }

      const result = await handleLtiLaunch(prismaMock as any, { claims, platform } as any)

      expect(result.assignmentId).toBe('asgn-456')
      expect(result.needsConfiguration).toBe(true)
      expect(tx.assignment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            canvasAssignmentId: '98765'
          })
        })
      )
    })
  })
})

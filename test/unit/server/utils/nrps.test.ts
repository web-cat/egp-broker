import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@@/server/utils/db'
import {
  acquireRosterSyncLock,
  releaseRosterSyncLock,
  syncCourseRosterFromNrps
} from '@@/server/utils/nrps'

// Mock prisma and $fetch
vi.mock('@@/server/utils/db', () => ({
  default: {
    course: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn()
    },
    courseSection: {
      upsert: vi.fn()
    },
    user: {
      findFirst: vi.fn(),
      upsert: vi.fn()
    },
    ltiIdentity: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn()
    },
    enrollment: {
      upsert: vi.fn()
    },
    $transaction: vi.fn((cb) => (typeof cb === 'function' ? cb(prisma) : Promise.all(cb)))
  }
}))

// Mock useRuntimeConfig
vi.stubGlobal('useRuntimeConfig', () => ({
  ltiPrivateKeyPem: `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0Y8K1vQv6jW9d3+9WvC5k5Q9F8u+0Q2v...
-----END RSA PRIVATE KEY-----`,
  ltiKeyId: 'test-key-id'
}))

// Mock jose for JWT generation
vi.mock('jose', () => ({
  importPKCS8: vi.fn().mockResolvedValue('mock-private-key'),
  SignJWT: vi.fn().mockImplementation(() => ({
    setProtectedHeader: vi.fn().mockReturnThis(),
    setIssuer: vi.fn().mockReturnThis(),
    setSubject: vi.fn().mockReturnThis(),
    setAudience: vi.fn().mockReturnThis(),
    setExpirationTime: vi.fn().mockReturnThis(),
    setIssuedAt: vi.fn().mockReturnThis(),
    setJti: vi.fn().mockReturnThis(),
    sign: vi.fn().mockResolvedValue('signed-jwt-assertion')
  }))
}))

// Mock global $fetch
const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

describe('NRPS Roster Synchronization Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.course.update).mockResolvedValue({ id: 'course-1' } as any)
  })

  describe('acquireRosterSyncLock', () => {
    it('acquires lock when no sync is running', async () => {
      vi.mocked(prisma.course.updateMany).mockResolvedValue({ count: 1 })

      const acquired = await acquireRosterSyncLock('course-1')
      expect(acquired).toBe(true)
      expect(prisma.course.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'course-1',
            isRosterSyncing: false
          }),
          data: { isRosterSyncing: true }
        })
      )
    })

    it('returns false when a sync is already running', async () => {
      vi.mocked(prisma.course.updateMany).mockResolvedValue({ count: 0 })
      vi.mocked(prisma.course.findUnique).mockResolvedValue({
        id: 'course-1',
        isRosterSyncing: true,
        updatedAt: new Date() // recent, not stale
      } as any)

      const acquired = await acquireRosterSyncLock('course-1')
      expect(acquired).toBe(false)
    })

    it('recovers stale lock if isRosterSyncing has been active for over 10 minutes', async () => {
      vi.mocked(prisma.course.updateMany)
        .mockResolvedValueOnce({ count: 0 }) // Normal acquire failed
        .mockResolvedValueOnce({ count: 1 }) // Stale override succeeded

      const elevenMinutesAgo = new Date(Date.now() - 11 * 60 * 1000)
      vi.mocked(prisma.course.findUnique).mockResolvedValue({
        id: 'course-1',
        isRosterSyncing: true,
        updatedAt: elevenMinutesAgo
      } as any)

      const acquired = await acquireRosterSyncLock('course-1')
      expect(acquired).toBe(true)
      expect(prisma.course.updateMany).toHaveBeenCalledTimes(2)
    })
  })

  describe('releaseRosterSyncLock', () => {
    it('clears isRosterSyncing and updates lastRosterSyncAt on success', async () => {
      await releaseRosterSyncLock('course-1', true)

      expect(prisma.course.update).toHaveBeenCalledWith({
        where: { id: 'course-1' },
        data: expect.objectContaining({
          isRosterSyncing: false,
          lastRosterSyncAt: expect.any(Date)
        })
      })
    })

    it('clears isRosterSyncing without updating lastRosterSyncAt on failure', async () => {
      await releaseRosterSyncLock('course-1', false)

      expect(prisma.course.update).toHaveBeenCalledWith({
        where: { id: 'course-1' },
        data: { isRosterSyncing: false }
      })
    })
  })

  describe('syncCourseRosterFromNrps', () => {
    const mockPlatform = {
      id: 'plat-1',
      clientId: 'client-123',
      tokenEndpoint: 'https://canvas.example.edu/login/oauth2/token'
    }

    const mockCourse = {
      id: 'course-1',
      canvasCourseId: '12345',
      nrpsContextMembershipsUrl: 'https://canvas.example.edu/api/lti/courses/12345/names_and_roles',
      deployment: {
        deploymentId: 'canvas-deploy-123',
        platform: mockPlatform
      }
    }

    it('successfully syncs members and sections from NRPS endpoint', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(mockCourse as any)

      // 1. Token response
      mockFetch.mockResolvedValueOnce({
        access_token: 'nrps-bearer-token',
        token_type: 'Bearer',
        expires_in: 3600
      })

      // 2. NRPS membership response with rawResponse for Link headers
      const mockMembers = [
        {
          status: 'Active',
          user_id: 'lti-sub-student-1',
          name: 'Jane Student',
          given_name: 'Jane',
          family_name: 'Student',
          email: 'jane@example.edu',
          roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'],
          message: [
            {
              'https://purl.imsglobal.org/spec/lti/claim/custom': {
                canvas_user_id: '901',
                canvas_section_ids: 'sec-canvas-42'
              }
            }
          ]
        },
        {
          status: 'Active',
          user_id: 'lti-sub-teacher-1',
          name: 'Prof Instructor',
          given_name: 'Prof',
          family_name: 'Instructor',
          email: 'prof@example.edu',
          roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor'],
          message: [
            {
              'https://purl.imsglobal.org/spec/lti/claim/custom': {
                canvas_user_id: '902'
              }
            }
          ]
        },
        {
          status: 'Active',
          user_id: 'lti-sub-test-student',
          name: 'Test Student',
          roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner']
        }
      ]

      mockFetch.mockResolvedValueOnce({
        id: 'https://canvas.example.edu/api/lti/courses/12345/names_and_roles',
        members: mockMembers
      })

      vi.mocked(prisma.courseSection.upsert).mockResolvedValue({
        id: 'db-sec-42',
        canvasSectionId: 'sec-canvas-42',
        courseId: 'course-1',
        name: 'Section 42'
      } as any)

      vi.mocked(prisma.user.upsert)
        .mockResolvedValueOnce({ id: 'user-stud-1', email: 'jane@example.edu' } as any)
        .mockResolvedValueOnce({ id: 'user-teach-1', email: 'prof@example.edu' } as any)
        .mockResolvedValueOnce({
          id: 'user-test-student',
          email: 'lti-sub-test-student@synthetic.canvas.local'
        } as any)

      const result = await syncCourseRosterFromNrps('course-1')

      expect(result.success).toBe(true)
      expect(result.memberCount).toBe(3)

      // Verify token request
      expect(mockFetch).toHaveBeenCalledWith(
        mockPlatform.tokenEndpoint,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        })
      )

      // Verify membership fetch with Authorization header
      expect(mockFetch).toHaveBeenCalledWith(
        mockCourse.nrpsContextMembershipsUrl,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer nrps-bearer-token',
            Accept: 'application/vnd.ims.lti-nrps.v2.membershipcontainer+json'
          })
        })
      )

      // Verify section upserted
      expect(prisma.courseSection.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            courseId_canvasSectionId: {
              courseId: 'course-1',
              canvasSectionId: 'sec-canvas-42'
            }
          }
        })
      )

      // Verify LtiIdentity created with correct deploymentId string claim
      expect(prisma.ltiIdentity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-stud-1',
            platformId: 'plat-1',
            ltiSub: 'lti-sub-student-1',
            deploymentId: 'canvas-deploy-123'
          })
        })
      )

      // Verify user without email (Test Student) receives deterministic synthetic email
      expect(prisma.user.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: 'lti-sub-test-student@synthetic.canvas.local' },
          create: expect.objectContaining({
            email: 'lti-sub-test-student@synthetic.canvas.local',
            firstName: 'Test',
            lastName: 'Student'
          })
        })
      )

      // Verify student enrollment linked to section
      expect(prisma.enrollment.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_courseId: {
              userId: 'user-stud-1',
              courseId: 'course-1'
            }
          },
          update: expect.objectContaining({
            role: 'STUDENT',
            courseSectionId: 'db-sec-42'
          }),
          create: expect.objectContaining({
            role: 'STUDENT',
            courseSectionId: 'db-sec-42'
          })
        })
      )

      // Verify lock release and timestamp update
      expect(prisma.course.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'course-1' },
          data: expect.objectContaining({
            isRosterSyncing: false,
            lastRosterSyncAt: expect.any(Date)
          })
        })
      )
    })

    it('resets isRosterSyncing to false if the NRPS call fails', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(mockCourse as any)

      // Token response fails
      mockFetch.mockRejectedValueOnce(new Error('Canvas OAuth2 error: invalid_client'))

      const result = await syncCourseRosterFromNrps('course-1')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Canvas OAuth2 error')

      // Ensure lock is released even on failure
      expect(prisma.course.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'course-1' },
          data: { isRosterSyncing: false }
        })
      )
    })
  })
})

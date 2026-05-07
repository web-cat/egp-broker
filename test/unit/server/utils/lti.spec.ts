import { describe, it, expect, vi } from 'vitest'

// Import after mocking
import { parseCourseRole } from '@@/server/utils/lti'

// Mock @prisma/client before importing the function
vi.mock('@prisma/client', () => ({
  CourseRole: {
    TEACHER: 'TEACHER',
    STUDENT: 'STUDENT',
    TA: 'TA',
    OBSERVER: 'OBSERVER',
    DESIGNER: 'DESIGNER',
    ADMIN: 'ADMIN'
  },
  PrismaClient: vi.fn().mockImplementation(() => ({
    // Mock the specific database tables your LTI logic uses
    // Example: if you use prisma.casServer.findUnique()
    casServer: {
      findUnique: vi.fn(),
      findMany: vi.fn()
    },
    user: {
      findUnique: vi.fn()
    }
  }))
}))

describe('LTI Utils', () => {
  describe('parseCourseRole', () => {
    it('should return STUDENT when roles is undefined', () => {
      expect(parseCourseRole(undefined)).toBe('STUDENT')
    })

    it('should return STUDENT when roles is empty array', () => {
      expect(parseCourseRole([])).toBe('STUDENT')
    })

    it('should return TEACHER for Instructor role', () => {
      const roles = ['http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor']
      expect(parseCourseRole(roles)).toBe('TEACHER')
    })

    it('should return STUDENT for Learner role', () => {
      const roles = ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner']
      expect(parseCourseRole(roles)).toBe('STUDENT')
    })

    it('should return TA for TeachingAssistant role', () => {
      const roles = [
        'http://purl.imsglobal.org/vocab/lis/v2/membership/Instructor#TeachingAssistant'
      ]
      expect(parseCourseRole(roles)).toBe('TA')
    })

    it('should return OBSERVER for Mentor role', () => {
      const roles = ['http://purl.imsglobal.org/vocab/lis/v2/membership#Mentor']
      expect(parseCourseRole(roles)).toBe('OBSERVER')
    })

    it('should return DESIGNER for ContentDeveloper role', () => {
      const roles = ['http://purl.imsglobal.org/vocab/lis/v2/membership#ContentDeveloper']
      expect(parseCourseRole(roles)).toBe('DESIGNER')
    })

    it('should return ADMIN for Administrator role', () => {
      const roles = ['http://purl.imsglobal.org/vocab/lis/v2/institution/person#Administrator']
      expect(parseCourseRole(roles)).toBe('ADMIN')
    })

    it('should prioritize TA over Teacher when both roles present', () => {
      const roles = [
        'http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor',
        'http://purl.imsglobal.org/vocab/lis/v2/membership/Instructor#TeachingAssistant'
      ]
      expect(parseCourseRole(roles)).toBe('TA')
    })

    it('should return STUDENT for unrecognized roles', () => {
      const roles = ['http://purl.imsglobal.org/vocab/lis/v2/membership#UnknownRole']
      expect(parseCourseRole(roles)).toBe('STUDENT')
    })
  })
})

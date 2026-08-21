import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getAllUsers, getUser } from '../../../../server/utils/users'
import prisma from '@@/server/utils/db'

vi.mock('@@/server/utils/db', () => ({
  default: {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn()
    }
  }
}))

describe('User Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getAllUsers', () => {
    it('should return mapped user rows', async () => {
      const mockDate = new Date('2023-01-01T00:00:00.000Z')
      const mockUsers = [
        {
          id: 'u1',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          globalRole: 'USER',
          avatarUrl: null,
          createdAt: mockDate,
          emailVerified: true
        }
      ]

      vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers as any)

      const result = await getAllUsers()

      expect(result).toEqual([
        {
          id: 'u1',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          globalRole: 'USER',
          avatarUrl: null,
          createdAt: mockDate.toISOString(),
          emailVerified: true
        }
      ])
    })
  })

  describe('getUser', () => {
    it('should return null if not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
      const result = await getUser('missing')
      expect(result).toBeNull()
    })

    it('should return mapped user row', async () => {
      const mockDate = new Date('2023-01-01T00:00:00.000Z')
      const mockUser = {
        id: 'u1',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        globalRole: 'USER',
        avatarUrl: null,
        createdAt: mockDate,
        emailVerified: true
      }

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)

      const result = await getUser('u1')

      expect(result).toEqual({
        id: 'u1',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        globalRole: 'USER',
        avatarUrl: null,
        createdAt: mockDate.toISOString(),
        emailVerified: true
      })
    })
  })
})

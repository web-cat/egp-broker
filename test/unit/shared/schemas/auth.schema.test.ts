import { describe, it, expect } from 'vitest'
import {
  LtiLaunchSchema,
  LtiLoginSchema,
  LtiSessionUserSchema
} from '@@/shared/schemas/auth.schema'

describe('Auth Schemas', () => {
  describe('LtiLaunchSchema', () => {
    it('validates valid launch parameters', () => {
      const valid = {
        id_token: 'valid.token.string',
        state: '123e4567-e89b-12d3-a456-426614174000'
      }
      expect(LtiLaunchSchema.parse(valid)).toEqual(valid)
    })

    it('rejects invalid state UUID', () => {
      const invalid = {
        id_token: 'valid.token.string',
        state: 'not-a-uuid'
      }
      expect(() => LtiLaunchSchema.parse(invalid)).toThrow()
    })
  })

  describe('LtiLoginSchema', () => {
    it('validates standard login request', () => {
      const valid = {
        iss: 'https://canvas.example.com',
        login_hint: 'user-123',
        target_link_uri: 'https://egp.example.com/api/lti13/launch',
        client_id: '10000000000001'
      }
      expect(LtiLoginSchema.parse(valid)).toEqual(valid)
    })

    it('rejects missing iss', () => {
      const invalid = {
        login_hint: 'user-123',
        target_link_uri: 'https://egp.example.com/api/lti13/launch'
      }
      expect(() => LtiLoginSchema.parse(invalid)).toThrow()
    })
  })

  describe('LtiSessionUserSchema', () => {
    it('validates session user payload', () => {
      const user = {
        id: 'c123456789012345678901234',
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        avatarUrl: 'https://example.com/avatar.png',
        globalRole: 'INSTRUCTOR' as const,
        currentCourseId: null
      }
      expect(LtiSessionUserSchema.parse(user)).toEqual(user)
    })
  })
})

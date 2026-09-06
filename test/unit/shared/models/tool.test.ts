import { describe, it, expect } from 'vitest'
import {
  toolRowSchema,
  createToolSchema,
  updateToolSchema,
  initialToolState
} from '../../../../shared/models/tool'

describe('LtiTool Shared Models', () => {
  describe('toolRowSchema', () => {
    it('validates a complete tool row with dual roles and passport metadata', () => {
      const toolRow = {
        id: 'tool-1',
        name: 'CodeWorkout',
        baseUrl: 'https://codeworkout.org',
        protocol: 'LTI13',
        key: 'cw-key',
        supportsProxy: true,
        supportsPassport: true,
        supportsExtensionApi: true,
        passportClientId: 'cw-client-id',
        passportRegistrationUrl: 'https://codeworkout.org/api/passport/v1/register',
        passportExtensionUrl: 'https://codeworkout.org/api/passport/v1/extension',
        passportRegistrationStatus: 'REGISTERED',
        passportRegistrationError: null,
        passportRegisteredAt: '2026-09-06T12:00:00.000Z',
        passportRequestedProperties: ['email', 'canvas_course_id'],
        platformId: 'plat-1',
        platformIssuer: 'https://canvas.instructure.com',
        createdAt: '2026-09-06T10:00:00.000Z'
      }

      const parsed = toolRowSchema.parse(toolRow)
      expect(parsed).toEqual(toolRow)
    })
  })

  describe('createToolSchema', () => {
    it('applies default dual-role flags when not explicitly provided', () => {
      const input = {
        baseUrl: 'https://gradescope.com',
        protocol: 'LTI13'
      }

      const parsed = createToolSchema.parse(input)
      expect(parsed.supportsProxy).toBe(true)
      expect(parsed.supportsPassport).toBe(false)
      expect(parsed.supportsExtensionApi).toBe(false)
    })

    it('accepts explicit PassPort settings', () => {
      const input = {
        name: 'CodeWorkout',
        baseUrl: 'https://codeworkout.org',
        protocol: 'LTI13',
        supportsProxy: false,
        supportsPassport: true,
        passportRegistrationUrl: 'https://codeworkout.org/api/passport/v1/register'
      }

      const parsed = createToolSchema.parse(input)
      expect(parsed.supportsProxy).toBe(false)
      expect(parsed.supportsPassport).toBe(true)
      expect(parsed.passportRegistrationUrl).toBe(
        'https://codeworkout.org/api/passport/v1/register'
      )
    })
  })

  describe('updateToolSchema', () => {
    it('validates partial updates for passport fields', () => {
      const input = {
        supportsPassport: true,
        passportRegistrationStatus: 'PENDING' as const
      }

      const parsed = updateToolSchema.parse(input)
      expect(parsed.supportsPassport).toBe(true)
      expect(parsed.passportRegistrationStatus).toBe('PENDING')
    })
  })

  describe('initialToolState', () => {
    it('provides standard initial state defaults', () => {
      expect(initialToolState.supportsProxy).toBe(true)
      expect(initialToolState.supportsPassport).toBe(false)
      expect(initialToolState.passportRegistrationUrl).toBe('')
      expect(initialToolState.protocol).toBe('LTI13')
    })
  })
})

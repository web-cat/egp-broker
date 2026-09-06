import { describe, it, expect } from 'vitest'
import {
  passPortPhase1RequestSchema,
  passPortPhase2CredentialsSchema,
  passPortExtensionPayloadSchema,
  passPortRollbackPayloadSchema,
  passPortRegistrationStatusSchema
} from '../../../../shared/models/passport'

describe('PassPort Shared Models', () => {
  describe('passPortRegistrationStatusSchema', () => {
    it('accepts valid statuses', () => {
      expect(passPortRegistrationStatusSchema.parse('NOT_REGISTERED')).toBe('NOT_REGISTERED')
      expect(passPortRegistrationStatusSchema.parse('PENDING')).toBe('PENDING')
      expect(passPortRegistrationStatusSchema.parse('REGISTERED')).toBe('REGISTERED')
      expect(passPortRegistrationStatusSchema.parse('FAILED')).toBe('FAILED')
    })

    it('rejects invalid status', () => {
      expect(() => passPortRegistrationStatusSchema.parse('UNKNOWN')).toThrow()
    })
  })

  describe('passPortPhase1RequestSchema', () => {
    it('validates compliant Phase 1 registration payload', () => {
      const valid = {
        broker_base_url: 'https://egp-broker.university.edu',
        callback_url: 'https://egp-broker.university.edu/api/passport/v1/credentials?token=cuid123',
        name: 'VT Extension Manager',
        passport_version: '1.0'
      }
      expect(passPortPhase1RequestSchema.parse(valid)).toEqual(valid)
    })

    it('rejects invalid urls or unsupported version', () => {
      expect(() =>
        passPortPhase1RequestSchema.parse({
          broker_base_url: 'not-a-url',
          callback_url: 'https://broker.edu/cb',
          name: 'Broker',
          passport_version: '1.0'
        })
      ).toThrow()

      expect(() =>
        passPortPhase1RequestSchema.parse({
          broker_base_url: 'https://broker.edu',
          callback_url: 'https://broker.edu/cb',
          name: 'Broker',
          passport_version: '2.0'
        })
      ).toThrow()
    })
  })

  describe('passPortPhase2CredentialsSchema', () => {
    it('validates compliant Phase 2 credentials push payload', () => {
      const valid = {
        tool_name: 'CodeWorkout',
        passport_version: '1.0',
        endpoints: {
          extension_handler: 'https://codeworkout.org/api/passport/v1/extension'
        },
        requested_properties: ['canvas_course_id', 'lti_user_id', 'email'],
        credentials: {
          client_id: 'broker-client-id-123',
          client_secret: 'random-secret-key-abc'
        }
      }
      const parsed = passPortPhase2CredentialsSchema.parse(valid)
      expect(parsed.tool_name).toBe('CodeWorkout')
      expect(parsed.credentials.client_secret).toBe('random-secret-key-abc')
    })

    it('provides default empty array if requested_properties is omitted', () => {
      const payload = {
        tool_name: 'Web-CAT',
        passport_version: '1.0',
        endpoints: {
          extension_handler: 'https://webcat.org/api/passport/v1/extension'
        },
        credentials: {
          client_id: 'cid',
          client_secret: 'sec'
        }
      }
      const parsed = passPortPhase2CredentialsSchema.parse(payload)
      expect(parsed.requested_properties).toEqual([])
    })

    it('rejects missing credentials or invalid extension_handler url', () => {
      expect(() =>
        passPortPhase2CredentialsSchema.parse({
          tool_name: 'CodeWorkout',
          passport_version: '1.0',
          endpoints: {
            extension_handler: 'invalid-url'
          },
          credentials: {
            client_id: '',
            client_secret: ''
          }
        })
      ).toThrow()
    })
  })

  describe('passPortExtensionPayloadSchema', () => {
    it('validates full extension request payload', () => {
      const payload = {
        request_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        context: {
          lms_instance_guid: 'guid-123',
          issuer: 'https://canvas.instructure.com',
          lti_context_id: 'course-ctx-456',
          canvas_course_id: '999'
        },
        user: {
          lti_user_id: 'user-sub-789',
          email: 'student@university.edu'
        },
        resource: {
          lti_resource_link_id: 'res-link-101',
          title: 'Project 1'
        },
        extension: {
          pass_type: '24_HOUR_PASS',
          original_due_date: '2026-09-10T23:59:59Z',
          new_due_date: '2026-09-11T23:59:59Z',
          applied_at: '2026-09-09T12:00:00Z'
        }
      }
      expect(passPortExtensionPayloadSchema.parse(payload)).toEqual(payload)
    })

    it('rejects non-uuid request_id', () => {
      expect(() =>
        passPortExtensionPayloadSchema.parse({
          request_id: 'not-a-uuid',
          context: {
            lms_instance_guid: 'g',
            issuer: 'iss',
            lti_context_id: 'c'
          },
          user: { lti_user_id: 'u' },
          resource: { lti_resource_link_id: 'r' },
          extension: {
            pass_type: 'p',
            original_due_date: 'd1',
            new_due_date: 'd2',
            applied_at: 'd3'
          }
        })
      ).toThrow()
    })
  })

  describe('passPortRollbackPayloadSchema', () => {
    it('validates rollback request with uuid', () => {
      const rollback = {
        request_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
      }
      expect(passPortRollbackPayloadSchema.parse(rollback)).toEqual(rollback)
    })
  })
})

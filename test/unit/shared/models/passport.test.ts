import { describe, it, expect } from 'vitest'
import {
  passPortPhase1RequestSchema,
  passPortPhase2CredentialsSchema,
  passPortExtensionPayloadSchema,
  passPortRollbackPayloadSchema,
  passPortRegistrationStatusSchema,
  normalizePassPortExtensionUrl,
  normalizePassPortStatusUrl,
  passPortStatusResponseSchema,
  passPortStatusPayloadSchema,
  toCachedSubmissionStatus
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
    it('validates compliant Phase 1 registration payload with 1.0 and 1.1', () => {
      const valid10 = {
        broker_base_url: 'https://egp-broker.university.edu',
        callback_url: 'https://egp-broker.university.edu/api/passport/v1/credentials?token=cuid123',
        name: 'VT Extension Manager',
        passport_version: '1.0' as const
      }
      expect(passPortPhase1RequestSchema.parse(valid10)).toEqual(valid10)

      const valid11 = {
        ...valid10,
        passport_version: '1.1' as const
      }
      expect(passPortPhase1RequestSchema.parse(valid11)).toEqual(valid11)

      const valid12 = {
        ...valid10,
        passport_version: '1.2' as const
      }
      expect(passPortPhase1RequestSchema.parse(valid12)).toEqual(valid12)
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
        passport_version: '1.1',
        endpoints: {
          extension_handler: 'https://codeworkout.org/api/passport/v1/extension',
          status_handler: 'https://codeworkout.org/api/passport/v1/status'
        },
        requested_properties: ['canvas_course_id', 'lti_user_id', 'email'],
        credentials: {
          client_id: 'broker-client-id-123',
          client_secret: 'random-secret-key-abc'
        }
      }
      const parsed = passPortPhase2CredentialsSchema.parse(valid)
      expect(parsed.tool_name).toBe('CodeWorkout')
      expect(parsed.passport_version).toBe('1.1')
      expect(parsed.endpoints.status_handler).toBe('https://codeworkout.org/api/passport/v1/status')
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
    it('validates full extension request payload with all three dates', () => {
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
          original_available_from: '2026-09-01T00:00:00Z',
          new_available_from: '2026-09-01T00:00:00Z',
          original_due_date: '2026-09-10T23:59:59Z',
          new_due_date: '2026-09-11T23:59:59Z',
          original_accept_until: '2026-09-12T23:59:59Z',
          new_accept_until: '2026-09-13T23:59:59Z',
          applied_at: '2026-09-09T12:00:00Z'
        }
      }
      expect(passPortExtensionPayloadSchema.parse(payload)).toEqual(payload)
    })

    it('validates extension-only payload where new_due_date is null and accepts explicit nulls', () => {
      const payload = {
        request_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        context: {
          lms_instance_guid: 'guid-123',
          issuer: 'https://canvas.instructure.com',
          lti_context_id: 'course-ctx-456'
        },
        user: {
          lti_user_id: 'user-sub-789'
        },
        resource: {
          lti_resource_link_id: 'res-link-101'
        },
        extension: {
          pass_type: 'EXTENSION_ONLY_PASS',
          original_available_from: null,
          new_available_from: null,
          original_due_date: '2026-09-10T23:59:59Z',
          new_due_date: null,
          original_accept_until: '2026-09-12T23:59:59Z',
          new_accept_until: '2026-09-14T23:59:59Z',
          applied_at: '2026-09-09T12:00:00Z'
        }
      }
      const parsed = passPortExtensionPayloadSchema.parse(payload)
      expect(parsed.extension.new_due_date).toBeNull()
      expect(parsed.extension.new_accept_until).toBe('2026-09-14T23:59:59Z')
      expect(parsed.extension.original_available_from).toBeNull()
    })

    it('defaults omitted/missing date fields to null', () => {
      const payload = {
        request_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        context: {
          lms_instance_guid: 'guid-123',
          issuer: 'https://canvas.instructure.com',
          lti_context_id: 'course-ctx-456'
        },
        user: {
          lti_user_id: 'user-sub-789'
        },
        resource: {
          lti_resource_link_id: 'res-link-101'
        },
        extension: {
          pass_type: '24_HOUR_PASS',
          applied_at: '2026-09-09T12:00:00Z'
        }
      }
      const parsed = passPortExtensionPayloadSchema.parse(payload)
      expect(parsed.extension.original_available_from).toBeNull()
      expect(parsed.extension.new_available_from).toBeNull()
      expect(parsed.extension.original_due_date).toBeNull()
      expect(parsed.extension.new_due_date).toBeNull()
      expect(parsed.extension.original_accept_until).toBeNull()
      expect(parsed.extension.new_accept_until).toBeNull()
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

  describe('normalizePassPortExtensionUrl', () => {
    it('rewrites Web-CAT /wa/passport/v1/extension to /wa/passport/extension', () => {
      const input =
        'https://web-cat.cs.vt.edu/Web-CAT/WebObjects/Web-CAT.woa/wa/passport/v1/extension'
      const expected =
        'https://web-cat.cs.vt.edu/Web-CAT/WebObjects/Web-CAT.woa/wa/passport/extension'
      expect(normalizePassPortExtensionUrl(input)).toBe(expected)
    })

    it('rewrites Web-CAT /wa/passport/v1/extensions with trailing s to /wa/passport/extension', () => {
      const input =
        'https://web-cat.cs.vt.edu/Web-CAT/WebObjects/Web-CAT.woa/wa/passport/v1/extensions'
      const expected =
        'https://web-cat.cs.vt.edu/Web-CAT/WebObjects/Web-CAT.woa/wa/passport/extension'
      expect(normalizePassPortExtensionUrl(input)).toBe(expected)
    })

    it('trims leading/trailing whitespace', () => {
      const input =
        '  https://web-cat.cs.vt.edu/Web-CAT/WebObjects/Web-CAT.woa/wa/passport/v1/extension  '
      const expected =
        'https://web-cat.cs.vt.edu/Web-CAT/WebObjects/Web-CAT.woa/wa/passport/extension'
      expect(normalizePassPortExtensionUrl(input)).toBe(expected)
    })

    it('leaves standard PassPort v1 endpoints unchanged', () => {
      const standardUrl = 'https://codeworkout.org/api/passport/v1/extension'
      expect(normalizePassPortExtensionUrl(standardUrl)).toBe(standardUrl)
    })
  })

  describe('normalizePassPortStatusUrl', () => {
    it('rewrites Web-CAT /wa/passport/v1/status to /wa/passport/status', () => {
      const input = 'https://web-cat.cs.vt.edu/Web-CAT/WebObjects/Web-CAT.woa/wa/passport/v1/status'
      const expected = 'https://web-cat.cs.vt.edu/Web-CAT/WebObjects/Web-CAT.woa/wa/passport/status'
      expect(normalizePassPortStatusUrl(input)).toBe(expected)
    })

    it('trims whitespace', () => {
      const input =
        '  https://web-cat.cs.vt.edu/Web-CAT/WebObjects/Web-CAT.woa/wa/passport/status  '
      expect(normalizePassPortStatusUrl(input)).toBe(
        'https://web-cat.cs.vt.edu/Web-CAT/WebObjects/Web-CAT.woa/wa/passport/status'
      )
    })
  })

  describe('PassPort v1.2 Status Query Payload Schema', () => {
    it('validates status query request payload', () => {
      const payload = {
        context: {
          lms_instance_guid: 'stable-guid-1',
          issuer: 'https://canvas.vt.edu',
          lti_context_id: 'course-1'
        },
        user: {
          lti_user_id: 'user-sub-1',
          email: 'student@vt.edu'
        },
        resource: {
          lti_resource_link_id: 'link-1'
        }
      }
      expect(passPortStatusPayloadSchema.parse(payload)).toEqual(payload)
    })
  })

  describe('PassPort v1.2 Status Response Schemas & toCachedSubmissionStatus', () => {
    it('normalizes status response when latest and grading submission differ', () => {
      const payload = {
        status: 'ok',
        submission_for_grading: {
          timestamp: '2026-10-25T14:32:00Z',
          submission_number: 3,
          total_score: 88.5,
          ta_score: 18.0,
          staff_notice: '<p>Inspection Needed</p>',
          grading_url: 'https://web-cat.org/grading/3',
          feedback_url: 'https://web-cat.org/feedback/3'
        },
        most_recent_submission: {
          timestamp: '2026-10-26T09:15:00Z',
          submission_number: 4,
          total_score: 92.0,
          ta_score: null,
          staff_notice: null,
          grading_url: 'https://web-cat.org/grading/4',
          feedback_url: 'https://web-cat.org/feedback/4'
        }
      }

      const parsed = passPortStatusResponseSchema.parse(payload)
      const cached = toCachedSubmissionStatus(parsed)

      expect(cached.latestSubmissionUrl).toBe('https://web-cat.org/grading/4')
      expect(cached.latestSubmissionNumber).toBe(4)
      expect(cached.latestTotalScore).toBe(92.0)
      expect(cached.gradingSubmissionUrl).toBe('https://web-cat.org/grading/3')
      expect(cached.gradingSubmissionNumber).toBe(3)
      expect(cached.gradingTotalScore).toBe(88.5)
      expect(cached.staffNotice).toBe('<p>Inspection Needed</p>')
    })

    it('normalizes status response when only submission_for_grading is present', () => {
      const payload = {
        status: 'ok',
        submission_for_grading: {
          timestamp: '2026-10-25T14:32:00Z',
          submission_number: 2,
          total_score: 75.0,
          ta_score: null,
          staff_notice: null,
          direct_url_grading: 'https://web-cat.org/edit?id=2',
          direct_url_feedback: 'https://web-cat.org/view?id=2'
        }
      }

      const parsed = passPortStatusResponseSchema.parse(payload)
      const cached = toCachedSubmissionStatus(parsed)

      expect(cached.latestSubmissionUrl).toBe('https://web-cat.org/edit?id=2')
      expect(cached.latestSubmissionNumber).toBe(2)
      expect(cached.latestTotalScore).toBe(75.0)
      expect(cached.gradingSubmissionUrl).toBeNull()
      expect(cached.gradingSubmissionNumber).toBeNull()
      expect(cached.staffNotice).toBeNull()
    })

    it('handles student with no submissions', () => {
      const payload = {
        status: 'ok',
        submission_for_grading: null
      }

      const parsed = passPortStatusResponseSchema.parse(payload)
      const cached = toCachedSubmissionStatus(parsed)

      expect(cached.latestSubmissionUrl).toBeNull()
      expect(cached.latestSubmissionNumber).toBeNull()
      expect(cached.gradingSubmissionUrl).toBeNull()
    })
  })
})

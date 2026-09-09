import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createHmac } from 'node:crypto'
import {
  signPassPortRequest,
  buildPassPortExtensionPayload,
  sendPassPortExtension,
  sendPassPortRollback
} from '../../../../server/utils/passport'
import {
  passPortExtensionPayloadSchema,
  type PassPortExtensionPayload
} from '../../../../shared/models/passport'

describe('PassPort Extension Dispatch Utilities', () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('$fetch', mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('signPassPortRequest', () => {
    it('generates a valid HMAC-SHA256 hex signature from payload and secret', () => {
      const secret = 'super-secret-key-123'
      const payload = { test: 'data', count: 42 }
      const fixedTimestamp = 1700000000

      const result = signPassPortRequest(secret, payload, fixedTimestamp)

      const expectedSig = createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex')

      expect(result.signature).toBe(expectedSig)
      expect(result.timestamp).toBe(fixedTimestamp)
    })

    it('handles string input directly without double JSON serialization', () => {
      const secret = 'another-secret'
      const rawString = '{"message":"hello"}'

      const result = signPassPortRequest(secret, rawString)

      const expectedSig = createHmac('sha256', secret).update(rawString).digest('hex')
      expect(result.signature).toBe(expectedSig)
      expect(result.timestamp).toBeGreaterThan(0)
    })
  })

  describe('buildPassPortExtensionPayload', () => {
    const baseParams = {
      context: {
        lmsInstanceGuid: 'canvas.example.edu',
        issuer: 'https://canvas.example.edu',
        ltiContextId: 'course-ctx-77',
        lmsInstance: 'Virginia Tech Canvas',
        ltiDeploymentId: 'deploy-88',
        canvasCourseId: 12345
      },
      user: {
        ltiUserId: 'lti-user-999',
        brokerUserId: 'usr_cuid123',
        canvasUserId: 54321,
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.edu',
        displayName: 'Ada Lovelace',
        courseRole: 'StudentEnrollment'
      },
      resource: {
        ltiResourceLinkId: 'resource-link-444',
        brokerAssignmentId: 'asg_cuid456',
        canvasAssignmentId: 9876,
        title: 'Project 1: Assembler',
        externalUrl: 'https://tools.example.edu/asg/1'
      },
      extension: {
        passType: 'Late Pass',
        originalAvailableFrom: new Date('2026-09-01T00:00:00Z'),
        newAvailableFrom: new Date('2026-09-01T00:00:00Z'),
        originalDueDate: new Date('2026-09-10T23:59:00Z'),
        newDueDate: new Date('2026-09-12T23:59:00Z'),
        originalAcceptUntil: new Date('2026-09-13T23:59:00Z'),
        newAcceptUntil: new Date('2026-09-15T23:59:00Z'),
        appliedAt: new Date('2026-09-08T12:00:00Z')
      }
    }

    it('filters out optional properties when requestedProperties is null or empty', () => {
      const payload = buildPassPortExtensionPayload({
        ...baseParams,
        requestedProperties: []
      })

      // Baseline context
      expect(payload.context.lms_instance_guid).toBe('canvas.example.edu')
      expect(payload.context.issuer).toBe('https://canvas.example.edu')
      expect(payload.context.lti_context_id).toBe('course-ctx-77')
      expect((payload.context as any).canvas_course_id).toBeUndefined()
      expect((payload.context as any).lms_instance).toBeUndefined()

      // Baseline user
      expect(payload.user.lti_user_id).toBe('lti-user-999')
      expect((payload.user as any).email).toBeUndefined()
      expect((payload.user as any).first_name).toBeUndefined()
      expect((payload.user as any).last_name).toBeUndefined()
      expect((payload.user as any).canvas_user_id).toBeUndefined()

      // Baseline resource
      expect(payload.resource.lti_resource_link_id).toBe('resource-link-444')
      expect((payload.resource as any).title).toBeUndefined()
      expect((payload.resource as any).canvas_assignment_id).toBeUndefined()

      // Extension is always complete with all three dates
      expect(payload.extension.pass_type).toBe('Late Pass')
      expect(payload.extension.original_available_from).toBe('2026-09-01T00:00:00.000Z')
      expect(payload.extension.new_available_from).toBe('2026-09-01T00:00:00.000Z')
      expect(payload.extension.original_due_date).toBe('2026-09-10T23:59:00.000Z')
      expect(payload.extension.new_due_date).toBe('2026-09-12T23:59:00.000Z')
      expect(payload.extension.original_accept_until).toBe('2026-09-13T23:59:00.000Z')
      expect(payload.extension.new_accept_until).toBe('2026-09-15T23:59:00.000Z')
      expect(payload.extension.applied_at).toBe('2026-09-08T12:00:00.000Z')

      // Schema validity
      expect(() => passPortExtensionPayloadSchema.parse(payload)).not.toThrow()
    })

    it('handles extension-only passes with null newDueDate and advanced newAcceptUntil', () => {
      const payload = buildPassPortExtensionPayload({
        ...baseParams,
        extension: {
          passType: 'Extension Only Pass',
          originalDueDate: new Date('2026-09-10T23:59:00Z'),
          newDueDate: null,
          originalAcceptUntil: new Date('2026-09-12T23:59:00Z'),
          newAcceptUntil: new Date('2026-09-14T23:59:00Z'),
          appliedAt: new Date('2026-09-08T12:00:00Z')
        }
      })

      expect(payload.extension.new_due_date).toBeNull()
      expect(payload.extension.new_accept_until).toBe('2026-09-14T23:59:00.000Z')
      expect(payload.extension.original_available_from).toBeNull()
      expect(payload.extension.new_available_from).toBeNull()
      expect(() => passPortExtensionPayloadSchema.parse(payload)).not.toThrow()
    })

    it('strictly includes optional properties when explicitly requested', () => {
      const payload = buildPassPortExtensionPayload({
        ...baseParams,
        requestedProperties: [
          'canvas_course_id',
          'email',
          'first_name',
          'last_name',
          'title',
          'canvas_assignment_id'
        ]
      })

      expect(payload.context.canvas_course_id).toBe('12345')
      expect((payload.context as any).lms_instance).toBeUndefined() // not requested

      expect(payload.user.email).toBe('ada@example.edu')
      expect(payload.user.first_name).toBe('Ada')
      expect(payload.user.last_name).toBe('Lovelace')
      expect((payload.user as any).displayName).toBeUndefined()

      expect(payload.resource.title).toBe('Project 1: Assembler')
      expect(payload.resource.canvas_assignment_id).toBe('9876')
      expect((payload.resource as any).external_url).toBeUndefined()

      expect(() => passPortExtensionPayloadSchema.parse(payload)).not.toThrow()
    })

    it('uses custom requestId if provided, otherwise generates a valid UUID v4', () => {
      const customId = '550e8400-e29b-41d4-a716-446655440000'
      const payloadWithCustom = buildPassPortExtensionPayload({
        ...baseParams,
        requestId: customId
      })
      expect(payloadWithCustom.request_id).toBe(customId)

      const payloadGenerated = buildPassPortExtensionPayload(baseParams)
      expect(payloadGenerated.request_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      )
    })
  })

  describe('sendPassPortExtension', () => {
    const validTool = {
      passportExtensionUrl: 'https://tool.example.edu/api/passport/v1/extensions',
      passportClientId: 'client-id-xyz',
      passportClientSecret: 'client-secret-abc'
    }

    const mockPayload: PassPortExtensionPayload = {
      request_id: '550e8400-e29b-41d4-a716-446655440000',
      context: {
        lms_instance_guid: 'lms.guid',
        issuer: 'https://lms.edu',
        lti_context_id: 'course-1'
      },
      user: {
        lti_user_id: 'user-1'
      },
      resource: {
        lti_resource_link_id: 'res-1'
      },
      extension: {
        pass_type: 'Late Pass',
        original_due_date: '2026-09-10T23:59:00Z',
        new_due_date: '2026-09-12T23:59:00Z',
        applied_at: '2026-09-08T12:00:00Z'
      }
    }

    it('sends signed POST request with correct headers and payload', async () => {
      mockFetch.mockResolvedValueOnce({ success: true })

      await sendPassPortExtension(validTool, mockPayload)

      expect(mockFetch).toHaveBeenCalledWith(
        'https://tool.example.edu/api/passport/v1/extensions',
        expect.objectContaining({
          method: 'POST',
          body: mockPayload,
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-PassPort-Client-ID': 'client-id-xyz',
            'X-PassPort-Signature': expect.any(String),
            'X-PassPort-Timestamp': expect.any(String)
          }),
          timeout: 10000
        })
      )
    })

    it('throws error if tool is missing passportExtensionUrl or credentials', async () => {
      await expect(
        sendPassPortExtension({ ...validTool, passportExtensionUrl: null }, mockPayload)
      ).rejects.toThrow('Tool is missing passportExtensionUrl')

      await expect(
        sendPassPortExtension({ ...validTool, passportClientId: null }, mockPayload)
      ).rejects.toThrow('Tool is missing PassPort credentials')

      await expect(
        sendPassPortExtension({ ...validTool, passportClientSecret: null }, mockPayload)
      ).rejects.toThrow('Tool is missing PassPort credentials')
    })

    it('propagates HTTP or network errors thrown by $fetch', async () => {
      mockFetch.mockRejectedValueOnce(new Error('500 Internal Server Error'))

      await expect(sendPassPortExtension(validTool, mockPayload)).rejects.toThrow(
        '500 Internal Server Error'
      )
    })
  })

  describe('sendPassPortRollback', () => {
    const validTool = {
      passportExtensionUrl: 'https://tool.example.edu/api/passport/v1/extensions',
      passportClientId: 'client-id-xyz',
      passportClientSecret: 'client-secret-abc'
    }
    const requestId = '550e8400-e29b-41d4-a716-446655440000'

    it('sends signed DELETE request with request_id payload', async () => {
      mockFetch.mockResolvedValueOnce({ success: true })

      await sendPassPortRollback(validTool, requestId)

      expect(mockFetch).toHaveBeenCalledWith(
        'https://tool.example.edu/api/passport/v1/extensions',
        expect.objectContaining({
          method: 'DELETE',
          body: { request_id: requestId },
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-PassPort-Client-ID': 'client-id-xyz',
            'X-PassPort-Signature': expect.any(String),
            'X-PassPort-Timestamp': expect.any(String)
          }),
          timeout: 10000
        })
      )
    })

    it('throws error if tool is missing credentials or extension url', async () => {
      await expect(
        sendPassPortRollback({ ...validTool, passportExtensionUrl: undefined }, requestId)
      ).rejects.toThrow('Tool is missing passportExtensionUrl')

      await expect(
        sendPassPortRollback({ ...validTool, passportClientSecret: null }, requestId)
      ).rejects.toThrow('Tool is missing PassPort credentials')
    })
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@@/server/utils/db'
import {
  buildPassPortStatusPayload,
  resolveToolStatusUrl,
  queryPassPortSubmissionStatus,
  refreshReservationSubmissionStatus,
  refreshBatchReservationSubmissionStatus
} from '../../../../server/utils/passport'

vi.mock('@@/server/utils/db', () => ({
  default: {
    gtaInterviewReservation: {
      findUnique: vi.fn(),
      update: vi.fn()
    }
  }
}))

const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

describe('PassPort Status Query Client Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('resolveToolStatusUrl', () => {
    it('returns normalized passportStatusUrl when explicitly configured', () => {
      const tool = {
        passportStatusUrl:
          'https://web-cat.cs.vt.edu/Web-CAT/WebObjects/Web-CAT.woa/wa/passport/v1/status',
        passportExtensionUrl:
          'https://web-cat.cs.vt.edu/Web-CAT/WebObjects/Web-CAT.woa/wa/passport/v1/extension'
      }
      expect(resolveToolStatusUrl(tool)).toBe(
        'https://web-cat.cs.vt.edu/Web-CAT/WebObjects/Web-CAT.woa/wa/passport/status'
      )
    })

    it('derives status url from passportExtensionUrl when passportStatusUrl is missing', () => {
      const tool = {
        passportExtensionUrl: 'https://codeworkout.org/api/passport/v1/extension'
      }
      expect(resolveToolStatusUrl(tool)).toBe('https://codeworkout.org/api/passport/v1/status')
    })

    it('returns null if neither url is provided', () => {
      expect(resolveToolStatusUrl({})).toBeNull()
    })
  })

  describe('buildPassPortStatusPayload', () => {
    const baseParams = {
      context: {
        lmsInstanceGuid: 'guid-123',
        issuer: 'https://canvas.vt.edu',
        ltiContextId: 'course-1',
        lmsInstance: 'Canvas VT',
        canvasCourseId: 456
      },
      user: {
        ltiUserId: 'sub-789',
        brokerUserId: 'usr-1',
        email: 'student@vt.edu',
        firstName: 'Jane',
        lastName: 'Doe'
      },
      resource: {
        ltiResourceLinkId: 'res-link-001',
        brokerAssignmentId: 'asg-1',
        canvasAssignmentId: 999,
        title: 'Project 1'
      }
    }

    it('builds payload with baseline mandatory fields when requestedProperties is empty', () => {
      const payload = buildPassPortStatusPayload({
        ...baseParams,
        requestedProperties: []
      })

      expect(payload).toEqual({
        context: {
          lms_instance_guid: 'guid-123',
          issuer: 'https://canvas.vt.edu',
          lti_context_id: 'course-1'
        },
        user: {
          lti_user_id: 'sub-789'
        },
        resource: {
          lti_resource_link_id: 'res-link-001'
        }
      })
    })

    it('includes optional fields when permitted by requestedProperties', () => {
      const payload = buildPassPortStatusPayload({
        ...baseParams,
        requestedProperties: ['email', 'canvas_course_id', 'canvas_assignment_id', 'title']
      })

      expect(payload.user.email).toBe('student@vt.edu')
      expect(payload.context.canvas_course_id).toBe('456')
      expect(payload.resource.canvas_assignment_id).toBe('999')
      expect(payload.resource.title).toBe('Project 1')
      expect(payload.user.first_name).toBeUndefined()
    })
  })

  describe('queryPassPortSubmissionStatus', () => {
    const tool = {
      passportClientId: 'broker-client-001',
      passportClientSecret: 'super-secret-key',
      passportStatusUrl: 'https://web-cat.org/api/passport/v1/status'
    }

    const params = {
      context: {
        lmsInstanceGuid: 'guid-1',
        issuer: 'https://canvas.vt.edu',
        ltiContextId: 'course-1'
      },
      user: {
        ltiUserId: 'student-sub-1',
        email: 'student@vt.edu'
      },
      resource: {
        ltiResourceLinkId: 'resource-link-1'
      },
      requestedProperties: ['email']
    }

    it('sends signed POST request and transforms multi-submission response', async () => {
      const remoteResponse = {
        status: 'ok',
        submission_for_grading: {
          timestamp: '2026-10-25T14:32:00Z',
          submission_number: 3,
          total_score: 88.5,
          ta_score: 18.0,
          staff_notice: '<p>Inspection Needed</p>',
          grading_url: 'https://web-cat.org/edit?id=3',
          feedback_url: 'https://web-cat.org/view?id=3'
        },
        most_recent_submission: {
          timestamp: '2026-10-26T09:15:00Z',
          submission_number: 4,
          total_score: 92.0,
          ta_score: null,
          staff_notice: null,
          grading_url: 'https://web-cat.org/edit?id=4',
          feedback_url: 'https://web-cat.org/view?id=4'
        }
      }

      mockFetch.mockResolvedValue(remoteResponse)

      const result = await queryPassPortSubmissionStatus(tool, params)

      expect(mockFetch).toHaveBeenCalledWith(
        'https://web-cat.org/api/passport/v1/status',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-PassPort-Client-ID': 'broker-client-001',
            'X-PassPort-Signature': expect.any(String),
            'X-PassPort-Timestamp': expect.any(String)
          }),
          body: expect.objectContaining({
            context: expect.any(Object),
            user: expect.objectContaining({ email: 'student@vt.edu' }),
            resource: expect.any(Object)
          })
        })
      )

      expect(result).not.toBeNull()
      expect(result!.latestSubmissionUrl).toBe('https://web-cat.org/edit?id=4')
      expect(result!.latestSubmissionNumber).toBe(4)
      expect(result!.latestTotalScore).toBe(92.0)
      expect(result!.gradingSubmissionUrl).toBe('https://web-cat.org/edit?id=3')
      expect(result!.gradingSubmissionNumber).toBe(3)
      expect(result!.gradingTotalScore).toBe(88.5)
      expect(result!.gradingTaScore).toBe(18.0)
      expect(result!.staffNotice).toBe('<p>Inspection Needed</p>')
    })

    it('transforms single submission response where latest and grading submission are identical', async () => {
      const remoteResponse = {
        status: 'ok',
        submission_for_grading: {
          timestamp: '2026-10-25T14:32:00Z',
          submission_number: 1,
          total_score: 100,
          ta_score: 20,
          staff_notice: null,
          direct_url_grading: 'https://web-cat.org/grade/1',
          direct_url_feedback: 'https://web-cat.org/feed/1'
        }
      }

      mockFetch.mockResolvedValue(remoteResponse)

      const result = await queryPassPortSubmissionStatus(tool, params)

      expect(result).not.toBeNull()
      expect(result!.latestSubmissionUrl).toBe('https://web-cat.org/grade/1')
      expect(result!.latestSubmissionNumber).toBe(1)
      expect(result!.gradingSubmissionUrl).toBeNull()
    })

    it('handles student with no submissions', async () => {
      mockFetch.mockResolvedValue({
        status: 'ok',
        submission_for_grading: null
      })

      const result = await queryPassPortSubmissionStatus(tool, params)

      expect(result).not.toBeNull()
      expect(result!.latestSubmissionUrl).toBeNull()
      expect(result!.gradingSubmissionUrl).toBeNull()
    })

    it('returns null gracefully when external tool request fails or times out', async () => {
      mockFetch.mockRejectedValue(new Error('Network timeout after 10000ms'))

      const result = await queryPassPortSubmissionStatus(tool, params)
      expect(result).toBeNull()
    })

    it('returns null if tool is missing credentials or status URL', async () => {
      expect(await queryPassPortSubmissionStatus({ passportStatusUrl: null }, params)).toBeNull()
      expect(
        await queryPassPortSubmissionStatus(
          { passportStatusUrl: 'https://tool.com/status', passportClientId: null },
          params
        )
      ).toBeNull()
    })
  })

  describe('refreshReservationSubmissionStatus', () => {
    const mockReservation = {
      id: 'res-1',
      assignmentId: 'asg-1',
      studentId: 'usr-1',
      gtaId: 'gta-1',
      assignment: {
        id: 'asg-1',
        title: 'Project 1',
        resourceLinkId: 'link-1',
        canvasAssignmentId: '101',
        tool: {
          id: 'tool-1',
          supportsPassport: true,
          passportClientId: 'client-id-123',
          passportClientSecret: 'secret-key-456',
          passportStatusUrl: 'https://web-cat.org/passport/status',
          platformId: 'plat-1'
        },
        course: {
          id: 'course-1',
          ltiContextId: 'canvas-course-10',
          canvasCourseId: '10',
          deployment: {
            deploymentId: 'dep-1',
            deploymentHost: 'canvas.vt.edu',
            platform: {
              issuer: 'https://canvas.vt.edu',
              name: 'Canvas'
            }
          }
        }
      },
      student: {
        id: 'usr-1',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@vt.edu',
        avatarUrl: null,
        ltiIdentities: [
          {
            platformId: 'plat-1',
            ltiSub: 'canvas-sub-123',
            platformUserId: '987'
          }
        ]
      },
      gta: {
        id: 'gta-1',
        firstName: 'Bob',
        lastName: 'Smith',
        email: 'bob@vt.edu'
      }
    }

    it('throws 404 when reservation is not found', async () => {
      vi.mocked(prisma.gtaInterviewReservation.findUnique).mockResolvedValue(null)

      await expect(refreshReservationSubmissionStatus('missing-res')).rejects.toThrowError(
        expect.objectContaining({ statusCode: 404 })
      )
    })

    it('updates only timestamp when tool does not support PassPort', async () => {
      vi.mocked(prisma.gtaInterviewReservation.findUnique).mockResolvedValue({
        ...mockReservation,
        assignment: {
          ...mockReservation.assignment,
          tool: null
        }
      } as any)

      vi.mocked(prisma.gtaInterviewReservation.update).mockResolvedValue({
        id: 'res-1',
        submissionStatusCheckedAt: new Date()
      } as any)

      const result = await refreshReservationSubmissionStatus('res-1')

      expect(prisma.gtaInterviewReservation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'res-1' },
          data: expect.objectContaining({
            submissionStatusCheckedAt: expect.any(Date)
          })
        })
      )
      expect(mockFetch).not.toHaveBeenCalled()
      expect(result.id).toBe('res-1')
    })

    it('queries external tool, saves parsed status, and updates timestamp', async () => {
      vi.mocked(prisma.gtaInterviewReservation.findUnique).mockResolvedValue(mockReservation as any)
      mockFetch.mockResolvedValue({
        status: 'ok',
        most_recent_submission: {
          submission_number: 2,
          direct_url_grading: 'https://web-cat.org/grading/2'
        }
      })
      vi.mocked(prisma.gtaInterviewReservation.update).mockResolvedValue({
        id: 'res-1',
        submissionStatus: {
          latestSubmissionUrl: 'https://web-cat.org/grading/2',
          latestSubmissionNumber: 2
        },
        submissionStatusCheckedAt: new Date()
      } as any)

      const result = await refreshReservationSubmissionStatus('res-1')

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(prisma.gtaInterviewReservation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'res-1' },
          data: expect.objectContaining({
            submissionStatus: expect.objectContaining({
              latestSubmissionUrl: 'https://web-cat.org/grading/2',
              latestSubmissionNumber: 2
            }),
            submissionStatusCheckedAt: expect.any(Date)
          })
        })
      )
      expect(result.id).toBe('res-1')
    })

    it('retains existing submissionStatus when external query fails (resilience)', async () => {
      vi.mocked(prisma.gtaInterviewReservation.findUnique).mockResolvedValue(mockReservation as any)
      mockFetch.mockRejectedValue(new Error('500 Internal Server Error'))
      vi.mocked(prisma.gtaInterviewReservation.update).mockResolvedValue({
        id: 'res-1',
        submissionStatusCheckedAt: new Date()
      } as any)

      await refreshReservationSubmissionStatus('res-1')

      expect(prisma.gtaInterviewReservation.update).toHaveBeenCalledWith({
        where: { id: 'res-1' },
        data: {
          submissionStatusCheckedAt: expect.any(Date)
        },
        include: expect.any(Object)
      })
    })
  })

  describe('refreshBatchReservationSubmissionStatus', () => {
    it('concurrently refreshes multiple reservations and returns successful updates', async () => {
      vi.mocked(prisma.gtaInterviewReservation.findUnique).mockImplementation((args: any) => {
        if (args.where.id === 'res-1') {
          return Promise.resolve({
            id: 'res-1',
            assignment: { tool: null },
            student: { ltiIdentities: [] }
          } as any)
        }
        return Promise.resolve(null)
      })

      vi.mocked(prisma.gtaInterviewReservation.update).mockResolvedValue({
        id: 'res-1',
        submissionStatusCheckedAt: new Date()
      } as any)

      const results = await refreshBatchReservationSubmissionStatus(['res-1', 'res-missing'])

      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('res-1')
    })
  })
})

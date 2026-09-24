import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  sendAdminAlert,
  notifyPassRedemption,
  notifyCbtfScheduleSuccess,
  notifyCbtfScheduleFailure,
  notifyProctorNote
} from '../../../../server/services/alert.service'

describe('Alert Service (ntfy)', () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('$fetch', mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('sendAdminAlert', () => {
    it('returns false and does not call $fetch if topic is empty', async () => {
      vi.stubGlobal('useRuntimeConfig', () => ({
        ntfy: {
          serverUrl: 'https://ntfy.sh',
          topic: '',
          token: '',
          priority: 'default',
          alertOnRedemption: false
        }
      }))

      const result = await sendAdminAlert({ message: 'Hello admin' })

      expect(result).toBe(false)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('sends alert with default headers to configured topic', async () => {
      vi.stubGlobal('useRuntimeConfig', () => ({
        ntfy: {
          serverUrl: 'https://ntfy.sh',
          topic: 'egp-broker-admin',
          token: '',
          priority: 'default',
          alertOnRedemption: false
        }
      }))

      mockFetch.mockResolvedValueOnce({ id: '123' })

      const result = await sendAdminAlert({
        title: 'System Alert',
        message: 'Something happened'
      })

      expect(result).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith('https://ntfy.sh/egp-broker-admin', {
        method: 'POST',
        body: 'Something happened',
        headers: {
          Title: 'System Alert',
          Priority: 'default'
        }
      })
    })

    it('includes optional headers like tags, clickUrl, authorization token, and custom priority', async () => {
      vi.stubGlobal('useRuntimeConfig', () => ({
        ntfy: {
          serverUrl: 'https://ntfy.example.com/',
          topic: 'alerts-topic',
          token: 'secret-token-123',
          priority: 'low',
          alertOnRedemption: true
        }
      }))

      mockFetch.mockResolvedValueOnce({ id: '456' })

      const result = await sendAdminAlert({
        title: 'Critical Issue',
        message: 'Database disk full',
        priority: 'urgent',
        tags: ['warning', 'skull'],
        clickUrl: 'https://broker.example.com/admin'
      })

      expect(result).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith('https://ntfy.example.com/alerts-topic', {
        method: 'POST',
        body: 'Database disk full',
        headers: {
          Title: 'Critical Issue',
          Priority: 'urgent',
          Tags: 'warning,skull',
          Click: 'https://broker.example.com/admin',
          Authorization: 'Bearer secret-token-123'
        }
      })
    })

    it('catches fetch errors gracefully and returns false without throwing', async () => {
      vi.stubGlobal('useRuntimeConfig', () => ({
        ntfy: {
          serverUrl: 'https://ntfy.sh',
          topic: 'egp-broker-admin',
          token: '',
          priority: 'default',
          alertOnRedemption: false
        }
      }))

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockFetch.mockRejectedValueOnce(new Error('Network offline'))

      const result = await sendAdminAlert({ message: 'Test message' })

      expect(result).toBe(false)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ntfy] Failed to send admin alert:'),
        'Network offline'
      )
      consoleErrorSpy.mockRestore()
    })
  })

  describe('notifyPassRedemption', () => {
    it('does not send alert if alertOnRedemption is disabled', async () => {
      vi.stubGlobal('useRuntimeConfig', () => ({
        ntfy: {
          serverUrl: 'https://ntfy.sh',
          topic: 'egp-broker-admin',
          token: '',
          priority: 'default',
          alertOnRedemption: false
        }
      }))

      const result = await notifyPassRedemption({
        userName: 'Alice Student',
        userEmail: 'alice@vt.edu',
        passTypeName: 'Extension Pass',
        assignmentTitle: 'Project 1',
        cost: 1
      })

      expect(result).toBe(false)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('sends formatted redemption alert when alertOnRedemption is enabled', async () => {
      vi.stubGlobal('useRuntimeConfig', () => ({
        ntfy: {
          serverUrl: 'https://ntfy.sh',
          topic: 'egp-broker-admin',
          token: '',
          priority: 'default',
          alertOnRedemption: true
        }
      }))

      mockFetch.mockResolvedValueOnce({ id: '789' })

      const newDueDate = new Date('2026-08-30T23:59:00Z')

      const result = await notifyPassRedemption({
        userName: 'Alice Student',
        userEmail: 'alice@vt.edu',
        passTypeName: 'Extension Pass',
        assignmentTitle: 'Project 1',
        cost: 2,
        courseName: 'CS 1114',
        newDueDate
      })

      expect(result).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith('https://ntfy.sh/egp-broker-admin', {
        method: 'POST',
        body: expect.stringContaining(
          'Alice Student (alice@vt.edu) redeemed 2 Extension Pass pass(es) for "Project 1" in CS 1114.'
        ),
        headers: expect.objectContaining({
          Title: 'Pass Redeemed: Extension Pass',
          Tags: 'ticket,admission_tickets'
        })
      })
    })

    it('handles string "true" for alertOnRedemption environment variable', async () => {
      vi.stubGlobal('useRuntimeConfig', () => ({
        ntfy: {
          serverUrl: 'https://ntfy.sh',
          topic: 'egp-broker-admin',
          token: '',
          priority: 'default',
          alertOnRedemption: 'true' as any
        }
      }))

      mockFetch.mockResolvedValueOnce({ id: '789' })

      const result = await notifyPassRedemption({
        userEmail: 'bob@vt.edu',
        passTypeName: 'Late Pass',
        assignmentTitle: 'Homework 2',
        cost: 1
      })

      expect(result).toBe(true)
      expect(mockFetch).toHaveBeenCalled()
    })
  })

  describe('notifyCbtfScheduleSuccess', () => {
    it('formats and sends alert when student schedules CBTF exam slot', async () => {
      vi.stubGlobal('useRuntimeConfig', () => ({
        ntfy: {
          serverUrl: 'https://ntfy.sh',
          topic: 'egp-broker-admin',
          token: ''
        }
      }))

      mockFetch.mockResolvedValueOnce({ id: 'cbtf-1' })

      const result = await notifyCbtfScheduleSuccess({
        studentName: 'Alice Student',
        studentEmail: 'alice@vt.edu',
        studentId: '906000001',
        assignmentTitle: 'Midterm 1',
        courseLabel: 'CS 1114',
        startTime: '2026-10-05T10:00:00.000Z',
        endTime: '2026-10-05T11:00:00.000Z',
        seatNumber: 12,
        facilityName: 'Main CBTF'
      })

      expect(result).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith('https://ntfy.sh/egp-broker-admin', {
        method: 'POST',
        body: expect.stringContaining(
          'Alice Student <alice@vt.edu> [ID: 906000001] scheduled a CBTF exam slot for "Midterm 1" in CS 1114.'
        ),
        headers: expect.objectContaining({
          Title: 'CBTF Slot Scheduled: Midterm 1',
          Priority: 'default',
          Tags: 'calendar,cbtf,white_check_mark'
        })
      })
    })

    it('formats reschedule action when isReschedule is true', async () => {
      vi.stubGlobal('useRuntimeConfig', () => ({
        ntfy: {
          serverUrl: 'https://ntfy.sh',
          topic: 'egp-broker-admin',
          token: ''
        }
      }))

      mockFetch.mockResolvedValueOnce({ id: 'cbtf-2' })

      const result = await notifyCbtfScheduleSuccess({
        studentEmail: 'bob@vt.edu',
        assignmentTitle: 'Final Exam',
        startTime: '2026-10-06T14:00:00.000Z',
        isReschedule: true
      })

      expect(result).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith('https://ntfy.sh/egp-broker-admin', {
        method: 'POST',
        body: expect.stringContaining(
          '<bob@vt.edu> rescheduled a CBTF exam slot for "Final Exam".'
        ),
        headers: expect.objectContaining({
          Title: 'CBTF Slot Rescheduled: Final Exam',
          Priority: 'default'
        })
      })
    })
  })

  describe('notifyCbtfScheduleFailure', () => {
    it('formats and sends high-priority alert with error type, message, and location', async () => {
      vi.stubGlobal('useRuntimeConfig', () => ({
        ntfy: {
          serverUrl: 'https://ntfy.sh',
          topic: 'egp-broker-admin',
          token: ''
        }
      }))

      mockFetch.mockResolvedValueOnce({ id: 'err-1' })

      const result = await notifyCbtfScheduleFailure({
        studentName: 'Charlie Brown',
        studentEmail: 'charlie@vt.edu',
        studentId: '906000002',
        assignmentTitle: 'Quiz 3',
        courseLabel: 'CS 2114',
        timeSlot: '2026-10-05T10:00:00.000Z',
        errorType: 'HTTP 409 (ConflictError)',
        errorMessage: 'Arrival capacity reached for this 5-minute time slot (maximum 4 arrivals)',
        errorLocation: 'server/api/me/cbtf/reservations.post.ts (Arrival Throttle Limit Check)',
        isReschedule: false
      })

      expect(result).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith('https://ntfy.sh/egp-broker-admin', {
        method: 'POST',
        body: expect.stringContaining(
          'Failed CBTF schedule attempt by Charlie Brown <charlie@vt.edu> [ID: 906000002]\nAssignment: "Quiz 3" in CS 2114.'
        ),
        headers: expect.objectContaining({
          Title: 'CBTF Scheduling Error: Quiz 3',
          Priority: 'high',
          Tags: 'warning,cbtf,x,rotating_light'
        })
      })

      // Check details in message body
      const callBody = mockFetch.mock.calls[0][1].body
      expect(callBody).toContain('Error Type: HTTP 409 (ConflictError)')
      expect(callBody).toContain('Message: Arrival capacity reached for this 5-minute time slot')
      expect(callBody).toContain(
        'Location: server/api/me/cbtf/reservations.post.ts (Arrival Throttle Limit Check)'
      )
    })
  })

  describe('notifyProctorNote', () => {
    it('formats and sends alert when a proctor enters an observation note', async () => {
      vi.stubGlobal('useRuntimeConfig', () => ({
        ntfy: {
          serverUrl: 'https://ntfy.sh',
          topic: 'egp-broker-admin',
          token: ''
        }
      }))

      mockFetch.mockResolvedValueOnce({ id: 'note-alert-1' })

      const result = await notifyProctorNote({
        studentName: 'Alice Smith',
        studentEmail: 'asmith@vt.edu',
        studentId: '906000001',
        assignmentTitle: 'Midterm Exam 1',
        courseLabel: 'CS 2114',
        startTime: '2026-10-15T14:00:00.000Z',
        seatNumber: 12,
        authorName: 'Proctor Pat',
        content: 'Student attempted to use notes on desk',
        hasPhotos: true
      })

      expect(result).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith('https://ntfy.sh/egp-broker-admin', {
        method: 'POST',
        body: expect.stringContaining('Alice Smith <asmith@vt.edu> [ID: 906000001]'),
        headers: expect.objectContaining({
          Title: expect.stringContaining('Midterm Exam 1'),
          Priority: 'default',
          Tags: expect.stringContaining('cbtf')
        })
      })

      const callBody = mockFetch.mock.calls[0][1].body
      expect(callBody).toContain('Midterm Exam 1')
      expect(callBody).toContain('2026-10-15T14:00:00.000Z')
      expect(callBody).toContain('Student attempted to use notes on desk')
      expect(callBody).toContain('Seat: #12')
      expect(callBody).toContain('Proctor: Proctor Pat')
    })

    it('handles minimal fields with fallbacks gracefully', async () => {
      vi.stubGlobal('useRuntimeConfig', () => ({
        ntfy: {
          serverUrl: 'https://ntfy.sh',
          topic: 'egp-broker-admin',
          token: ''
        }
      }))

      mockFetch.mockResolvedValueOnce({ id: 'note-alert-2' })

      const result = await notifyProctorNote({
        startTime: new Date('2026-10-15T14:00:00.000Z'),
        content: 'Brief observation note'
      })

      expect(result).toBe(true)
      const callBody = mockFetch.mock.calls[0][1].body
      expect(callBody).toContain('A student')
      expect(callBody).toContain('2026-10-15T14:00:00.000Z')
      expect(callBody).toContain('Brief observation note')
    })
  })
})

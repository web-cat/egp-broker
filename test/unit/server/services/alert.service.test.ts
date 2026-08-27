import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sendAdminAlert, notifyPassRedemption } from '../../../../server/services/alert.service'

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
})

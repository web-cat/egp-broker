import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { notifyPassPortSyncFailure } from '../../../../server/services/alert.service'

describe('PassPort Sync Failure Alerting (ntfy)', () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('$fetch', mockFetch)
    vi.stubGlobal('useRuntimeConfig', () => ({
      ntfy: {
        serverUrl: 'https://ntfy.sh',
        topic: 'egp-broker-admin',
        token: '',
        priority: 'default',
        alertOnRedemption: false
      }
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends an urgent alert with complete student, course, tool, error, and requestId details', async () => {
    mockFetch.mockResolvedValueOnce({ id: 'alert-1' })

    const result = await notifyPassPortSyncFailure({
      toolName: 'CodeRunner',
      assignmentTitle: 'Project 2',
      courseLabel: 'CS 2114',
      studentName: 'Jane Doe',
      studentEmail: 'jdoe@vt.edu',
      error: 'HTTP 500: Internal Server Error on extension endpoint',
      requestId: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d'
    })

    expect(result).toBe(true)
    expect(mockFetch).toHaveBeenCalledWith('https://ntfy.sh/egp-broker-admin', {
      method: 'POST',
      body:
        'PassPort extension sync failed for Jane Doe (jdoe@vt.edu) in CS 2114 on assignment "Project 2" with external tool "CodeRunner".\n' +
        'Error: HTTP 500: Internal Server Error on extension endpoint (Request ID: 9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d)',
      headers: {
        Title: 'PassPort Sync Failure: CodeRunner',
        Priority: 'urgent',
        Tags: 'warning,passport,rotating_light'
      }
    })
  })

  it('handles fallback when optional student identity or course label is missing', async () => {
    mockFetch.mockResolvedValueOnce({ id: 'alert-2' })

    const result = await notifyPassPortSyncFailure({
      toolName: 'Web-CAT',
      assignmentTitle: 'Lab 1',
      error: 'Connection timed out after 10000ms'
    })

    expect(result).toBe(true)
    expect(mockFetch).toHaveBeenCalledWith('https://ntfy.sh/egp-broker-admin', {
      method: 'POST',
      body:
        'PassPort extension sync failed for A student on assignment "Lab 1" with external tool "Web-CAT".\n' +
        'Error: Connection timed out after 10000ms',
      headers: {
        Title: 'PassPort Sync Failure: Web-CAT',
        Priority: 'urgent',
        Tags: 'warning,passport,rotating_light'
      }
    })
  })

  it('returns false gracefully when alert sending encounters an error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network down'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await notifyPassPortSyncFailure({
      toolName: 'PrairieLearn',
      assignmentTitle: 'Exam 1',
      error: '502 Bad Gateway'
    })

    expect(result).toBe(false)
    consoleSpy.mockRestore()
  })
})

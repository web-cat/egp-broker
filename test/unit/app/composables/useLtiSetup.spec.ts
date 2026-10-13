import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useLtiSetup } from '../../../../app/composables/features/useLtiSetup'

const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

describe('useLtiSetup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetchLtiTools gets /api/lti13/tools', async () => {
    mockFetch.mockResolvedValueOnce([{ id: 't-1' }])
    const { fetchLtiTools } = useLtiSetup()

    const tools = await fetchLtiTools()
    expect(mockFetch).toHaveBeenCalledWith('/api/lti13/tools')
    expect(tools).toEqual([{ id: 't-1' }])
  })

  it('fetchProxyGradeTranslations gets /api/proxy/grade-translations', async () => {
    mockFetch.mockResolvedValueOnce([{ id: 'gt-1' }])
    const { fetchProxyGradeTranslations } = useLtiSetup()

    const trans = await fetchProxyGradeTranslations()
    expect(mockFetch).toHaveBeenCalledWith('/api/proxy/grade-translations')
    expect(trans).toEqual([{ id: 'gt-1' }])
  })

  it('configureAssignment posts to /api/assignments/:id/configure', async () => {
    mockFetch.mockResolvedValueOnce({ success: true })
    const { configureAssignment } = useLtiSetup()

    await configureAssignment('a-1', { toolId: 't-1', gradeTranslationId: null })
    expect(mockFetch).toHaveBeenCalledWith('/api/assignments/a-1/configure', {
      method: 'POST',
      body: { toolId: 't-1', gradeTranslationId: null }
    })
  })
})

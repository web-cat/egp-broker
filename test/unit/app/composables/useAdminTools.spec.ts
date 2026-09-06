import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useAdminTools } from '@@/app/composables/features/admin/useAdminTools'

describe('useAdminTools', () => {
  const mockFetch = vi.fn()
  const mockUseFetch = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('$fetch', mockFetch)
    vi.stubGlobal('useFetch', mockUseFetch)
  })

  it('fetchTools calls useFetch with /api/admin/tools and platformId query if provided', () => {
    mockUseFetch.mockReturnValue({
      data: ref({ data: [] }),
      status: ref('idle'),
      refresh: vi.fn()
    })

    const { fetchTools } = useAdminTools()

    fetchTools()
    expect(mockUseFetch).toHaveBeenCalledWith('/api/admin/tools', {
      lazy: true,
      query: {}
    })

    fetchTools('plat-123')
    expect(mockUseFetch).toHaveBeenCalledWith('/api/admin/tools', {
      lazy: true,
      query: { p: 'plat-123' }
    })
  })

  it('saveTool dispatches POST when creating a new tool without id', async () => {
    mockFetch.mockResolvedValue({
      data: { id: 'tool-new', name: 'New Tool' }
    })

    const { saveTool } = useAdminTools()
    const state = { name: 'New Tool', baseUrl: 'https://example.com' }

    const result = await saveTool(state)

    expect(mockFetch).toHaveBeenCalledWith('/api/admin/tools', {
      method: 'POST',
      body: state
    })
    expect(result.data.id).toBe('tool-new')
  })

  it('saveTool dispatches PATCH when updating an existing tool with id', async () => {
    mockFetch.mockResolvedValue({
      data: { id: 'tool-1', name: 'Updated Tool' }
    })

    const { saveTool } = useAdminTools()
    const state = { name: 'Updated Tool' }

    const result = await saveTool(state, 'tool-1')

    expect(mockFetch).toHaveBeenCalledWith('/api/admin/tools/tool-1', {
      method: 'PATCH',
      body: state
    })
    expect(result.data.id).toBe('tool-1')
  })

  it('deleteTool dispatches DELETE with tool id', async () => {
    mockFetch.mockResolvedValue({ success: true })

    const { deleteTool } = useAdminTools()
    await deleteTool('tool-1')

    expect(mockFetch).toHaveBeenCalledWith('/api/admin/tools/tool-1', {
      method: 'DELETE'
    })
  })

  it('registerPassPort dispatches POST to /api/admin/tools/:id/passport/register', async () => {
    mockFetch.mockResolvedValue({
      data: {
        id: 'tool-1',
        passportRegistrationStatus: 'PENDING'
      }
    })

    const { registerPassPort } = useAdminTools()
    const result = await registerPassPort('tool-1')

    expect(mockFetch).toHaveBeenCalledWith('/api/admin/tools/tool-1/passport/register', {
      method: 'POST'
    })
    expect(result.data.passportRegistrationStatus).toBe('PENDING')
  })
})

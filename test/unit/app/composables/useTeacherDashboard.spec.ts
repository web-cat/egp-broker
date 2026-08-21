import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, computed } from 'vue'

// Import after hoisting
import { useTeacherDashboard } from '../../../../app/composables/features/useTeacherDashboard'

const { mockCrudData, mockSyncData, mockRefreshSync, mockFetch } = vi.hoisted(() => {
  return {
    mockCrudData: {
      value: {
        data: []
      }
    },
    mockSyncData: {
      value: {
        data: {
          canSync: false,
          platformName: 'Canvas'
        }
      }
    },
    mockRefreshSync: vi.fn(),
    mockFetch: vi.fn()
  }
})

// Mock dependencies
const mockToast = { add: vi.fn() }
vi.stubGlobal('useToast', () => mockToast)
vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('$fetch', mockFetch)

vi.stubGlobal('useFetch', () => ({
  data: mockSyncData,
  status: ref('idle'),
  refresh: mockRefreshSync
}))

vi.mock('~/composables/features/admin/useAdminCrud', () => ({
  useAdminCrud: () => ({
    data: mockCrudData,
    status: ref('idle'),
    editOpen: ref(false),
    editingItem: ref(null),
    tableKey: ref(0),
    refresh: vi.fn().mockResolvedValue(undefined),
    openCreate: vi.fn(),
    openEdit: vi.fn(),
    openDelete: vi.fn(),
    onRowUpdated: vi.fn(),
    onRowDeleted: vi.fn(),
    onItemCreated: vi.fn()
  })
}))

describe('useTeacherDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSyncData.value = {
      data: {
        canSync: false,
        platformName: 'Canvas'
      }
    }
  })

  it('provides initial sync status and modal controls', () => {
    const dashboard = useTeacherDashboard()

    expect(dashboard.canSync.value).toBe(false)
    expect(dashboard.platformName.value).toBe('Canvas')
    expect(dashboard.apiKeyModalOpen.value).toBe(false)

    dashboard.openApiKeyModal()
    expect(dashboard.apiKeyModalOpen.value).toBe(true)

    dashboard.closeApiKeyModal()
    expect(dashboard.apiKeyModalOpen.value).toBe(false)
  })

  it('saves API key and triggers assignment sync upon success', async () => {
    const dashboard = useTeacherDashboard()
    dashboard.openApiKeyModal()

    mockFetch.mockResolvedValueOnce({ statusCode: 200, data: { success: true } }) // POST platform-key
    mockFetch.mockResolvedValueOnce({ data: [{ id: 'a1', title: 'New Assignment' }] }) // POST assignments/sync

    await dashboard.saveApiKey('test-canvas-key')

    expect(mockFetch).toHaveBeenCalledWith('/api/me/platform-key', {
      method: 'POST',
      body: { apiKey: 'test-canvas-key' }
    })
    expect(mockRefreshSync).toHaveBeenCalled()
    expect(dashboard.apiKeyModalOpen.value).toBe(false)
    expect(mockToast.add).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'API key saved',
        color: 'success'
      })
    )
  })

  it('handles error when saving API key fails', async () => {
    const dashboard = useTeacherDashboard()
    mockFetch.mockRejectedValueOnce({
      data: { message: 'Invalid token' }
    })

    await expect(dashboard.saveApiKey('invalid-key')).rejects.toBeDefined()
    expect(mockToast.add).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Failed to save API key',
        color: 'error'
      })
    )
  })
})

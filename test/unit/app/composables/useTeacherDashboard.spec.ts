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

  it('resyncs CBTF Canvas overrides successfully with summary toast', async () => {
    const dashboard = useTeacherDashboard()
    const mockAssignment: any = { id: 'asg-1', title: 'Quiz 1', isSchedulable: true }

    mockFetch.mockResolvedValueOnce({
      statusCode: 200,
      data: {
        totalChecked: 3,
        matched: 1,
        updated: 2,
        created: 0,
        errors: 0,
        details: []
      }
    })

    await dashboard.resyncAssignmentCbtfOverrides(mockAssignment)

    expect(mockFetch).toHaveBeenCalledWith('/api/me/assignments/asg-1/cbtf-sync-overrides', {
      method: 'POST'
    })
    expect(mockToast.add).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Canvas Overrides Synced',
        description: 'Checked 3 reservations; 2 overrides changed/created.',
        color: 'success'
      })
    )
  })

  it('displays neutral toast when no active CBTF reservations are found', async () => {
    const dashboard = useTeacherDashboard()
    const mockAssignment: any = { id: 'asg-2', title: 'Quiz 2', isSchedulable: true }

    mockFetch.mockResolvedValueOnce({
      statusCode: 200,
      data: {
        totalChecked: 0,
        matched: 0,
        updated: 0,
        created: 0,
        changedOrCreated: 0,
        errors: 0,
        details: []
      }
    })

    await dashboard.resyncAssignmentCbtfOverrides(mockAssignment)

    expect(mockToast.add).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Canvas Overrides Synced',
        description: 'Checked 0 reservations; 0 overrides changed/created.',
        color: 'success'
      })
    )
  })

  it('handles error when resyncing CBTF Canvas overrides fails', async () => {
    const dashboard = useTeacherDashboard()
    const mockAssignment: any = { id: 'asg-3', title: 'Quiz 3', isSchedulable: true }

    mockFetch.mockRejectedValueOnce({
      data: { message: 'Failed to communicate with Canvas' }
    })

    await dashboard.resyncAssignmentCbtfOverrides(mockAssignment)

    expect(mockToast.add).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Failed to Sync Canvas Overrides',
        color: 'error'
      })
    )
  })

  it('displays warning toast with seats reassigned and conflicts notes when present', async () => {
    const dashboard = useTeacherDashboard()
    const mockAssignment: any = { id: 'asg-4', title: 'Quiz 4', isSchedulable: true }

    mockFetch.mockResolvedValueOnce({
      statusCode: 200,
      data: {
        totalChecked: 2,
        matched: 0,
        updated: 1,
        created: 0,
        changedOrCreated: 1,
        seatsReassigned: 1,
        conflicts: 1,
        errors: 0,
        details: []
      }
    })

    await dashboard.resyncAssignmentCbtfOverrides(mockAssignment)

    expect(mockToast.add).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Canvas Overrides Synced',
        description:
          'Checked 2 reservations; 1 override changed/created. (1 seat reassigned, 1 conflict)',
        color: 'warning'
      })
    )
  })

  it('handles repairAssignmentCbtfTimezones success and shows toast with reassigned seats', async () => {
    const dashboard = useTeacherDashboard()
    const mockAssignment: any = { id: 'asg-5', title: 'Midterm', isSchedulable: true }

    mockFetch.mockResolvedValueOnce({
      statusCode: 200,
      data: {
        totalChecked: 52,
        totalRepaired: 44,
        seatsReassigned: 5,
        alreadyCorrect: 8,
        conflicts: 0,
        errors: 0,
        details: []
      }
    })

    await dashboard.repairAssignmentCbtfTimezones(mockAssignment)

    expect(mockFetch).toHaveBeenCalledWith('/api/me/assignments/asg-5/cbtf-repair-timezone', {
      method: 'POST'
    })
    expect(mockToast.add).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'CBTF Timezones Repaired',
        description:
          'Checked 52 reservations; 44 repaired. (5 seats reassigned, 8 already correct)',
        color: 'success'
      })
    )
  })

  it('handles repairAssignmentGtaTimezones success and shows toast with repaired count', async () => {
    const dashboard = useTeacherDashboard()
    const mockAssignment: any = { id: 'asg-gta', title: 'Project 1 Interview', hasInterviews: true }

    mockFetch.mockResolvedValueOnce({
      statusCode: 200,
      data: {
        totalChecked: 10,
        totalRepaired: 8,
        alreadyCorrect: 2,
        conflicts: 0,
        errors: 0,
        details: []
      }
    })

    await dashboard.repairAssignmentGtaTimezones(mockAssignment)

    expect(mockFetch).toHaveBeenCalledWith('/api/me/assignments/asg-gta/gta-repair-timezone', {
      method: 'POST'
    })
    expect(mockToast.add).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'GTA Timezones Repaired',
        description: 'Checked 10 reservations; 8 repaired. (2 already correct)',
        color: 'success'
      })
    )
  })
})

import type { PassTypeData } from '@@/shared/models/pass'
import type { AssignmentRow } from '@@/shared/models/assignment'
import type { SyncStatusResponse } from '@@/shared/schemas/sync.schema'
import { useAdminCrud } from '~/composables/features/admin/useAdminCrud'

export const useTeacherDashboard = () => {
  const toast = useToast()

  // --- Pass Types Data ---
  const {
    data: passTypesData,
    status: passTypesStatus,
    editOpen: passTypeEditOpen,
    editingItem: editingPassType,
    tableKey: passTypesTableKey,
    openCreate: openPassTypeCreate,
    openEdit: openPassTypeEdit,
    onRowUpdated: onPassTypeRowUpdated,
    onItemCreated: onPassTypeItemCreated
  } = useAdminCrud<PassTypeData>('/api/me/pass-types')

  // --- Assignments Data ---
  const {
    data: assignmentsData,
    status: assignmentsStatus,
    editOpen: assignmentEditOpen,
    editingItem: editingAssignment,
    tableKey: assignmentsTableKey,
    refresh: refreshAssignments,
    openCreate: openAssignmentCreate,
    openEdit: openAssignmentEdit,
    onRowUpdated: onAssignmentRowUpdated,
    onItemCreated: onAssignmentItemCreated
  } = useAdminCrud<AssignmentRow>('/api/me/assignments')

  // --- Sync Logic ---
  const { data: syncStatus, refresh: refreshSyncStatus } = useFetch<{ data: SyncStatusResponse }>(
    '/api/me/sync-status',
    {
      lazy: true
    }
  )

  const canSync = computed(() => syncStatus.value?.data?.canSync ?? false)
  const platformName = computed(() => syncStatus.value?.data?.platformName || 'Canvas')
  const syncing = ref(false)
  const apiKeyModalOpen = ref(false)
  const isSavingApiKey = ref(false)

  const openApiKeyModal = () => {
    apiKeyModalOpen.value = true
  }

  const closeApiKeyModal = () => {
    apiKeyModalOpen.value = false
  }

  const syncAssignments = async (promptConfirm = true) => {
    if (
      promptConfirm &&
      !confirm('This will fetch assignments from the LMS and update the list. Continue?')
    )
      return

    syncing.value = true
    try {
      const res = await $fetch<{ data: any[] }>('/api/me/assignments/sync', {
        method: 'POST'
      })

      // Update local data and re-fetch
      if (assignmentsData.value) {
        assignmentsData.value.data = res.data
      }
      await refreshAssignments()

      toast.add({
        title: 'Assignments synced',
        description: `Successfully synchronized ${res.data?.length ?? 0} assignment(s) from Canvas.`,
        color: 'success'
      })
    } catch (err: any) {
      console.error(err)
      toast.add({
        title: 'Sync failed',
        description: err.data?.message || err.data?.statusMessage || err.message,
        color: 'error'
      })
    } finally {
      syncing.value = false
    }
  }

  const saveApiKey = async (apiKey: string) => {
    isSavingApiKey.value = true
    try {
      await $fetch('/api/me/platform-key', {
        method: 'POST',
        body: { apiKey }
      })

      await refreshSyncStatus()
      apiKeyModalOpen.value = false

      toast.add({
        title: 'API key saved',
        description: 'Syncing is now enabled. Fetching assignments...',
        color: 'success'
      })

      // Automatically sync assignments after saving key without secondary confirmation prompt
      await syncAssignments(false)
    } catch (err: any) {
      console.error(err)
      toast.add({
        title: 'Failed to save API key',
        description:
          err.data?.statusMessage ||
          err.data?.message ||
          err.message ||
          'An unexpected error occurred.',
        color: 'error'
      })
      throw err
    } finally {
      isSavingApiKey.value = false
    }
  }

  return {
    // Pass Types
    passTypesData,
    passTypesStatus,
    passTypeEditOpen,
    editingPassType,
    passTypesTableKey,
    openPassTypeCreate,
    openPassTypeEdit,
    onPassTypeRowUpdated,
    onPassTypeItemCreated,

    // Assignments
    assignmentsData,
    assignmentsStatus,
    assignmentEditOpen,
    editingAssignment,
    assignmentsTableKey,
    openAssignmentCreate,
    openAssignmentEdit,
    onAssignmentRowUpdated,
    onAssignmentItemCreated,

    // Sync & API Key
    canSync,
    platformName,
    syncing,
    apiKeyModalOpen,
    isSavingApiKey,
    openApiKeyModal,
    closeApiKeyModal,
    saveApiKey,
    syncAssignments
  }
}

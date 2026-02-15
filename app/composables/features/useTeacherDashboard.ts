import type { PassTypeData } from '@@/shared/models/pass'
import type { AssignmentRow } from '@@/shared/models/assignment'

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
    openCreate: openAssignmentCreate,
    openEdit: openAssignmentEdit,
    onRowUpdated: onAssignmentRowUpdated,
    onItemCreated: onAssignmentItemCreated
  } = useAdminCrud<AssignmentRow>('/api/me/assignments')

  // --- Sync Logic ---
  const { data: syncStatus } = useFetch<{ data: { canSync: boolean } }>('/api/me/sync-status', {
    lazy: true
  })

  const canSync = computed(() => syncStatus.value?.data?.canSync ?? false)
  const syncing = ref(false)

  const syncAssignments = async () => {
    if (!confirm('This will fetch assignments from the LMS and update the list. Continue?')) return

    syncing.value = true
    try {
      const { data } = await $fetch<{ data: any[] }>('/api/me/assignments/sync', {
        method: 'POST'
      })

      // Update local data if available
      if (assignmentsData.value) {
        assignmentsData.value.data = data
      }

      toast.add({ title: 'Assignments synced successfully', color: 'success' })
    } catch (err: any) {
      console.error(err)
      toast.add({
        title: 'Sync failed',
        description: err.data?.message || err.message,
        color: 'error'
      })
    } finally {
      syncing.value = false
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

    // Sync
    canSync,
    syncing,
    syncAssignments
  }
}

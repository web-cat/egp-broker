import type { ApiResponse } from '@@/shared/types/api'

interface HasId {
  id: string
}

/**
 * Composable for standard admin CRUD page state management.
 *
 * Encapsulates data fetching, edit panel state, in-place row updates,
 * and full refetch on creation — the pattern shared by all admin model pages.
 *
 * @param url - The API endpoint URL (e.g. '/api/admin/courses')
 * @param queryParams - Optional reactive query parameters for filtering
 */
export function useAdminCrud<T extends HasId>(
  url: string,
  queryParams?: Record<string, Ref<string | undefined> | ComputedRef<string | undefined>>
) {
  const { data, status, refresh } = useFetch<ApiResponse<T[]>>(url, {
    lazy: true,
    query: queryParams
  })

  const editOpen = ref(false)
  const editingItem = ref<T | null>(null) as Ref<T | null>
  const tableKey = ref(0)

  function openCreate() {
    editingItem.value = null
    editOpen.value = true
  }

  function openEdit(item: T) {
    editingItem.value = item
    editOpen.value = true
  }

  function onRowUpdated(id: string, updates: Partial<T>) {
    const rows = data.value?.data
    if (!rows) return
    const idx = rows.findIndex((r) => r.id === id)
    if (idx !== -1) {
      rows[idx] = { ...rows[idx], ...updates }
      tableKey.value++
    }
  }

  async function onItemCreated() {
    // Build a plain query object from the reactive params
    const resolvedQuery: Record<string, string | undefined> = {}
    if (queryParams) {
      for (const [key, val] of Object.entries(queryParams)) {
        resolvedQuery[key] = unref(val)
      }
    }
    const fresh = await $fetch<ApiResponse<T[]>>(url, { query: resolvedQuery })
    data.value = fresh
    tableKey.value++
  }

  return {
    data,
    status,
    editOpen,
    editingItem,
    tableKey,
    openCreate,
    openEdit,
    onRowUpdated,
    onItemCreated,
    refresh
  }
}

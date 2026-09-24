import { ref, watch } from 'vue'
import type { ApiResponse, ApiPagination } from '@@/shared/types/api'
import type { CbtfAdminReservationNoteDto } from '@@/shared/models/cbtf'

export interface UseAdminCbtfNotesOptions {
  endpoint?: string
}

export function useAdminCbtfNotes(options: UseAdminCbtfNotesOptions = {}) {
  const toast = useToast()
  const endpoint = options.endpoint || '/api/admin/cbtf/notes'

  const studentFilter = ref('')
  const assignmentFilter = ref('')
  const courseFilter = ref('')
  const dateFrom = ref('')
  const dateTo = ref('')
  const page = ref(1)
  const pageSize = ref(20)

  const notes = ref<CbtfAdminReservationNoteDto[]>([])
  const pagination = ref<ApiPagination>({
    total: 0,
    page: 1,
    pageSize: 20,
    totalPages: 1
  })
  const loading = ref(false)
  const error = ref<Error | null>(null)

  const fetchNotes = async () => {
    loading.value = true
    error.value = null

    try {
      const params = new URLSearchParams()
      if (studentFilter.value.trim()) {
        params.append('student', studentFilter.value.trim())
      }
      if (assignmentFilter.value.trim()) {
        params.append('assignment', assignmentFilter.value.trim())
      }
      if (courseFilter.value.trim()) {
        params.append('course', courseFilter.value.trim())
      }
      if (dateFrom.value) {
        params.append('from', dateFrom.value)
      }
      if (dateTo.value) {
        params.append('to', dateTo.value)
      }

      params.append('page', String(page.value))
      params.append('pageSize', String(pageSize.value))

      const url = `${endpoint}?${params.toString()}`
      const res = await $fetch<ApiResponse<CbtfAdminReservationNoteDto[]>>(url)

      notes.value = res.data || []
      pagination.value = res.pagination || {
        total: notes.value.length,
        page: page.value,
        pageSize: pageSize.value,
        totalPages: Math.max(1, Math.ceil((notes.value.length || 0) / pageSize.value))
      }
    } catch (err: any) {
      error.value = err
      toast.add({
        title: 'Failed to load reservation notes',
        description: err.data?.message || err.data?.statusMessage || err.message,
        color: 'error'
      })
    } finally {
      loading.value = false
    }
  }

  const resetFilters = () => {
    studentFilter.value = ''
    assignmentFilter.value = ''
    courseFilter.value = ''
    dateFrom.value = ''
    dateTo.value = ''
    page.value = 1
    fetchNotes()
  }

  watch(page, () => {
    fetchNotes()
  })

  return {
    studentFilter,
    assignmentFilter,
    courseFilter,
    dateFrom,
    dateTo,
    page,
    pageSize,
    notes,
    pagination,
    loading,
    error,
    fetchNotes,
    resetFilters
  }
}

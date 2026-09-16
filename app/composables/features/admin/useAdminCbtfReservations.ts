import { ref, watch } from 'vue'
import type { ApiResponse, ApiPagination } from '@@/shared/types/api'
import type { CbtfReservationDto } from '@@/shared/models/cbtf'
import type { CbtfAdminUpdateReservationInput } from '@@/shared/schemas/cbtf.schema'

export function useAdminCbtfReservations() {
  const toast = useToast()

  const search = ref('')
  const status = ref('ALL')
  const startDateFrom = ref('')
  const startDateTo = ref('')
  const upcomingOnly = ref(true)
  const page = ref(1)
  const pageSize = ref(50)

  const reservations = ref<CbtfReservationDto[]>([])
  const pagination = ref<ApiPagination>({
    total: 0,
    page: 1,
    pageSize: 50,
    totalPages: 1
  })
  const loading = ref(false)
  const error = ref<Error | null>(null)

  const fetchReservations = async () => {
    loading.value = true
    error.value = null

    try {
      const params = new URLSearchParams()
      if (search.value.trim()) {
        params.append('search', search.value.trim())
      }
      if (status.value && status.value !== 'ALL') {
        params.append('status', status.value)
      }
      if (startDateFrom.value) {
        params.append('from', new Date(startDateFrom.value).toISOString())
      }
      if (startDateTo.value) {
        params.append('to', new Date(startDateTo.value).toISOString())
      }
      if (upcomingOnly.value && !startDateFrom.value && !startDateTo.value) {
        params.append('upcomingOnly', 'true')
      } else {
        params.append('upcomingOnly', 'false')
      }

      params.append('page', String(page.value))
      params.append('pageSize', String(pageSize.value))

      const url = `/api/admin/cbtf/reservations?${params.toString()}`
      const res = await $fetch<ApiResponse<CbtfReservationDto[]>>(url)

      reservations.value = res.data || []
      pagination.value = res.pagination || {
        total: reservations.value.length,
        page: page.value,
        pageSize: pageSize.value,
        totalPages: Math.max(1, Math.ceil((reservations.value.length || 0) / pageSize.value))
      }
    } catch (err: any) {
      error.value = err
      toast.add({
        title: 'Failed to load reservations',
        description: err.data?.message || err.data?.statusMessage || err.message,
        color: 'error'
      })
    } finally {
      loading.value = false
    }
  }

  const updateReservation = async (id: string, updates: CbtfAdminUpdateReservationInput) => {
    try {
      const res = await $fetch<ApiResponse<CbtfReservationDto>>(
        `/api/admin/cbtf/reservations/${id}`,
        {
          method: 'PATCH',
          body: updates
        }
      )

      toast.add({
        title: 'Reservation Updated',
        description: 'Changes have been saved and synced to Canvas where applicable.',
        color: 'success'
      })

      await fetchReservations()
      return res.data
    } catch (err: any) {
      toast.add({
        title: 'Update Failed',
        description: err.data?.message || err.data?.statusMessage || err.message,
        color: 'error'
      })
      throw err
    }
  }

  const deleteReservation = async (id: string) => {
    try {
      await $fetch(`/api/admin/cbtf/reservations/${id}`, {
        method: 'DELETE'
      })

      toast.add({
        title: 'Reservation Deleted',
        description: 'Reservation was removed and Canvas assignment override was deleted.',
        color: 'success'
      })

      await fetchReservations()
    } catch (err: any) {
      toast.add({
        title: 'Deletion Failed',
        description: err.data?.message || err.data?.statusMessage || err.message,
        color: 'error'
      })
      throw err
    }
  }

  const resetFilters = () => {
    search.value = ''
    status.value = 'ALL'
    startDateFrom.value = ''
    startDateTo.value = ''
    upcomingOnly.value = true
    page.value = 1
    fetchReservations()
  }

  // Watch page changes to trigger reload
  watch(page, () => {
    fetchReservations()
  })

  return {
    search,
    status,
    startDateFrom,
    startDateTo,
    upcomingOnly,
    page,
    pageSize,
    reservations,
    pagination,
    loading,
    error,
    fetchReservations,
    updateReservation,
    deleteReservation,
    resetFilters
  }
}

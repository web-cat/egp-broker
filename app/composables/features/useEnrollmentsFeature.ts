import type { Ref } from 'vue'
import type { ApiResponse } from '@@/shared/types/api'
import type { SimpleEnrollment } from '@@/shared/models/user'

export function useCurrentEnrollment(options?: {
  immediate?: boolean | Ref<boolean>
  watch?: unknown[]
}) {
  return useFetch<ApiResponse<SimpleEnrollment>>('/api/me/enrollment', {
    immediate: options?.immediate ?? true,
    watch: options?.watch as any
  })
}

export function useAvailableEnrollments(options?: {
  immediate?: boolean | Ref<boolean>
  watch?: unknown[]
}) {
  return useFetch<ApiResponse<SimpleEnrollment[]>>('/api/me/enrollments', {
    immediate: options?.immediate ?? true,
    watch: options?.watch as any
  })
}

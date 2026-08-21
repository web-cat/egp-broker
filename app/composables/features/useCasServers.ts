import type { Ref } from 'vue'

export interface CasServerOption {
  id: string
  name: string
}

export function useCasServers(options?: { immediate?: boolean | Ref<boolean> }) {
  return useFetch<CasServerOption[]>('/api/cas/servers', {
    immediate: options?.immediate ?? true
  })
}

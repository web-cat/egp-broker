import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { useAdminCrud } from '../../../../app/composables/features/admin/useAdminCrud'

// Mock useFetch and $fetch
const mockData = ref({
  data: [
    { id: '1', name: 'Platform 1' },
    { id: '2', name: 'Platform 2' }
  ]
})

vi.stubGlobal('ref', ref)
vi.stubGlobal('useFetch', () => ({
  data: mockData,
  status: ref('idle'),
  refresh: vi.fn()
}))
vi.stubGlobal('$fetch', vi.fn())

describe('useAdminCrud', () => {
  it('opens and closes create and edit panels', () => {
    const crud = useAdminCrud<{ id: string; name: string }>('/api/admin/platforms')

    expect(crud.editOpen.value).toBe(false)
    expect(crud.editingItem.value).toBeNull()

    crud.openCreate()
    expect(crud.editOpen.value).toBe(true)
    expect(crud.editingItem.value).toBeNull()

    crud.openEdit({ id: '1', name: 'Platform 1' })
    expect(crud.editOpen.value).toBe(true)
    expect(crud.editingItem.value).toEqual({ id: '1', name: 'Platform 1' })
  })

  it('manages delete modal state and item', () => {
    const crud = useAdminCrud<{ id: string; name: string }>('/api/admin/platforms')

    expect(crud.deleteOpen.value).toBe(false)
    expect(crud.deletingItem.value).toBeNull()

    crud.openDelete({ id: '2', name: 'Platform 2' })
    expect(crud.deleteOpen.value).toBe(true)
    expect(crud.deletingItem.value).toEqual({ id: '2', name: 'Platform 2' })
  })

  it('removes row on onRowDeleted and increments tableKey', () => {
    const crud = useAdminCrud<{ id: string; name: string }>('/api/admin/platforms')
    const initialKey = crud.tableKey.value

    crud.onRowDeleted('1')

    expect(crud.data.value?.data).toEqual([{ id: '2', name: 'Platform 2' }])
    expect(crud.tableKey.value).toBe(initialKey + 1)
  })
})

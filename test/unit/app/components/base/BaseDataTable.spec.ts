import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseDataTable from '~/components/base/BaseDataTable.vue'

describe('BaseDataTable', () => {
  it('renders empty state when data is empty', () => {
    const wrapper = mount(BaseDataTable, {
      props: {
        data: [],
        columns: [{ accessorKey: 'id', header: 'ID' }],
        emptyText: 'No records found'
      }
    })
    expect(wrapper.text()).toContain('No records found')
  })

  it('renders loading state when loading is true and data is empty', () => {
    const wrapper = mount(BaseDataTable, {
      props: {
        data: [],
        columns: [{ accessorKey: 'id', header: 'ID' }],
        loading: true
      }
    })
    expect(wrapper.html()).toContain('animate-spin')
  })

  it('renders pagination footer when total rows exceed pageSize', () => {
    const data = Array.from({ length: 60 }, (_, i) => ({ id: `row-${i}`, name: `Student ${i}` }))
    const wrapper = mount(BaseDataTable, {
      props: {
        data,
        columns: [{ accessorKey: 'name', header: 'Name' }],
        pageSize: 20
      }
    })
    expect(wrapper.text()).toContain('60 rows')
    expect(wrapper.findComponent({ name: 'UPagination' }).exists()).toBe(true)
  })

  it('does not render pagination footer when total rows fit in a single page', () => {
    const data = Array.from({ length: 15 }, (_, i) => ({ id: `row-${i}`, name: `Student ${i}` }))
    const wrapper = mount(BaseDataTable, {
      props: {
        data,
        columns: [{ accessorKey: 'name', header: 'Name' }],
        pageSize: 20
      }
    })
    expect(wrapper.findComponent({ name: 'UPagination' }).exists()).toBe(false)
  })

  it('provides paginationOptions with getPaginationRowModel to UTable', () => {
    const data = [{ id: '1', name: 'Alice' }]
    const wrapper = mount(BaseDataTable, {
      props: {
        data,
        columns: [{ accessorKey: 'name', header: 'Name' }]
      }
    })
    const uTable = wrapper.findComponent({ name: 'UTable' })
    expect(uTable.exists()).toBe(true)
    expect(uTable.props('paginationOptions')).toBeDefined()
    expect(typeof uTable.props('paginationOptions').getPaginationRowModel).toBe('function')
  })
})

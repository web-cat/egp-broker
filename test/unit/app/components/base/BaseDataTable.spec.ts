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
})

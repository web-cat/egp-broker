import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import CbtfReservationsTable from '~/components/features/cbtf/CbtfReservationsTable.vue'

const mockToastAdd = vi.fn()
vi.stubGlobal('useToast', () => ({ add: mockToastAdd }))

const mockFetchReservations = vi.fn()
const mockResyncCanvas = vi.fn()
const mockResetFilters = vi.fn()

const mockReservations = ref([
  {
    id: 'res-1',
    facilityId: 'fac-1',
    assignmentId: 'asg-1',
    assignmentTitle: 'Algorithms Midterm',
    userId: 'usr-1',
    studentName: 'Alex Carter',
    studentEmail: 'alex@vt.edu',
    studentId: '906888222',
    seatNumber: 8,
    startTime: '2026-10-20T10:00:00.000Z',
    endTime: '2026-10-20T11:00:00.000Z',
    status: 'SCHEDULED' as const,
    canvasOverrideId: 'cov-77'
  }
])

vi.mock('~/composables/features/admin/useAdminCbtfReservations', () => ({
  useAdminCbtfReservations: () => ({
    search: ref(''),
    status: ref('ALL'),
    startDateFrom: ref(''),
    startDateTo: ref(''),
    upcomingOnly: ref(true),
    page: ref(1),
    pageSize: ref(50),
    reservations: mockReservations,
    pagination: ref({ total: 1, page: 1, pageSize: 50, totalPages: 1 }),
    loading: ref(false),
    fetchReservations: mockFetchReservations,
    resyncCanvas: mockResyncCanvas,
    resetFilters: mockResetFilters
  })
}))

const globalStubs = {
  UCard: {
    template: '<div class="card"><slot /><slot name="footer" /></div>'
  },
  UInput: {
    props: ['modelValue', 'placeholder', 'type'],
    template:
      '<input :type="type || \'text\'" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
  },
  USelect: {
    props: ['modelValue', 'items'],
    template: `
      <select :value="modelValue" @change="$emit('update:modelValue', $event.target.value)">
        <option v-for="item in items" :key="item.value" :value="item.value">{{ item.label }}</option>
      </select>
    `
  },
  UBadge: {
    props: ['color'],
    template: '<span class="badge"><slot /></span>'
  },
  UButton: {
    props: ['label', 'icon', 'loading'],
    template: '<button :disabled="loading"><i v-if="icon" :class="icon" />{{ label }}</button>'
  },
  UIcon: {
    props: ['name'],
    template: '<i :class="name" />'
  },
  UPagination: {
    props: ['page', 'total', 'itemsPerPage'],
    template: '<div class="pagination-stub" />'
  }
}

describe('CbtfReservationsTable.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders student info, assignment, seat badge, and canvas sync status', () => {
    const wrapper = mount(CbtfReservationsTable, {
      props: {
        readOnly: true,
        showResyncCanvas: true
      },
      global: {
        stubs: globalStubs
      }
    })

    expect(wrapper.text()).toContain('Alex Carter')
    expect(wrapper.text()).toContain('alex@vt.edu')
    expect(wrapper.text()).toContain('906888222')
    expect(wrapper.text()).toContain('Algorithms Midterm')
    expect(wrapper.text()).toContain('#8')
    expect(wrapper.text()).toContain('#cov-77')
  })

  it('renders only the resync button when readOnly is true', () => {
    const wrapper = mount(CbtfReservationsTable, {
      props: {
        readOnly: true,
        showResyncCanvas: true
      },
      global: {
        stubs: globalStubs
      }
    })

    // No edit or delete buttons should exist
    expect(wrapper.find('button[aria-label="Edit reservation"]').exists()).toBe(false)
    expect(wrapper.find('button[aria-label="Delete reservation"]').exists()).toBe(false)

    // Resync button must exist
    const resyncBtn = wrapper.find('button[aria-label="Resync Canvas Override"]')
    expect(resyncBtn.exists()).toBe(true)
  })

  it('triggers resyncCanvas when resync button is clicked', async () => {
    const wrapper = mount(CbtfReservationsTable, {
      props: {
        readOnly: true,
        showResyncCanvas: true
      },
      global: {
        stubs: globalStubs
      }
    })

    const resyncBtn = wrapper.find('button[aria-label="Resync Canvas Override"]')
    await resyncBtn.trigger('click')

    expect(mockResyncCanvas).toHaveBeenCalledWith('res-1')
  })

  it('renders edit and delete buttons and emits events when readOnly is false', async () => {
    const wrapper = mount(CbtfReservationsTable, {
      props: {
        readOnly: false,
        showResyncCanvas: true
      },
      global: {
        stubs: globalStubs
      }
    })

    const editBtn = wrapper.find('button[aria-label="Edit reservation"]')
    expect(editBtn.exists()).toBe(true)
    await editBtn.trigger('click')
    expect(wrapper.emitted('edit')?.[0][0]).toEqual(mockReservations.value[0])

    const deleteBtn = wrapper.find('button[aria-label="Delete reservation"]')
    expect(deleteBtn.exists()).toBe(true)
    await deleteBtn.trigger('click')
    expect(wrapper.emitted('delete')?.[0][0]).toEqual(mockReservations.value[0])
  })
})

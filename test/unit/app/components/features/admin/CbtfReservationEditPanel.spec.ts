import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import CbtfReservationEditPanel from '~/components/features/admin/CbtfReservationEditPanel.vue'

const globalStubs = {
  USlideover: {
    props: ['open', 'title', 'description'],
    template: '<div v-if="open" class="slideover"><slot name="body" /></div>'
  },
  UFormField: {
    props: ['label', 'name', 'help', 'required'],
    template: '<div class="form-field"><slot /></div>'
  },
  USelect: {
    props: ['modelValue', 'items'],
    template: `
      <select :value="modelValue" @change="$emit('update:modelValue', $event.target.value)">
        <option v-for="item in items" :key="item.value" :value="item.value">{{ item.label }}</option>
      </select>
    `
  },
  UInput: {
    props: ['modelValue', 'type', 'min', 'max', 'placeholder'],
    template:
      '<input :type="type || \'text\'" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
  },
  UButton: {
    props: ['label', 'type', 'loading', 'disabled'],
    template:
      '<button :type="type || \'button\'" :disabled="disabled || loading">{{ label }}</button>'
  },
  UIcon: {
    props: ['name'],
    template: '<i :class="name" />'
  }
}

describe('CbtfReservationEditPanel.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockReservation = {
    id: 'res-100',
    facilityId: 'fac-1',
    assignmentId: 'asg-1',
    assignmentTitle: 'Data Structures Exam 1',
    userId: 'usr-1',
    studentName: 'Morgan Lee',
    studentEmail: 'morgan@vt.edu',
    studentId: '906999888',
    seatNumber: 14,
    startTime: '2026-10-15T14:00:00.000Z',
    endTime: '2026-10-15T15:30:00.000Z',
    status: 'SCHEDULED' as const,
    canvasOverrideId: 'canvas-cov-42',
    checkedInAt: null,
    checkedOutAt: null,
    checkedInByUserId: null,
    checkedOutByUserId: null
  }

  it('renders student details, assignment, and form fields when open', () => {
    const wrapper = mount(CbtfReservationEditPanel, {
      props: {
        open: true,
        reservation: mockReservation
      },
      global: {
        stubs: globalStubs
      }
    })

    expect(wrapper.text()).toContain('Morgan Lee')
    expect(wrapper.text()).toContain('morgan@vt.edu')
    expect(wrapper.text()).toContain('906999888')
    expect(wrapper.text()).toContain('Data Structures Exam 1')
    expect(wrapper.text()).toContain('Canvas override active (#canvas-cov-42)')
  })

  it('emits save event with updated fields on form submit', async () => {
    const wrapper = mount(CbtfReservationEditPanel, {
      props: {
        open: true,
        reservation: mockReservation
      },
      global: {
        stubs: globalStubs
      }
    })

    const select = wrapper.find('select')
    await select.setValue('CHECKED_IN')

    await wrapper.find('form').trigger('submit')

    const emitted = wrapper.emitted('save')
    expect(emitted).toBeTruthy()
    expect(emitted![0][0]).toEqual({
      id: 'res-100',
      data: expect.objectContaining({
        status: 'CHECKED_IN',
        seatNumber: 14
      })
    })
  })

  it('shows cancellation Canvas removal warning when status is changed to CANCELLED', async () => {
    const wrapper = mount(CbtfReservationEditPanel, {
      props: {
        open: true,
        reservation: mockReservation
      },
      global: {
        stubs: globalStubs
      }
    })

    const select = wrapper.find('select')
    await select.setValue('CANCELLED')

    expect(wrapper.text()).toContain(
      'delete the corresponding student assignment override in Canvas'
    )
  })
})

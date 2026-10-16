import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, h } from 'vue'
import TeacherGtaShiftsSection from '~/components/features/teacher/TeacherGtaShiftsSection.vue'

const mockCreateShift = vi.fn()
const mockUpdateShift = vi.fn()
const mockDeleteShift = vi.fn()
const mockPreviewShiftImpact = vi.fn()
const mockBatchGenerateShifts = vi.fn()
const mockUpdateInterviewLocation = vi.fn()
const mockRefreshShifts = vi.fn()

const mockShifts = ref([
  {
    id: 'shift-1',
    courseId: 'course-1',
    userId: 'ta-1',
    date: '2026-09-18T00:00:00.000Z',
    startTime: '10:00',
    endTime: '12:00',
    user: {
      id: 'ta-1',
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice@example.edu',
      avatarUrl: null
    }
  },
  {
    id: 'shift-2',
    courseId: 'course-1',
    userId: 'ta-2',
    date: '2026-09-25T00:00:00.000Z',
    startTime: '13:00',
    endTime: '15:00',
    user: {
      id: 'ta-2',
      firstName: 'Bob',
      lastName: 'Jones',
      email: 'bob@example.edu',
      avatarUrl: null
    }
  }
])

const mockGtas = ref([
  {
    id: 'ta-1',
    firstName: 'Alice',
    lastName: 'Smith',
    email: 'alice@example.edu',
    avatarUrl: null,
    shiftDefinition: 'Tue 2:00–5:00 PM (3.0h), Wed 2:30–5:00 PM (2.5h), Thu 2:30–5:00 PM (2.5h)'
  },
  {
    id: 'ta-2',
    firstName: 'Bob',
    lastName: 'Jones',
    email: 'bob@example.edu',
    avatarUrl: null,
    shiftDefinition: null
  }
])

vi.mock('~/composables/features/useTeacherGtaShifts', () => ({
  useTeacherGtaShifts: () => ({
    shifts: mockShifts,
    shiftsStatus: ref('success'),
    gtas: mockGtas,
    gtasStatus: ref('success'),
    refreshShifts: mockRefreshShifts,
    refreshGtas: vi.fn(),
    createShift: mockCreateShift,
    updateShift: mockUpdateShift,
    deleteShift: mockDeleteShift,
    previewShiftImpact: mockPreviewShiftImpact,
    batchGenerateShifts: mockBatchGenerateShifts,
    updateInterviewLocation: mockUpdateInterviewLocation,
    getShiftDetails: vi.fn(),
    rescheduleInterview: vi.fn(),
    cancelInterview: vi.fn()
  })
}))

vi.stubGlobal('h', h)
vi.stubGlobal('resolveComponent', (name: string) => name)

describe('TeacherGtaShiftsSection component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders section title and current interview location', () => {
    const wrapper = mount(TeacherGtaShiftsSection, {
      props: {
        courseId: 'course-1',
        interviewLocation: 'McBryde 106'
      },
      global: {
        stubs: {
          BaseDataTable: {
            template: '<div data-testid="shifts-table"><slot /></div>',
            props: ['data', 'columns']
          },
          UButton: {
            template: '<button><slot /></button>'
          },
          UBadge: true,
          UIcon: true,
          UInput: true,
          USelect: true,
          UModal: true,
          UFormField: true,
          BaseFormInput: true
        }
      }
    })

    expect(wrapper.text()).toContain('GTA Interviews & Shifts')
    expect(wrapper.text()).toContain('McBryde 106')
  })

  it('allows editing interview location and emits update:location', async () => {
    mockUpdateInterviewLocation.mockResolvedValue('Torgersen 2150')

    const wrapper = mount(TeacherGtaShiftsSection, {
      props: {
        courseId: 'course-1',
        interviewLocation: 'McBryde 106'
      },
      global: {
        stubs: {
          BaseDataTable: true,
          UButton: {
            template: '<button @click="$emit(\'click\')"><slot /></button>'
          },
          UBadge: true,
          UIcon: true,
          UInput: {
            props: ['modelValue'],
            template:
              '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
          },
          USelect: true,
          UModal: true,
          UFormField: true,
          BaseFormInput: true
        }
      }
    })

    // Click "Edit Location" button
    const editBtn = wrapper.find('[data-testid="edit-location-btn"]')
    expect(editBtn.exists()).toBe(true)
    await editBtn.trigger('click')

    // Change location input
    const input = wrapper.find('[data-testid="location-input"]')
    expect(input.exists()).toBe(true)
    await input.setValue('Torgersen 2150')

    // Click save button
    const saveBtn = wrapper.find('[data-testid="save-location-btn"]')
    expect(saveBtn.exists()).toBe(true)
    await saveBtn.trigger('click')

    expect(mockUpdateInterviewLocation).toHaveBeenCalledWith('Torgersen 2150')
    expect(wrapper.emitted('update:location')).toBeTruthy()
    expect(wrapper.emitted('update:location')![0]).toEqual(['Torgersen 2150'])
  })

  it('renders Shift Details & Slots action button and handles delete with impact summary', async () => {
    mockDeleteShift.mockResolvedValue({
      success: true,
      impact: {
        rescheduled: [
          {
            reservationId: 'res-1',
            studentName: 'Bob Student',
            studentEmail: 'bob@vt.edu',
            assignmentTitle: 'Project 1',
            startTime: '2026-10-05T14:00:00.000Z',
            previousGtaName: 'Alice',
            newGtaName: 'Charlie'
          }
        ],
        cancelled: []
      }
    })

    const wrapper = mount(TeacherGtaShiftsSection, {
      props: {
        courseId: 'course-1',
        interviewLocation: 'McBryde 106'
      },
      global: {
        stubs: {
          BaseDataTable: {
            props: ['data', 'columns'],
            template: `
              <div data-testid="table">
                <div v-for="row in data" :key="row.id" class="row">
                  <component :is="columns.find(c => c.id === 'actions')?.cell({ row: { original: row } })" />
                </div>
              </div>
            `
          },
          UButton: {
            props: ['title', 'icon'],
            template:
              '<button :title="title" :data-title="title" @click="$emit(\'click\')"><slot /></button>'
          },
          GtaShiftDetailsModal: {
            props: ['open', 'shiftId'],
            template:
              '<div data-testid="details-modal" :data-open="open" :data-shift-id="shiftId" />'
          },
          GtaShiftImpactModal: {
            props: ['open', 'impact', 'actionType', 'loading'],
            emits: ['confirm', 'update:open'],
            template:
              '<div data-testid="impact-modal" :data-open="open" :data-action-type="actionType"><button data-testid="modal-confirm-btn" @click="$emit(\'confirm\')">Confirm</button></div>'
          },
          UBadge: true,
          UIcon: true,
          UInput: true,
          USelect: true,
          UModal: true,
          UFormField: true,
          BaseFormInput: true
        }
      }
    })

    // Verify Details button is rendered with title "Shift Details & Slots"
    const detailsBtn = wrapper.find('[data-title="Shift Details & Slots"]')
    expect(detailsBtn.exists()).toBe(true)

    // Click Details button
    await detailsBtn.trigger('click')
    const detailsModal = wrapper.find('[data-testid="details-modal"]')
    expect(detailsModal.attributes('data-open')).toBe('true')
    expect(detailsModal.attributes('data-shift-id')).toBe('shift-1')

    mockPreviewShiftImpact.mockResolvedValue({
      rescheduled: [],
      cancelled: [
        {
          reservationId: 'res-1',
          studentId: 's-1',
          studentName: 'Jane Student',
          studentEmail: 'jane@vt.edu',
          assignmentId: 'a-1',
          assignmentTitle: 'Project 1',
          startTime: '2026-09-18T14:00:00.000Z',
          endTime: '2026-09-18T14:10:00.000Z',
          previousGtaId: 'ta-1',
          previousGtaName: 'Alice Smith'
        }
      ]
    })

    // Click Delete button
    const deleteBtn = wrapper.find('[data-title="Delete Shift"]')
    expect(deleteBtn.exists()).toBe(true)
    await deleteBtn.trigger('click')

    // Preview should be called first, NOT delete
    expect(mockPreviewShiftImpact).toHaveBeenCalledWith('shift-1', { isDelete: true })
    expect(mockDeleteShift).not.toHaveBeenCalled()
    await wrapper.vm.$nextTick()

    // Verify pre-confirmation impact modal is opened
    const impactModal = wrapper.find('[data-testid="impact-modal"]')
    expect(impactModal.attributes('data-open')).toBe('true')
    expect(impactModal.attributes('data-action-type')).toBe('delete')

    // Now click confirm in the modal
    const confirmBtn = wrapper.find('[data-testid="modal-confirm-btn"]')
    await confirmBtn.trigger('click')

    // Now deleteShift is called
    expect(mockDeleteShift).toHaveBeenCalledWith('shift-1')
  })

  it('filters shifts by GTA selection, date from, and date to, and supports resetting filters', async () => {
    let capturedData: any = []
    const wrapper = mount(TeacherGtaShiftsSection, {
      props: {
        courseId: 'course-1',
        interviewLocation: 'McBryde 106'
      },
      global: {
        stubs: {
          BaseDataTable: {
            props: ['data', 'columns', 'emptyText'],
            setup(props) {
              return () => {
                capturedData = props.data
                return h('div', { 'data-testid': 'shifts-table', 'data-count': props.data?.length })
              }
            }
          },
          UCard: {
            template: '<div data-testid="card"><slot /></div>'
          },
          UButton: {
            props: ['label', 'disabled', 'icon'],
            template:
              '<button :disabled="disabled" :data-label="label" @click="$emit(\'click\')"><slot>{{ label }}</slot></button>'
          },
          USelect: {
            props: ['modelValue', 'items', 'ariaLabel'],
            emits: ['update:modelValue'],
            template: `
              <select
                :data-testid="ariaLabel"
                :value="modelValue"
                @change="$emit('update:modelValue', $event.target.value)"
              >
                <option v-for="item in items" :key="item.value" :value="item.value">
                  {{ item.label }}
                </option>
              </select>
            `
          },
          UInput: {
            props: ['modelValue', 'type', 'ariaLabel'],
            emits: ['update:modelValue'],
            template: `
              <input
                :data-testid="ariaLabel"
                :type="type"
                :value="modelValue"
                @input="$emit('update:modelValue', $event.target.value)"
              />
            `
          },
          UBadge: true,
          UIcon: true,
          UModal: true,
          UFormField: true,
          BaseFormInput: true
        }
      }
    })

    // Initially all 2 shifts are shown
    expect(capturedData.length).toBe(2)
    const resetBtn = wrapper.find('[data-label="Reset Filters"]')
    expect(resetBtn.attributes('disabled')).toBeDefined()

    // Filter by GTA: ta-1
    const gtaSelect = wrapper.find('[data-testid="Filter shifts by teaching assistant"]')
    expect(gtaSelect.exists()).toBe(true)
    await gtaSelect.setValue('ta-1')
    expect(capturedData.length).toBe(1)
    expect(capturedData[0].id).toBe('shift-1')
    expect(resetBtn.attributes('disabled')).toBeUndefined()

    // Reset GTA filter
    await gtaSelect.setValue('all')
    expect(capturedData.length).toBe(2)

    // Filter by Date From: 2026-09-20
    const fromInput = wrapper.find('[data-testid="Filter shifts from date"]')
    expect(fromInput.exists()).toBe(true)
    await fromInput.setValue('2026-09-20')
    expect(capturedData.length).toBe(1)
    expect(capturedData[0].id).toBe('shift-2')

    // Filter by Date To: 2026-09-22 (shift-2 is 2026-09-25, so 0 shifts match)
    const toInput = wrapper.find('[data-testid="Filter shifts to date"]')
    expect(toInput.exists()).toBe(true)
    await toInput.setValue('2026-09-22')
    expect(capturedData.length).toBe(0)

    // Click Reset Filters
    await resetBtn.trigger('click')
    expect(capturedData.length).toBe(2)
    expect(resetBtn.attributes('disabled')).toBeDefined()
  })

  it('auto-populates shift list from GTA stored definition when Weekly Schedule Builder is opened', async () => {
    const wrapper = mount(TeacherGtaShiftsSection, {
      props: {
        courseId: 'course-1',
        interviewLocation: 'McBryde 106'
      },
      global: {
        stubs: {
          BaseDataTable: true,
          UCard: true,
          UButton: {
            props: ['label', 'disabled', 'icon'],
            template:
              '<button :disabled="disabled" :data-label="label" @click="$emit(\'click\')"><slot>{{ label }}</slot></button>'
          },
          USelect: {
            props: ['modelValue', 'items', 'ariaLabel'],
            emits: ['update:modelValue'],
            setup(props, { emit }) {
              return () =>
                h('select', {
                  'data-testid': props.ariaLabel || 'select',
                  value: props.modelValue,
                  onChange: (e: any) => emit('update:modelValue', e.target.value)
                })
            }
          },
          UTextarea: {
            props: ['modelValue'],
            emits: ['update:modelValue', 'input'],
            setup(props, { emit }) {
              return () =>
                h('textarea', {
                  'data-testid': 'weekly-raw-textarea',
                  value: props.modelValue,
                  onInput: (e: any) => {
                    emit('update:modelValue', e.target.value)
                    emit('input', e)
                  }
                })
            }
          },
          UBadge: true,
          UIcon: true,
          UInput: true,
          UModal: {
            props: ['open', 'title'],
            template:
              '<div v-if="open" data-testid="modal" :data-title="title"><slot name="body" /><slot name="footer" /></div>'
          },
          UFormField: true,
          BaseFormInput: true
        }
      }
    })

    // Click Weekly Schedule Builder button
    const openBtn = wrapper.find('[data-label="Weekly Schedule Builder"]')
    expect(openBtn.exists()).toBe(true)
    await openBtn.trigger('click')

    // Modal is open
    const modal = wrapper.find('[data-testid="modal"]')
    expect(modal.exists()).toBe(true)

    // ta-1 was initially selected, which has stored definition
    // Check textarea value
    const textarea = wrapper.find('[data-testid="weekly-raw-textarea"]')
    expect(textarea.exists()).toBe(true)
    expect((textarea.element as HTMLTextAreaElement).value).toBe(
      'Tue 2:00–5:00 PM (3.0h), Wed 2:30–5:00 PM (2.5h), Thu 2:30–5:00 PM (2.5h)'
    )

    // Check that 3 slots were parsed into the weekly slots list
    expect(wrapper.vm.weeklySlots).toHaveLength(3)
    expect(wrapper.vm.weeklySlots[0].dayOfWeek).toBe(2) // Tuesday
    expect(wrapper.vm.weeklySlots[0].startTime).toBe('14:00')
    expect(wrapper.vm.weeklySlots[0].endTime).toBe('17:00')
    expect(wrapper.vm.weeklySlots[1].dayOfWeek).toBe(3) // Wednesday
    expect(wrapper.vm.weeklySlots[1].startTime).toBe('14:30')
    expect(wrapper.vm.weeklySlots[1].endTime).toBe('17:00')
    expect(wrapper.vm.weeklySlots[2].dayOfWeek).toBe(4) // Thursday
    expect(wrapper.vm.weeklySlots[2].startTime).toBe('14:30')
    expect(wrapper.vm.weeklySlots[2].endTime).toBe('17:00')

    // Switch selected GTA to ta-2 (which has no stored definition)
    wrapper.vm.weeklyGtaId = 'ta-2'
    await wrapper.vm.$nextTick()

    // Slots and text should be cleared for ta-2
    expect(wrapper.vm.weeklyRawText).toBe('')
    expect(wrapper.vm.weeklySlots).toHaveLength(0)

    // Fast text entry for ta-2: Enter compact format without spaces before AM/PM
    wrapper.vm.weeklyRawText = 'Mon 2:00–5:00PM, Wed 9:00–11:30AM, Fri 9:00–11:30AM'
    wrapper.vm.handleWeeklyTextChange()
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.weeklySlots).toHaveLength(3)
    expect(wrapper.vm.weeklySlots[0].dayOfWeek).toBe(1) // Monday
    expect(wrapper.vm.weeklySlots[0].startTime).toBe('14:00')
    expect(wrapper.vm.weeklySlots[0].endTime).toBe('17:00')
    expect(wrapper.vm.weeklySlots[1].dayOfWeek).toBe(3) // Wednesday
    expect(wrapper.vm.weeklySlots[1].startTime).toBe('09:00')
    expect(wrapper.vm.weeklySlots[1].endTime).toBe('11:30')
    expect(wrapper.vm.weeklySlots[2].dayOfWeek).toBe(5) // Friday
    expect(wrapper.vm.weeklySlots[2].startTime).toBe('09:00')
    expect(wrapper.vm.weeklySlots[2].endTime).toBe('11:30')

    // Generate batch shifts
    wrapper.vm.weeklyStartDate = '2026-09-14'
    wrapper.vm.weeklyEndDate = '2026-09-20'
    await wrapper.vm.handleBatchGenerate()

    expect(mockBatchGenerateShifts).toHaveBeenCalledWith({
      userId: 'ta-2',
      startDate: '2026-09-14',
      endDate: '2026-09-20',
      shiftDefinition: 'Mon 2:00–5:00PM, Wed 9:00–11:30AM, Fri 9:00–11:30AM',
      shifts: [
        { dayOfWeek: 1, startTime: '14:00', endTime: '17:00' },
        { dayOfWeek: 3, startTime: '09:00', endTime: '11:30' },
        { dayOfWeek: 5, startTime: '09:00', endTime: '11:30' }
      ]
    })
  })
})

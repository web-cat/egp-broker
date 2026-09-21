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
  }
])

const mockGtas = ref([
  {
    id: 'ta-1',
    firstName: 'Alice',
    lastName: 'Smith',
    email: 'alice@example.edu',
    avatarUrl: null
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
})

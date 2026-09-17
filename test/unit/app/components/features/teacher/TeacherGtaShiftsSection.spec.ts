import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, h } from 'vue'
import TeacherGtaShiftsSection from '~/components/features/teacher/TeacherGtaShiftsSection.vue'

const mockCreateShift = vi.fn()
const mockUpdateShift = vi.fn()
const mockDeleteShift = vi.fn()
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
    batchGenerateShifts: mockBatchGenerateShifts,
    updateInterviewLocation: mockUpdateInterviewLocation
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
})

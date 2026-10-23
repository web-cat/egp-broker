import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import CourseSettingsModal from '~/components/features/course/CourseSettingsModal.vue'

const mockToast = { add: vi.fn() }
vi.stubGlobal('useToast', () => mockToast)

const mockUpdateCourseSettings = vi.fn()
vi.mock('~/composables/features/useCourseContext', () => ({
  useCourseContext: () => ({
    updateCourseSettings: mockUpdateCourseSettings
  })
}))

const globalStubs = {
  UModal: {
    props: ['open', 'title', 'description'],
    template: '<div v-if="open" class="modal"><slot name="body" /><slot name="footer" /></div>'
  },
  UInput: {
    props: ['modelValue', 'placeholder', 'icon'],
    template:
      '<input class="input-field" :placeholder="placeholder" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
  },
  UButton: {
    props: ['label', 'color', 'variant', 'loading', 'icon'],
    template:
      '<button :disabled="loading" class="btn" @click="$emit(\'click\')">{{ label }}</button>'
  },
  UIcon: {
    props: ['name'],
    template: '<i :class="name" />'
  }
}

describe('CourseSettingsModal.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('populates location and pattern fields when modal is opened from open: false to open: true', async () => {
    const wrapper = mount(CourseSettingsModal, {
      props: {
        open: false,
        courseId: 'course-123',
        initialLocation: 'McBryde Hall 106',
        initialCbtfTitlePattern: '^Exam',
        initialInterviewTitlePattern: '^Project'
      },
      global: {
        stubs: globalStubs
      }
    })

    expect(wrapper.find('.modal').exists()).toBe(false)

    // Open dynamically
    await wrapper.setProps({ open: true })

    expect(wrapper.find('.modal').exists()).toBe(true)
    const inputs = wrapper.findAll('.input-field')
    expect(inputs).toHaveLength(3)
    expect((inputs[0].element as HTMLInputElement).value).toBe('McBryde Hall 106')
    expect((inputs[1].element as HTMLInputElement).value).toBe('^Exam')
    expect((inputs[2].element as HTMLInputElement).value).toBe('^Project')
  })

  it('updates fields if initial props change while modal is open', async () => {
    const wrapper = mount(CourseSettingsModal, {
      props: {
        open: true,
        courseId: 'course-123',
        initialLocation: 'Zoom Room A',
        initialCbtfTitlePattern: 'Midterm',
        initialInterviewTitlePattern: 'Interview'
      },
      global: {
        stubs: globalStubs
      }
    })

    const inputs = wrapper.findAll('.input-field')
    expect((inputs[0].element as HTMLInputElement).value).toBe('Zoom Room A')
    expect((inputs[1].element as HTMLInputElement).value).toBe('Midterm')
    expect((inputs[2].element as HTMLInputElement).value).toBe('Interview')

    await wrapper.setProps({
      initialLocation: 'Zoom Room B',
      initialCbtfTitlePattern: 'Final',
      initialInterviewTitlePattern: 'Demo'
    })
    expect((inputs[0].element as HTMLInputElement).value).toBe('Zoom Room B')
    expect((inputs[1].element as HTMLInputElement).value).toBe('Final')
    expect((inputs[2].element as HTMLInputElement).value).toBe('Demo')
  })

  it('calls updateCourseSettings and emits saved on save', async () => {
    mockUpdateCourseSettings.mockResolvedValue({
      data: {
        interviewLocation: 'Torgersen 2150',
        cbtfTitlePattern: '^Exam\\s\\d+',
        interviewTitlePattern: '^Milestone\\b'
      }
    })

    const wrapper = mount(CourseSettingsModal, {
      props: {
        open: true,
        courseId: 'course-123',
        initialLocation: 'Old Location',
        initialCbtfTitlePattern: '^OldExam',
        initialInterviewTitlePattern: '^OldProj'
      },
      global: {
        stubs: globalStubs
      }
    })

    const inputs = wrapper.findAll('.input-field')
    await inputs[0].setValue('Torgersen 2150')
    await inputs[1].setValue('^Exam\\s\\d+')
    await inputs[2].setValue('^Milestone\\b')

    const saveButton = wrapper.findAll('button').find((b) => b.text().includes('Save Settings'))
    expect(saveButton).toBeDefined()
    await saveButton!.trigger('click')

    expect(mockUpdateCourseSettings).toHaveBeenCalledWith('course-123', {
      interviewLocation: 'Torgersen 2150',
      cbtfTitlePattern: '^Exam\\s\\d+',
      interviewTitlePattern: '^Milestone\\b'
    })
    expect(wrapper.emitted('saved')).toBeTruthy()
    expect(wrapper.emitted('saved')![0]).toEqual([
      {
        location: 'Torgersen 2150',
        cbtfTitlePattern: '^Exam\\s\\d+',
        interviewTitlePattern: '^Milestone\\b'
      }
    ])
    expect(wrapper.emitted('update:open')?.[0]).toEqual([false])
  })
})

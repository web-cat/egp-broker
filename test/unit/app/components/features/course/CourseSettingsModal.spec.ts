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
      '<input class="location-input" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
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

  it('populates location when modal is opened from open: false to open: true', async () => {
    const wrapper = mount(CourseSettingsModal, {
      props: {
        open: false,
        courseId: 'course-123',
        initialLocation: 'McBryde Hall 106'
      },
      global: {
        stubs: globalStubs
      }
    })

    expect(wrapper.find('.modal').exists()).toBe(false)

    // Open dynamically
    await wrapper.setProps({ open: true })

    expect(wrapper.find('.modal').exists()).toBe(true)
    const input = wrapper.find('.location-input')
    expect((input.element as HTMLInputElement).value).toBe('McBryde Hall 106')
  })

  it('updates location if initialLocation changes while modal is open', async () => {
    const wrapper = mount(CourseSettingsModal, {
      props: {
        open: true,
        courseId: 'course-123',
        initialLocation: 'Zoom Room A'
      },
      global: {
        stubs: globalStubs
      }
    })

    const input = wrapper.find('.location-input')
    expect((input.element as HTMLInputElement).value).toBe('Zoom Room A')

    await wrapper.setProps({ initialLocation: 'Zoom Room B' })
    expect((input.element as HTMLInputElement).value).toBe('Zoom Room B')
  })

  it('calls updateCourseSettings and emits saved on save', async () => {
    mockUpdateCourseSettings.mockResolvedValue({
      data: { interviewLocation: 'Torgersen 2150' }
    })

    const wrapper = mount(CourseSettingsModal, {
      props: {
        open: true,
        courseId: 'course-123',
        initialLocation: 'Old Location'
      },
      global: {
        stubs: globalStubs
      }
    })

    const input = wrapper.find('.location-input')
    await input.setValue('Torgersen 2150')

    const saveButton = wrapper.findAll('button').find((b) => b.text().includes('Save Settings'))
    expect(saveButton).toBeDefined()
    await saveButton!.trigger('click')

    expect(mockUpdateCourseSettings).toHaveBeenCalledWith('course-123', {
      interviewLocation: 'Torgersen 2150'
    })
    expect(wrapper.emitted('saved')).toBeTruthy()
    expect(wrapper.emitted('saved')![0]).toEqual(['Torgersen 2150'])
    expect(wrapper.emitted('update:open')?.[0]).toEqual([false])
  })
})

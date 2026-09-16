import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import AssignmentEditPanel from '~/components/features/admin/AssignmentEditPanel.vue'

vi.stubGlobal('useTemplateRef', () => ref(null))

const mockNotifications = {
  success: vi.fn(),
  error: vi.fn()
}
vi.stubGlobal('useNotifications', () => mockNotifications)

const mockToast = {
  add: vi.fn()
}
vi.stubGlobal('useToast', () => mockToast)

const mockToastHelpers = {
  success: vi.fn(),
  showError: vi.fn()
}
vi.stubGlobal('useToastHelpers', () => mockToastHelpers)

const mockFetch = vi.fn().mockResolvedValue({})
vi.stubGlobal('$fetch', mockFetch)

const globalStubs = {
  USlideover: {
    template: '<div><slot name="body" /></div>'
  },
  UForm: {
    template: '<form @submit.prevent="$emit(\'submit\')"><slot /></form>'
  },
  UFormField: {
    template: '<div><slot /></div>'
  },
  USwitch: {
    props: ['modelValue'],
    template:
      '<input type="checkbox" role="switch" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)" />'
  },
  USelectMenu: {
    props: ['modelValue'],
    template: '<div class="select-menu" />'
  },
  BaseFormInput: {
    props: ['modelValue', 'label', 'name', 'type'],
    template:
      '<div class="base-form-input"><label>{{ label }}</label><input :name="name" :type="type || \'text\'" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" /></div>'
  },
  UBadge: {
    template: '<span class="badge"><slot /></span>'
  }
}

describe('AssignmentEditPanel.vue - GTA Grading Interviews', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('populates GTA interview fields when opening in edit mode', async () => {
    const assignment = {
      id: 'asg-1',
      title: 'Project 1',
      canvasAssignmentId: 'canvas-101',
      dueDate: '2026-09-25T17:00:00.000Z',
      availableFrom: '2026-09-20T09:00:00.000Z',
      acceptUntil: '2026-09-26T23:59:00.000Z',
      hasInterviews: true,
      interviewWindowStart: '2026-09-21T09:00:00.000Z',
      interviewWindowEnd: '2026-09-25T17:00:00.000Z',
      eligibilities: []
    }

    const wrapper = mount(AssignmentEditPanel, {
      props: {
        open: true,
        assignment,
        courseId: 'course-1',
        passTypes: []
      },
      global: {
        stubs: globalStubs
      }
    })

    await flushPromises()

    // Find the GTA interview inputs
    const inputs = wrapper.findAll('input')
    const startInput = inputs.find((i) => i.attributes('name') === 'interviewWindowStart')
    const endInput = inputs.find((i) => i.attributes('name') === 'interviewWindowEnd')

    expect(startInput).toBeDefined()
    expect(endInput).toBeDefined()
    expect(startInput?.element.value).toContain('2026-09-21')
    expect(endInput?.element.value).toContain('2026-09-25')
  })

  it('submits updated hasInterviews and window dates on submit', async () => {
    const assignment = {
      id: 'asg-1',
      title: 'Project 1',
      canvasAssignmentId: 'canvas-101',
      dueDate: null,
      availableFrom: null,
      acceptUntil: null,
      hasInterviews: true,
      interviewWindowStart: '2026-09-21T09:00:00.000Z',
      interviewWindowEnd: '2026-09-25T17:00:00.000Z',
      eligibilities: []
    }

    const wrapper = mount(AssignmentEditPanel, {
      props: {
        open: true,
        assignment,
        courseId: 'course-1',
        passTypes: []
      },
      global: {
        stubs: globalStubs
      }
    })

    await flushPromises()

    const form = wrapper.find('form')
    await form.trigger('submit')
    await flushPromises()

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/me/assignments/asg-1',
      expect.objectContaining({
        method: 'PATCH',
        body: expect.objectContaining({
          hasInterviews: true,
          interviewWindowStart: expect.any(String),
          interviewWindowEnd: expect.any(String)
        })
      })
    )
  })
})

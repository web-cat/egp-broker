import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import StudentAssignmentNoticeModal from '~/components/features/gta/StudentAssignmentNoticeModal.vue'

const mockToast = {
  add: vi.fn()
}
vi.stubGlobal('useToast', () => mockToast)

describe('StudentAssignmentNoticeModal.vue', () => {
  const stubs = {
    UModal: {
      props: ['open', 'title', 'description'],
      emits: ['update:open'],
      template:
        '<div v-if="open" data-testid="modal"><h3>{{ title }}</h3><slot name="body" /><slot name="footer" /></div>'
    },
    UIcon: true,
    UButton: {
      props: ['label', 'disabled', 'loading'],
      template: '<button :disabled="disabled"><slot />{{ label }}</button>'
    },
    UTextarea: {
      props: ['modelValue'],
      emits: ['update:modelValue'],
      template:
        '<textarea :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
    },
    USelect: {
      props: ['modelValue', 'items'],
      emits: ['update:modelValue'],
      template: `<select :value="modelValue" @change="$emit('update:modelValue', $event.target.value)">
        <option v-for="item in items" :key="item.value" :value="item.value">{{ item.label }}</option>
      </select>`
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders modal when open is true with provided assignments', () => {
    const wrapper = mount(StudentAssignmentNoticeModal, {
      props: {
        open: true,
        courseId: 'course-1',
        assignments: [
          { id: 'asg-1', title: 'Project 1' },
          { id: 'asg-2', title: 'Project 2' }
        ]
      },
      global: { stubs }
    })

    expect(wrapper.find('[data-testid="modal"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Upload Course Staff Notices')
    expect(wrapper.find('select').exists()).toBe(true)
  })

  it('parses input and enables upload button when valid notices and assignment are present', async () => {
    const wrapper = mount(StudentAssignmentNoticeModal, {
      props: {
        open: true,
        courseId: 'course-1',
        initialAssignmentId: 'asg-1',
        assignments: [{ id: 'asg-1', title: 'Project 1' }]
      },
      global: { stubs }
    })

    const textarea = wrapper.find('textarea')
    await textarea.setValue('alice@illinois.edu, Review problem 1 recursion')

    expect(wrapper.text()).toContain('Preview (1 notice parsed)')
    expect(wrapper.text()).toContain('alice@illinois.edu')
    expect(wrapper.text()).toContain('Review problem 1 recursion')

    const uploadBtn = wrapper.findAll('button').find((b) => b.text().includes('Upload Notices'))
    expect(uploadBtn).toBeDefined()
    expect(uploadBtn?.attributes('disabled')).toBeUndefined()
  })

  it('submits batch payload to endpoint and emits uploaded on success', async () => {
    const mockPostResult = {
      statusCode: 200,
      data: {
        createdCount: 1,
        updatedCount: 0,
        unmatchedIdentifiers: [],
        totalProcessed: 1
      }
    }

    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(mockPostResult))

    const wrapper = mount(StudentAssignmentNoticeModal, {
      props: {
        open: true,
        courseId: 'course-1',
        initialAssignmentId: 'asg-1',
        assignments: [{ id: 'asg-1', title: 'Project 1' }]
      },
      global: { stubs }
    })

    const textarea = wrapper.find('textarea')
    await textarea.setValue('alice@illinois.edu, Review problem 1 recursion')

    const uploadBtn = wrapper.findAll('button').find((b) => b.text().includes('Upload Notices'))
    await uploadBtn?.trigger('click')

    expect($fetch).toHaveBeenCalledWith(
      '/api/me/courses/course-1/assignments/asg-1/notices/batch',
      expect.objectContaining({
        method: 'POST',
        body: {
          notices: [
            { studentIdentifier: 'alice@illinois.edu', notice: 'Review problem 1 recursion' }
          ]
        }
      })
    )

    expect(wrapper.emitted('uploaded')).toBeTruthy()
    expect(wrapper.emitted('uploaded')![0][0]).toEqual(mockPostResult.data)
    expect(mockToast.add).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Notices Uploaded',
        color: 'success'
      })
    )
  })

  it('displays error message when batch upload fails', async () => {
    vi.stubGlobal(
      '$fetch',
      vi.fn().mockRejectedValue({
        data: { statusMessage: 'Invalid student data in batch' }
      })
    )

    const wrapper = mount(StudentAssignmentNoticeModal, {
      props: {
        open: true,
        courseId: 'course-1',
        initialAssignmentId: 'asg-1',
        assignments: [{ id: 'asg-1', title: 'Project 1' }]
      },
      global: { stubs }
    })

    const textarea = wrapper.find('textarea')
    await textarea.setValue('alice@illinois.edu, Review problem 1')

    const uploadBtn = wrapper.findAll('button').find((b) => b.text().includes('Upload Notices'))
    await uploadBtn?.trigger('click')

    expect(wrapper.text()).toContain('Invalid student data in batch')
    expect(mockToast.add).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Upload Failed',
        color: 'error'
      })
    )
  })
})

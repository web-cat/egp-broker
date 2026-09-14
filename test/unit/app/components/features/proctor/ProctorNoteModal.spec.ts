import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ProctorNoteModal from '~/components/features/proctor/ProctorNoteModal.vue'

describe('ProctorNoteModal Component', () => {
  const defaultProps = {
    open: true,
    target: {
      reservationId: 'res-1',
      seatNumber: 12,
      studentName: 'Alice Smith',
      assignmentTitle: 'Midterm Exam 1',
      notes: [
        {
          id: 'note-1',
          content: 'Student asked for extra scratch paper.',
          proctorName: 'John Proctor',
          hasPhotos: false,
          createdAt: new Date().toISOString()
        }
      ]
    },
    seatedRoster: []
  }

  it('binds open prop and shows target student and notes log', () => {
    const wrapper = mount(ProctorNoteModal, {
      props: defaultProps,
      global: {
        stubs: {
          UModal: {
            props: ['open'],
            template:
              '<div data-testid="umodal" :data-open="open"><slot name="content" /><slot /></div>'
          },
          UIcon: true,
          UButton: {
            template:
              '<button :disabled="$attrs.disabled" @click="$emit(\'click\')"><slot>{{ $attrs.label }}</slot></button>'
          },
          UBadge: true,
          UTextarea: {
            props: ['modelValue'],
            template:
              '<textarea :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
          }
        }
      }
    })

    const modal = wrapper.find('[data-testid="umodal"]')
    expect(modal.attributes('data-open')).toBe('true')
    expect(wrapper.text()).toContain('Alice Smith')
    expect(wrapper.text()).toContain('Seat #12')
    expect(wrapper.text()).toContain('Midterm Exam 1')
    expect(wrapper.text()).toContain('Student asked for extra scratch paper.')
    expect(wrapper.text()).toContain('John Proctor')
  })

  it('submits a new note when Save Note is clicked', async () => {
    const wrapper = mount(ProctorNoteModal, {
      props: {
        ...defaultProps,
        target: {
          reservationId: 'res-1',
          seatNumber: 12,
          studentName: 'Alice Smith',
          assignmentTitle: 'Midterm Exam 1',
          notes: []
        }
      },
      global: {
        stubs: {
          UModal: {
            props: ['open'],
            template:
              '<div data-testid="umodal" :data-open="open"><slot name="content" /><slot /></div>'
          },
          UIcon: true,
          UButton: {
            props: ['disabled'],
            template:
              '<button :disabled="disabled" @click="$emit(\'click\')"><slot>{{ $attrs.label }}</slot></button>'
          },
          UBadge: true,
          UTextarea: {
            props: ['modelValue'],
            template:
              '<textarea :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
          }
        }
      }
    })

    // Type into textarea
    const textarea = wrapper.find('textarea')
    await textarea.setValue('Observed unauthorized device.')

    const saveBtn = wrapper.findAll('button').find((b) => b.text().includes('Save Note'))
    expect(saveBtn).toBeDefined()
    expect(saveBtn!.attributes('disabled')).toBeUndefined()
    await saveBtn!.trigger('click')

    expect(wrapper.emitted('submit')).toBeTruthy()
    expect(wrapper.emitted('submit')![0][0]).toEqual({
      reservationId: 'res-1',
      content: 'Observed unauthorized device.',
      hasPhotos: false
    })
  })
})

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import GtaShiftImpactModal from '~/components/features/teacher/GtaShiftImpactModal.vue'

describe('GtaShiftImpactModal component', () => {
  it('renders correctly in delete mode with affected appointments', async () => {
    const impact = {
      rescheduled: [
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
          previousGtaName: 'Alice TA',
          newGtaId: 'ta-2',
          newGtaName: 'Bob TA'
        }
      ],
      cancelled: [
        {
          reservationId: 'res-2',
          studentId: 's-2',
          studentName: 'John Student',
          studentEmail: 'john@vt.edu',
          assignmentId: 'a-1',
          assignmentTitle: 'Project 1',
          startTime: '2026-09-18T15:00:00.000Z',
          endTime: '2026-09-18T15:10:00.000Z',
          previousGtaId: 'ta-1',
          previousGtaName: 'Alice TA',
          reason: 'No concurrent GTA on duty'
        }
      ]
    }

    const wrapper = mount(GtaShiftImpactModal, {
      props: {
        open: true,
        impact,
        actionType: 'delete'
      },
      global: {
        stubs: {
          UModal: {
            props: ['open', 'title', 'description'],
            template: `
              <div data-testid="modal" :data-title="title" :data-description="description">
                <slot name="body" />
                <slot name="footer" />
              </div>
            `
          },
          UButton: {
            props: ['label', 'color', 'variant'],
            template: '<button :data-label="label" :data-color="color">{{ label }}</button>'
          },
          UBadge: true,
          UIcon: true
        }
      }
    })

    const modal = wrapper.find('[data-testid="modal"]')
    expect(modal.attributes('data-title')).toBe('Confirm Shift Deletion')
    expect(wrapper.text()).toContain('Will Be Automatically Rescheduled (1)')
    expect(wrapper.text()).toContain('Jane Student')
    expect(wrapper.text()).toContain('Bob TA')
    expect(wrapper.text()).toContain('Will Be Cancelled (1)')
    expect(wrapper.text()).toContain('John Student')

    // Check confirm button
    const confirmBtn = wrapper.find('button[data-label="Confirm & Delete Shift"]')
    expect(confirmBtn.exists()).toBe(true)
    expect(confirmBtn.attributes('data-color')).toBe('error')

    await confirmBtn.trigger('click')
    expect(wrapper.emitted('confirm')).toHaveLength(1)
  })

  it('renders friendly notice when no appointments are affected', () => {
    const wrapper = mount(GtaShiftImpactModal, {
      props: {
        open: true,
        impact: { rescheduled: [], cancelled: [] },
        actionType: 'delete'
      },
      global: {
        stubs: {
          UModal: {
            props: ['open', 'title', 'description'],
            template: `
              <div data-testid="modal" :data-title="title">
                <slot name="body" />
                <slot name="footer" />
              </div>
            `
          },
          UButton: {
            props: ['label'],
            template: '<button :data-label="label">{{ label }}</button>'
          },
          UBadge: true,
          UIcon: true
        }
      }
    })

    expect(wrapper.text()).toContain('No Appointments Affected')
    expect(wrapper.text()).toContain('There are no student reservations booked during this shift')
  })
})

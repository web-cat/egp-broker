import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import RosterSyncModal from '~/components/features/dashboard/RosterSyncModal.vue'

describe('RosterSyncModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders progress bar while syncing and closes immediately without details for students (showDetails: false)', async () => {
    vi.stubGlobal(
      '$fetch',
      vi.fn().mockResolvedValue({
        data: {
          isSyncing: false,
          lastRosterSyncAt: '2026-09-08T20:00:00Z',
          totalStudents: 150,
          totalSections: 4,
          studentsWithSection: 140,
          studentsWithoutSection: 10
        }
      })
    )

    const wrapper = mount(RosterSyncModal, {
      props: {
        open: true,
        showDetails: false
      },
      global: {
        mocks: {
          $t: (k: string) => k
        },
        stubs: {
          UModal: {
            template: '<div><slot name="body" /></div>'
          },
          UIcon: true,
          UProgress: true,
          UButton: true
        }
      }
    })

    await flushPromises()

    // Synced event emitted
    expect(wrapper.emitted('synced')).toBeTruthy()
    // Modal immediately closed via update:open false
    expect(wrapper.emitted('update:open')).toBeTruthy()
    expect(wrapper.emitted('update:open')?.[0]).toEqual([false])

    // Does NOT render details breakdown
    expect(wrapper.text()).not.toContain('150')
    expect(wrapper.text()).not.toContain('dashboard.rosterSync.totalStudentsLabel')
  })

  it('renders progress bar and then displays details & close button for teachers (showDetails: true)', async () => {
    vi.stubGlobal(
      '$fetch',
      vi.fn().mockResolvedValue({
        data: {
          isSyncing: false,
          lastRosterSyncAt: '2026-09-08T20:00:00Z',
          totalStudents: 240,
          totalSections: 8,
          studentsWithSection: 230,
          studentsWithoutSection: 10
        }
      })
    )

    const wrapper = mount(RosterSyncModal, {
      props: {
        open: true,
        showDetails: true
      },
      global: {
        mocks: {
          $t: (k: string) => k
        },
        stubs: {
          UModal: {
            template: '<div><slot name="body" /></div>'
          },
          UIcon: true,
          UProgress: true,
          UButton: {
            template: '<button @click="$emit(\'click\')"><slot /></button>'
          }
        }
      }
    })

    await flushPromises()

    // Synced event emitted
    expect(wrapper.emitted('synced')).toBeTruthy()
    // Modal remains open so teacher can inspect results
    expect(wrapper.emitted('update:open')).toBeFalsy()

    // Displays breakdown details
    expect(wrapper.text()).toContain('240')
    expect(wrapper.text()).toContain('8')
    expect(wrapper.text()).toContain('230')

    // Clicking close button closes the modal
    const button = wrapper.find('button')
    expect(button.exists()).toBe(true)
    await button.trigger('click')
    expect(wrapper.emitted('update:open')?.[0]).toEqual([false])
  })
})

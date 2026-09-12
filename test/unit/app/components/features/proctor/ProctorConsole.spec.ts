import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import ProctorConsole from '~/components/features/proctor/ProctorConsole.vue'

describe('ProctorConsole Component', () => {
  let mockState: any

  beforeEach(() => {
    mockState = {
      isOnDuty: ref(true),
      toggleDuty: vi.fn(),
      facility: ref({
        id: 'fac-1',
        name: 'Main CBTF',
        totalSeats: 48,
        occupiedSeats: 2,
        availableSeats: 46
      }),
      counts: ref({ seated: 2, arriving: 3, departures: 0 }),
      seated: ref([
        {
          id: 'seat-1',
          seatNumber: 4,
          studentName: 'David Chen',
          assignmentTitle: 'ECE 120',
          remainingMinutes: 45
        }
      ]),
      arriving: ref([
        {
          id: 'arr-1',
          studentName: 'Jane Doe',
          assignmentTitle: 'CS 101',
          startTime: new Date().toISOString()
        },
        {
          id: 'arr-2',
          studentName: 'Marcus Vance',
          assignmentTitle: 'PHYS 211',
          startTime: new Date().toISOString()
        }
      ]),
      departures: ref([]),
      lookupResult: ref(null),
      lookupLoading: ref(false),
      lookupError: ref(null),
      lastAction: ref(null),
      lookupStudent: vi.fn(),
      confirmCheckIn: vi.fn(),
      confirmCheckOut: vi.fn(),
      clearLookup: vi.fn(),
      isNoteModalOpen: ref(false),
      selectedNoteTarget: ref(null),
      openNoteModal: vi.fn(),
      closeNoteModal: vi.fn(),
      addNote: vi.fn(),
      fetchNotes: vi.fn(),
      // Training controls
      isMismatchNext: ref(false),
      toggleMismatchNext: vi.fn(),
      activeArrivalIndex: ref(0),
      activeTargetStudent: ref({ studentName: 'Jane Doe', assignmentTitle: 'CS 101' }),
      advanceArrivalQueue: vi.fn(),
      selectArrivalIndex: vi.fn(),
      resetScenario: vi.fn()
    }
  })

  it('renders standard console controls when isTraining is false', () => {
    const wrapper = mount(ProctorConsole, {
      props: {
        isTraining: false,
        proctorState: mockState
      },
      global: {
        stubs: {
          UIcon: true,
          UBadge: true,
          UButton: {
            template:
              '<button :disabled="$attrs.disabled" @click="$emit(\'click\')"><slot>{{ $attrs.label }}</slot></button>'
          },
          USwitch: true,
          UInput: true,
          BaseCard: { template: '<div><slot /></div>' },
          BaseDataTable: true,
          FeaturesProctorProctorNoteModal: true,
          NuxtLink: {
            template: '<a :href="$attrs.to"><slot /></a>'
          }
        }
      }
    })

    expect(wrapper.text()).toContain('Main CBTF')
    expect(wrapper.text()).toContain('Training Mode')
    expect(wrapper.find('[data-testid="training-banner"]').exists()).toBe(false)
  })

  it('renders training banner, controls, and pills when isTraining is true', async () => {
    const wrapper = mount(ProctorConsole, {
      props: {
        isTraining: true,
        proctorState: mockState
      },
      global: {
        stubs: {
          UIcon: true,
          UBadge: true,
          UButton: {
            template:
              '<button :disabled="$attrs.disabled" @click="$emit(\'click\')"><slot>{{ $attrs.label }}</slot></button>'
          },
          USwitch: true,
          UInput: true,
          BaseCard: { template: '<div><slot /></div>' },
          BaseDataTable: true,
          FeaturesProctorProctorNoteModal: true,
          NuxtLink: {
            template: '<a :href="$attrs.to"><slot /></a>'
          }
        }
      }
    })

    const banner = wrapper.find('[data-testid="training-banner"]')
    expect(banner.exists()).toBe(true)
    expect(banner.text()).toContain('PROCTOR TRAINING SANDBOX')

    // Advance queue pill
    const advanceBtn = wrapper.find('[data-testid="advance-arrival-btn"]')
    expect(advanceBtn.exists()).toBe(true)
    expect(advanceBtn.text()).toContain('Jane Doe')
    await advanceBtn.trigger('click')
    expect(mockState.advanceArrivalQueue).toHaveBeenCalled()

    // Mismatch pill
    const mismatchBtn = wrapper.find('[data-testid="mismatch-toggle-btn"]')
    expect(mismatchBtn.exists()).toBe(true)
    await mismatchBtn.trigger('click')
    expect(mockState.toggleMismatchNext).toHaveBeenCalled()

    // Reset scenario button
    const resetBtn = wrapper.find('[data-testid="reset-scenario-btn"]')
    expect(resetBtn.exists()).toBe(true)
    await resetBtn.trigger('click')
    expect(mockState.resetScenario).toHaveBeenCalled()
  })

  it('triggers lookupStudent when swipe form is submitted', async () => {
    const wrapper = mount(ProctorConsole, {
      props: {
        isTraining: true,
        proctorState: mockState
      },
      global: {
        stubs: {
          UIcon: true,
          UBadge: true,
          UButton: {
            template:
              '<button :disabled="$attrs.disabled" @click="$emit(\'click\')"><slot>{{ $attrs.label }}</slot></button>'
          },
          USwitch: true,
          UInput: {
            props: ['modelValue'],
            template:
              '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
          },
          BaseCard: { template: '<div><slot /></div>' },
          BaseDataTable: true,
          FeaturesProctorProctorNoteModal: true,
          NuxtLink: { template: '<a :href="$attrs.to"><slot /></a>' }
        }
      }
    })

    const input = wrapper.find('input')
    await input.setValue(';900000001=2812?')
    await wrapper.find('form').trigger('submit.prevent')

    expect(mockState.lookupStudent).toHaveBeenCalledWith(';900000001=2812?')
  })

  it('triggers confirmCheckIn when check-in button is clicked on verification card', async () => {
    mockState.lookupResult.value = {
      decision: 'READY_FOR_CHECKIN',
      student: { firstName: 'Jane', lastName: 'Doe', studentId: '900000001' },
      reservation: { id: 'res-std-1', seatNumber: 1, assignmentTitle: 'CS 101' },
      message: 'Verified for CS 101'
    }

    const wrapper = mount(ProctorConsole, {
      props: {
        isTraining: true,
        proctorState: mockState
      },
      global: {
        stubs: {
          UIcon: true,
          UBadge: true,
          UButton: {
            template:
              '<button :disabled="$attrs.disabled" @click="$emit(\'click\')"><slot>{{ $attrs.label }}</slot></button>'
          },
          USwitch: true,
          UInput: true,
          BaseCard: { template: '<div><slot /></div>' },
          BaseDataTable: true,
          FeaturesProctorProctorNoteModal: true,
          NuxtLink: { template: '<a :href="$attrs.to"><slot /></a>' }
        }
      }
    })

    expect(wrapper.text()).toContain('Jane Doe')
    expect(wrapper.text()).toContain('Seat #1')

    const checkInBtn = wrapper.findAll('button').find((b) => b.text().includes('Confirm Check-In'))
    expect(checkInBtn).toBeDefined()
    await checkInBtn!.trigger('click')

    expect(mockState.confirmCheckIn).toHaveBeenCalledWith('res-std-1')
  })

  it('triggers confirmCheckOut when checkout button is clicked on verification card', async () => {
    mockState.lookupResult.value = {
      decision: 'READY_FOR_CHECKOUT',
      student: { firstName: 'David', lastName: 'Chen', studentId: '900000004' },
      reservation: { id: 'res-seat-1', seatNumber: 4, assignmentTitle: 'ECE 120' },
      message: 'Student ready for checkout'
    }

    const wrapper = mount(ProctorConsole, {
      props: {
        isTraining: true,
        proctorState: mockState
      },
      global: {
        stubs: {
          UIcon: true,
          UBadge: true,
          UButton: {
            template:
              '<button :disabled="$attrs.disabled" @click="$emit(\'click\')"><slot>{{ $attrs.label }}</slot></button>'
          },
          USwitch: true,
          UInput: true,
          BaseCard: { template: '<div><slot /></div>' },
          BaseDataTable: true,
          FeaturesProctorProctorNoteModal: true,
          NuxtLink: { template: '<a :href="$attrs.to"><slot /></a>' }
        }
      }
    })

    expect(wrapper.text()).toContain('David Chen')
    const checkOutBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('Confirm Check-Out'))
    expect(checkOutBtn).toBeDefined()
    await checkOutBtn!.trigger('click')

    expect(mockState.confirmCheckOut).toHaveBeenCalledWith('res-seat-1')
  })
})

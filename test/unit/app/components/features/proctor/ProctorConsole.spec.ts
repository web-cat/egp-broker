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
          FeaturesProctorNoteModal: true,
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
          FeaturesProctorNoteModal: true,
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
          FeaturesProctorNoteModal: true,
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
          FeaturesProctorNoteModal: true,
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
          FeaturesProctorNoteModal: true,
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

  it('defaults to Expected Arrivals tab as the first and active feed tab', () => {
    const wrapper = mount(ProctorConsole, {
      props: {
        isTraining: false,
        proctorState: mockState
      },
      global: {
        stubs: {
          UIcon: true,
          UBadge: true,
          UButton: true,
          USwitch: true,
          UInput: true,
          BaseCard: { template: '<div><slot /></div>' },
          BaseDataTable: {
            props: ['emptyText'],
            template: '<div data-testid="data-table">{{ emptyText }}</div>'
          },
          FeaturesProctorNoteModal: true,
          NuxtLink: { template: '<a :href="$attrs.to"><slot /></a>' }
        }
      }
    })

    const tabs = wrapper.findAll('button.cursor-pointer')
    expect(tabs[0].text()).toContain('Expected Arrivals')
    expect(tabs[1].text()).toContain('Currently Seated')
    expect(tabs[0].classes()).toContain('border-primary-500')
    expect(wrapper.find('[data-testid="data-table"]').text()).toContain(
      'No arriving students scheduled in this window.'
    )
  })

  it('passes open prop to FeaturesProctorNoteModal and calls handleNoteModalUpdate', async () => {
    mockState.isNoteModalOpen.value = true
    mockState.selectedNoteTarget.value = {
      reservationId: 'res-1',
      studentName: 'David Chen',
      seatNumber: 4
    }

    const wrapper = mount(ProctorConsole, {
      props: {
        isTraining: false,
        proctorState: mockState
      },
      global: {
        stubs: {
          UIcon: true,
          UBadge: true,
          UButton: true,
          USwitch: true,
          UInput: true,
          BaseCard: { template: '<div><slot /></div>' },
          BaseDataTable: true,
          FeaturesProctorNoteModal: {
            props: ['open', 'target'],
            template: '<div data-testid="note-modal" :data-open="open" />'
          },
          NuxtLink: { template: '<a :href="$attrs.to"><slot /></a>' }
        }
      }
    })

    const noteModal = wrapper.find('[data-testid="note-modal"]')
    expect(noteModal.attributes('data-open')).toBe('true')
  })

  it('displays updated facility name and totalSeats in header banner and seated counter without hardcoding 48', () => {
    mockState.facility = ref({
      id: 'fac-custom',
      name: 'Custom Science CBTF',
      totalSeats: 32,
      occupiedSeats: 5,
      availableSeats: 27
    })
    mockState.counts = ref({ seated: 5, arriving: 2, departures: 1 })

    const wrapper = mount(ProctorConsole, {
      props: {
        isTraining: false,
        proctorState: mockState
      },
      global: {
        stubs: {
          UIcon: true,
          UBadge: true,
          UButton: true,
          USwitch: true,
          UInput: true,
          BaseCard: { template: '<div><slot /></div>' },
          BaseDataTable: true,
          FeaturesProctorNoteModal: true,
          NuxtLink: { template: '<a :href="$attrs.to"><slot /></a>' }
        }
      }
    })

    expect(wrapper.text()).toContain('Custom Science CBTF')
    expect(wrapper.text()).toContain('32 Total Workstations')
    expect(wrapper.text()).toContain('5 / 32')
    expect(wrapper.text()).not.toContain('48 Total Workstations')
  })

  it('handles unwrapped state properties seamlessly for facility, counts, and rosters', () => {
    // Plain unwrapped objects (as produced when refs in reactive props are unwrapped by Vue)
    const unwrappedState = {
      facility: {
        id: 'fac-unwrapped',
        name: 'Unwrapped CBTF Lab',
        totalSeats: 64
      },
      counts: { seated: 10, arriving: 4, departures: 2 },
      seated: [{ id: 's-1', seatNumber: 1, studentName: 'Alice' }],
      arriving: [{ id: 'a-1', seatNumber: 2, studentName: 'Bob' }],
      departures: [],
      isOnDuty: true,
      lastAction: null,
      lookupResult: null,
      lookupLoading: false,
      lookupError: null,
      isNoteModalOpen: false,
      selectedNoteTarget: null,
      clearLookup: vi.fn(),
      openNoteModal: vi.fn(),
      toggleDuty: vi.fn()
    }

    const wrapper = mount(ProctorConsole, {
      props: {
        isTraining: false,
        proctorState: unwrappedState
      },
      global: {
        stubs: {
          UIcon: true,
          UBadge: true,
          UButton: true,
          USwitch: true,
          UInput: true,
          BaseCard: { template: '<div><slot /></div>' },
          BaseDataTable: true,
          FeaturesCbtfReservationsTable: true,
          FeaturesProctorNoteModal: true,
          NuxtLink: { template: '<a :href="$attrs.to"><slot /></a>' }
        }
      }
    })

    expect(wrapper.text()).toContain('Unwrapped CBTF Lab')
    expect(wrapper.text()).toContain('64 Total Workstations')
    expect(wrapper.text()).toContain('10 / 64')
  })

  it('switches to All Reservations tab when clicked', async () => {
    const wrapper = mount(ProctorConsole, {
      props: {
        isTraining: false,
        proctorState: mockState
      },
      global: {
        stubs: {
          UIcon: true,
          UBadge: true,
          UButton: true,
          USwitch: true,
          UInput: true,
          BaseCard: { template: '<div><slot /></div>' },
          BaseDataTable: true,
          FeaturesCbtfReservationsTable: { template: '<div class="reservations-table-stub" />' },
          FeaturesProctorNoteModal: true,
          NuxtLink: true
        }
      }
    })

    const buttons = wrapper.findAll('button')
    const resTabButton = buttons.find((b) => b.text().includes('All Reservations'))
    expect(resTabButton).toBeDefined()
    await resTabButton!.trigger('click')

    expect(wrapper.find('.reservations-table-stub').exists()).toBe(true)
  })
})

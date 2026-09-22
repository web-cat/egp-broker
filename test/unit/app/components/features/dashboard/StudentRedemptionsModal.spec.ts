import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import StudentRedemptionsModal from '~/components/features/dashboard/StudentRedemptionsModal.vue'
import type { StudentRosterRow } from '@@/shared/models/teacher'

vi.mock('~/utils/date', () => ({
  formatDate: (d: string | null | undefined) => (d ? 'Formatted Date' : null)
}))

const mockToast = { add: vi.fn() }
vi.stubGlobal('useToast', () => mockToast)

describe('StudentRedemptionsModal', () => {
  const baseStudent: StudentRosterRow = {
    userId: 'user-1',
    studentName: 'Jane Doe',
    studentEmail: 'jane.doe@university.edu',
    sectionName: 'Lab 01',
    passBalances: [
      {
        passTypeId: 'pt-1',
        passTypeName: 'Late Pass',
        balance: 2,
        initialBalance: 3
      }
    ],
    totalRedemptions: 1
  }

  beforeEach(() => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ data: [] }))
    vi.clearAllMocks()
  })

  it('displays student email alongside section enrollment in modal description', () => {
    let capturedDescription = ''
    mount(StudentRedemptionsModal, {
      props: {
        open: true,
        student: baseStudent
      },
      global: {
        stubs: {
          UModal: {
            props: ['open', 'title', 'description'],
            setup(props) {
              capturedDescription = props.description
              return () => null
            }
          },
          UIcon: true,
          UButton: true,
          UInput: true,
          BaseDataTable: true,
          FeaturesDashboardTeacherRedeemPassModal: true
        }
      }
    })

    expect(capturedDescription).toBe('jane.doe@university.edu • Section: Lab 01')
  })

  it('does not duplicate "Section:" prefix if sectionName already begins with "Section"', () => {
    let capturedDescription = ''
    mount(StudentRedemptionsModal, {
      props: {
        open: true,
        student: {
          ...baseStudent,
          sectionName: 'Section 004'
        }
      },
      global: {
        stubs: {
          UModal: {
            props: ['open', 'title', 'description'],
            setup(props) {
              capturedDescription = props.description
              return () => null
            }
          },
          UIcon: true,
          UButton: true,
          UInput: true,
          BaseDataTable: true,
          FeaturesDashboardTeacherRedeemPassModal: true
        }
      }
    })

    expect(capturedDescription).toBe('jane.doe@university.edu • Section 004')
  })

  it('displays "No section assigned" when student has no section', () => {
    let capturedDescription = ''
    mount(StudentRedemptionsModal, {
      props: {
        open: true,
        student: {
          ...baseStudent,
          sectionName: null
        }
      },
      global: {
        stubs: {
          UModal: {
            props: ['open', 'title', 'description'],
            setup(props) {
              capturedDescription = props.description
              return () => null
            }
          },
          UIcon: true,
          UButton: true,
          UInput: true,
          BaseDataTable: true,
          FeaturesDashboardTeacherRedeemPassModal: true
        }
      }
    })

    expect(capturedDescription).toBe('jane.doe@university.edu • No section assigned')
  })

  it('displays "No email" when student has null email', () => {
    let capturedDescription = ''
    mount(StudentRedemptionsModal, {
      props: {
        open: true,
        student: {
          ...baseStudent,
          studentEmail: null
        }
      },
      global: {
        stubs: {
          UModal: {
            props: ['open', 'title', 'description'],
            setup(props) {
              capturedDescription = props.description
              return () => null
            }
          },
          UIcon: true,
          UButton: true,
          UInput: true,
          BaseDataTable: true,
          FeaturesDashboardTeacherRedeemPassModal: true
        }
      }
    })

    expect(capturedDescription).toBe('No email • Section: Lab 01')
  })

  it('falls back to default description when student is null', () => {
    let capturedDescription = ''
    mount(StudentRedemptionsModal, {
      props: {
        open: true,
        student: null
      },
      global: {
        stubs: {
          UModal: {
            props: ['open', 'title', 'description'],
            setup(props) {
              capturedDescription = props.description
              return () => null
            }
          },
          UIcon: true,
          UButton: true,
          UInput: true,
          BaseDataTable: true,
          FeaturesDashboardTeacherRedeemPassModal: true
        }
      }
    })

    expect(capturedDescription).toBe('Student redemption history')
  })

  it('renders Redeem Pass button and opens force redeem modal when clicked', async () => {
    const wrapper = mount(StudentRedemptionsModal, {
      props: {
        open: true,
        student: baseStudent
      },
      global: {
        stubs: {
          UModal: {
            props: ['open', 'title', 'description'],
            setup(_props, { slots }) {
              return () => slots.body?.()
            }
          },
          UIcon: true,
          UButton: {
            props: ['label', 'icon'],
            template: '<button class="u-button" :data-label="label">{{ label }}</button>'
          },
          UInput: true,
          BaseDataTable: true,
          FeaturesDashboardTeacherRedeemPassModal: true
        }
      }
    })

    const vm = wrapper.vm as any
    expect(vm.forceRedeemModalOpen).toBe(false)

    const redeemBtn = wrapper.findAll('button').find((b) => b.text().includes('Redeem Pass'))
    expect(redeemBtn).toBeDefined()
    await redeemBtn?.trigger('click')

    expect(vm.forceRedeemModalOpen).toBe(true)
  })

  it('updates student balances and emits saved when onPassRedeemed is triggered', async () => {
    const wrapper = mount(StudentRedemptionsModal, {
      props: {
        open: true,
        student: { ...baseStudent }
      },
      global: {
        stubs: {
          UModal: true,
          UIcon: true,
          UButton: true,
          UInput: true,
          BaseDataTable: true,
          FeaturesDashboardTeacherRedeemPassModal: true
        }
      }
    })

    const vm = wrapper.vm as any
    const newBalances = [
      {
        passTypeId: 'pt-1',
        passTypeName: 'Late Pass',
        balance: 1,
        initialBalance: 3
      }
    ]

    vm.onPassRedeemed(newBalances)

    expect(wrapper.emitted('saved')).toBeTruthy()
    expect(wrapper.emitted('saved')?.[0]).toEqual([newBalances])
  })
})

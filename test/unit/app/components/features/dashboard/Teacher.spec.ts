import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, h } from 'vue'
import TeacherDashboard from '~/components/features/dashboard/Teacher.vue'
import type { StudentRosterRow } from '@@/shared/models/teacher'
import { actionsColumn } from '~/utils/tableHelpers'

const mockOpenStudentRedemptions = vi.fn()
const mockResyncAssignmentCbtfOverrides = vi.fn()
const mockRepairAssignmentCbtfTimezones = vi.fn()
const mockRepairAssignmentCbtfPassRedemptions = vi.fn()

vi.stubGlobal('useState', (_key: string, init?: () => any) => ref(init ? init() : null))
vi.stubGlobal('useToast', () => ({ add: vi.fn() }))
vi.stubGlobal('actionsColumn', actionsColumn)
vi.stubGlobal('h', h)

vi.mock('~/composables/features/useStudentView', () => ({
  useStudentView: () => ({
    isStudentView: ref(false),
    enterStudentView: vi.fn(),
    exitStudentView: vi.fn(),
    toggleStudentView: vi.fn()
  })
}))

const mockAssignmentsData = ref<{ data: any[] }>({ data: [] })

vi.mock('~/composables/features/useTeacherDashboard', () => ({
  useTeacherDashboard: () => ({
    assignmentsData: mockAssignmentsData,
    assignmentsStatus: ref('success'),
    assignmentsEditOpen: ref(false),
    editingAssignmentItem: ref(null),
    tableKey: ref(0),
    refreshAssignments: vi.fn(),
    openAssignmentEdit: vi.fn(),
    onAssignmentItemCreated: vi.fn(),

    sectionsData: ref({ data: [] }),
    sectionsStatus: ref('success'),
    refreshSections: vi.fn(),

    studentsData: ref({
      data: [
        {
          userId: 'user-1',
          studentName: 'Jane Doe',
          studentEmail: 'jane.doe@university.edu',
          sectionName: 'Discussion 1',
          passBalances: [],
          totalRedemptions: 0
        } satisfies StudentRosterRow
      ]
    }),
    studentsStatus: ref('success'),
    refreshStudents: vi.fn(),

    assignmentRedemptionsOpen: ref(false),
    selectedAssignmentForRedemptions: ref(null),
    openAssignmentRedemptions: vi.fn(),

    studentRedemptionsOpen: ref(false),
    selectedStudentForRedemptions: ref(null),
    openStudentRedemptions: mockOpenStudentRedemptions,

    rosterSyncModalOpen: ref(false),
    isRosterSyncing: ref(false),
    lastRosterSyncAt: ref(null),
    triggerManualRosterSync: vi.fn(),
    onRosterSynced: vi.fn(),

    canSync: ref(false),
    platformName: ref('Canvas'),
    syncing: ref(false),
    apiKeyModalOpen: ref(false),
    isSavingApiKey: ref(false),
    openApiKeyModal: vi.fn(),
    saveApiKey: vi.fn(),
    syncAssignments: vi.fn(),
    resyncAssignmentCbtfOverrides: mockResyncAssignmentCbtfOverrides,
    repairAssignmentCbtfTimezones: mockRepairAssignmentCbtfTimezones,
    repairAssignmentCbtfPassRedemptions: mockRepairAssignmentCbtfPassRedemptions
  })
}))

vi.mock('~/composables/features/useCourseContext', () => ({
  useCourseContext: () => ({
    currentCourse: ref({ id: 'c-1', title: 'Course 1' }),
    enrollments: ref([])
  })
}))

vi.mock('~/utils/date', () => ({
  formatDate: (d: string | null | undefined) => (d ? 'Formatted Date' : null)
}))

describe('TeacherDashboard Student Columns', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders student name as a clickable button that triggers openStudentRedemptions', () => {
    let capturedColumns: any[] = []
    let capturedData: any[] = []

    mount(TeacherDashboard, {
      global: {
        stubs: {
          BaseDataTable: {
            props: ['columns', 'data'],
            setup(props) {
              if (
                props.columns &&
                props.columns.some((c: any) => c.accessorKey === 'studentName')
              ) {
                capturedColumns = props.columns
                capturedData = props.data
              }
              return () => null
            }
          },
          UCard: true,
          UTabs: true,
          UButton: true,
          UIcon: true,
          UBadge: true,
          UTooltip: true,
          BasePageHeader: true,
          BaseStatusBadge: true,
          FeaturesAdminAssignmentEditPanel: true,
          FeaturesAdminPassTypeEditPanel: true,
          FeaturesDashboardAssignmentRedemptionsModal: true,
          FeaturesDashboardStudentRedemptionsModal: true,
          FeaturesDashboardPlatformApiKeyModal: true,
          FeaturesDashboardRosterSyncModal: true
        }
      }
    })

    const studentCol = capturedColumns.find((c) => c.accessorKey === 'studentName')
    expect(studentCol).toBeDefined()

    const mockRow = {
      getValue: vi.fn().mockReturnValue('Jane Doe'),
      original: capturedData[0]
    }

    const vnode = studentCol.cell({ row: mockRow })
    expect(vnode).toBeDefined()

    // Find the button VNode child
    const children = Array.isArray(vnode.children) ? vnode.children : []
    const buttonVNode = children.find((child: any) => child?.type === 'button')

    expect(buttonVNode).toBeDefined()
    expect(buttonVNode.props?.class).toContain('cursor-pointer')
    expect(buttonVNode.children).toBe('Jane Doe')

    // Trigger click
    buttonVNode.props.onClick()
    expect(mockOpenStudentRedemptions).toHaveBeenCalledWith(capturedData[0])
  })
})

describe('TeacherDashboard Assignment Actions', () => {
  it('includes "Resync Canvas Overrides" in three-dot menu for CBTF scheduled assignments', () => {
    let capturedAssignmentColumns: any[] = []

    mount(TeacherDashboard, {
      global: {
        stubs: {
          BaseDataTable: {
            props: ['columns', 'data'],
            setup(props) {
              if (props.columns && props.columns.some((c: any) => c.accessorKey === 'title')) {
                capturedAssignmentColumns = props.columns
              }
              return () => null
            }
          },
          UCard: true,
          UTabs: true,
          UButton: true,
          UIcon: true,
          UBadge: true,
          UTooltip: true,
          BasePageHeader: true,
          BaseStatusBadge: true,
          FeaturesAdminAssignmentEditPanel: true,
          FeaturesAdminPassTypeEditPanel: true,
          FeaturesDashboardAssignmentRedemptionsModal: true,
          FeaturesDashboardStudentRedemptionsModal: true,
          FeaturesDashboardPlatformApiKeyModal: true,
          FeaturesDashboardRosterSyncModal: true
        }
      }
    })

    const actionsCol = capturedAssignmentColumns.find((c) => c.id === 'actions')
    expect(actionsCol).toBeDefined()

    // Test with CBTF schedulable assignment
    const schedulableRow = {
      original: { id: 'asg-1', title: 'CBTF Quiz', isSchedulable: true, published: true },
      getValue: vi.fn()
    }
    const cellVNode = actionsCol.cell({ row: schedulableRow })
    expect(cellVNode).toBeDefined()
    const items = cellVNode.props?.items?.[0] || []
    const resyncAction = items.find((item: any) => item.label === 'Resync Canvas Overrides')
    expect(resyncAction).toBeDefined()
    expect(resyncAction.icon).toBe('i-lucide-refresh-cw')

    // Click it
    resyncAction.onSelect()
    expect(mockResyncAssignmentCbtfOverrides).toHaveBeenCalledWith(schedulableRow.original)

    // Test with non-schedulable assignment
    const nonSchedulableRow = {
      original: { id: 'asg-2', title: 'Regular Homework', isSchedulable: false, published: true },
      getValue: vi.fn()
    }
    const nonSchedulableVNode = actionsCol.cell({ row: nonSchedulableRow })
    const nonSchedulableItems = nonSchedulableVNode.props?.items?.[0] || []
    const missingAction = nonSchedulableItems.find(
      (item: any) => item.label === 'Resync Canvas Overrides'
    )
    expect(missingAction).toBeUndefined()
  })

  it('does not include repair admin actions in assignment action menu even when isAdmin is true', () => {
    let capturedAssignmentColumns: any[] = []

    mount(TeacherDashboard, {
      props: {
        isAdmin: true
      },
      global: {
        stubs: {
          BaseDataTable: {
            props: ['columns', 'data'],
            setup(props) {
              if (props.columns && props.columns.some((c: any) => c.accessorKey === 'title')) {
                capturedAssignmentColumns = props.columns
              }
              return () => null
            }
          },
          UCard: true,
          UTabs: true,
          UButton: true,
          UIcon: true,
          UBadge: true,
          UTooltip: true,
          BasePageHeader: true,
          BaseStatusBadge: true,
          FeaturesAdminAssignmentEditPanel: true,
          FeaturesAdminPassTypeEditPanel: true,
          FeaturesDashboardAssignmentRedemptionsModal: true,
          FeaturesDashboardStudentRedemptionsModal: true,
          FeaturesDashboardPlatformApiKeyModal: true,
          FeaturesDashboardRosterSyncModal: true
        }
      }
    })

    const actionsCol = capturedAssignmentColumns.find((c) => c.id === 'actions')
    expect(actionsCol).toBeDefined()

    const schedulableRow = {
      original: { id: 'asg-1', title: 'CBTF Quiz', isSchedulable: true, published: true },
      getValue: vi.fn()
    }
    const cellVNode = actionsCol.cell({ row: schedulableRow })
    const items = cellVNode.props?.items?.[0] || []

    const repairPassAction = items.find(
      (item: any) => item.label === 'Repair Pass Redemptions (Admin)'
    )
    expect(repairPassAction).toBeUndefined()

    const repairTzAction = items.find(
      (item: any) => item.label === 'Repair Timezones & Reseat (Admin)'
    )
    expect(repairTzAction).toBeUndefined()
  })

  it('renders TeacherGtaShiftsSection and opens CourseSettingsModal when clicking Course Settings', async () => {
    let capturedModalOpen = false

    const wrapper = mount(TeacherDashboard, {
      props: {
        courseId: 'course-123',
        courseTitle: 'CS 1114',
        isAdmin: true,
        interviewLocation: 'McBryde 106'
      },
      global: {
        stubs: {
          UPageHeader: {
            template: '<div><slot name="links" /><slot /></div>'
          },
          BaseDataTable: true,
          UButton: {
            template: '<button @click="$emit(\'click\')"><slot /></button>'
          },
          BaseButton: {
            template: '<button @click="$emit(\'click\')"><slot /></button>'
          },
          FeaturesCourseSettingsModal: {
            props: ['open', 'courseId', 'initialLocation'],
            template: '<div data-testid="course-settings-modal" :data-open="open"></div>',
            setup(props) {
              return () => {
                capturedModalOpen = !!props.open
                return h('div', { 'data-testid': 'course-settings-modal', 'data-open': props.open })
              }
            }
          },
          FeaturesTeacherTeacherGtaShiftsSection: {
            props: ['courseId', 'interviewLocation'],
            template: '<div data-testid="gta-shifts-section"></div>'
          },
          FeaturesAdminAssignmentEditPanel: true,
          FeaturesAdminPassTypeEditPanel: true,
          FeaturesDashboardAssignmentRedemptionsModal: true,
          FeaturesDashboardStudentRedemptionsModal: true,
          FeaturesDashboardPlatformApiKeyModal: true,
          FeaturesDashboardRosterSyncModal: true
        }
      }
    })

    // Check GTA shifts section rendered
    const gtaSection = wrapper.find('[data-testid="gta-shifts-section"]')
    expect(gtaSection.exists()).toBe(true)

    // Find and click "Course Settings" button
    const buttons = wrapper.findAll('button')
    const settingsBtn = buttons.find((b) => b.text().includes('Course Settings'))
    expect(settingsBtn).toBeDefined()
    await settingsBtn!.trigger('click')

    expect(capturedModalOpen).toBe(true)
  })
})

describe('TeacherDashboard Assignment Table Filters', () => {
  const sampleAssignments = [
    {
      id: 'asg-pub-active-standard',
      title: 'Active Standard HW',
      published: true,
      dueDate: new Date(Date.now() + 86400000).toISOString(),
      acceptUntil: new Date(Date.now() + 86400000).toISOString(),
      isSchedulable: false,
      hasInterviews: false,
      eligiblePassTypeNames: []
    },
    {
      id: 'asg-unpub-active-standard',
      title: 'Unpublished HW',
      published: false,
      dueDate: new Date(Date.now() + 86400000).toISOString(),
      acceptUntil: new Date(Date.now() + 86400000).toISOString(),
      isSchedulable: false,
      hasInterviews: false,
      eligiblePassTypeNames: []
    },
    {
      id: 'asg-pub-expired-standard',
      title: 'Past Expired HW',
      published: true,
      dueDate: new Date(Date.now() - 86400000).toISOString(),
      acceptUntil: new Date(Date.now() - 86400000).toISOString(),
      isSchedulable: false,
      hasInterviews: false,
      eligiblePassTypeNames: []
    },
    {
      id: 'asg-pub-active-cbtf',
      title: 'Active CBTF Quiz',
      published: true,
      dueDate: new Date(Date.now() + 86400000).toISOString(),
      acceptUntil: new Date(Date.now() + 86400000).toISOString(),
      isSchedulable: true,
      hasInterviews: false,
      eligiblePassTypeNames: []
    },
    {
      id: 'asg-pub-active-gta',
      title: 'Active GTA Interview',
      published: true,
      dueDate: new Date(Date.now() + 86400000).toISOString(),
      acceptUntil: new Date(Date.now() + 86400000).toISOString(),
      isSchedulable: false,
      hasInterviews: true,
      eligiblePassTypeNames: []
    }
  ]

  beforeEach(() => {
    mockAssignmentsData.value = { data: sampleAssignments }
  })

  it('shows all assignments by default and updates dynamically when toggling filters', async () => {
    let capturedAssignmentData: any[] = []
    let capturedMenuItems: any = null

    const wrapper = mount(TeacherDashboard, {
      global: {
        stubs: {
          BaseDataTable: {
            props: ['columns', 'data'],
            setup(props, { slots }) {
              return () => {
                if (props.columns && props.columns.some((c: any) => c.accessorKey === 'title')) {
                  capturedAssignmentData = props.data
                }
                return h('div', { class: 'data-table-stub' }, [
                  slots.filters ? slots.filters() : null,
                  slots.toolbar ? slots.toolbar() : null
                ])
              }
            }
          },
          UDropdownMenu: {
            props: ['items'],
            setup(props, { slots }) {
              return () => {
                capturedMenuItems = props.items
                return h(
                  'div',
                  { class: 'dropdown-menu-stub' },
                  slots.default ? slots.default() : null
                )
              }
            }
          },
          UButton: {
            props: ['label', 'color'],
            template: '<button :data-color="color">{{ label }}<slot /></button>'
          },
          BaseButton: true,
          UPageHeader: { template: '<div><slot name="links" /><slot /></div>' },
          UCard: true,
          FeaturesAdminAssignmentEditPanel: true,
          FeaturesAdminPassTypeEditPanel: true,
          FeaturesDashboardAssignmentRedemptionsModal: true,
          FeaturesDashboardStudentRedemptionsModal: true,
          FeaturesDashboardPlatformApiKeyModal: true,
          FeaturesDashboardRosterSyncModal: true,
          FeaturesTeacherTeacherGtaShiftsSection: true,
          FeaturesCourseSettingsModal: true
        }
      }
    })

    // 1. All assignments shown by default (no filters applied)
    expect(capturedAssignmentData).toHaveLength(5)
    expect(capturedAssignmentData.map((a) => a.id)).toEqual([
      'asg-pub-expired-standard',
      'asg-pub-active-standard',
      'asg-unpub-active-standard',
      'asg-pub-active-cbtf',
      'asg-pub-active-gta'
    ])

    // Filter button shows default "Filter" label
    const filterBtn = () => wrapper.findAll('button').find((b) => b.text().includes('Filter'))!
    expect(filterBtn().text()).toBe('Filter')

    // Find filter menu items
    expect(capturedMenuItems).toBeDefined()
    const allItems = capturedMenuItems.flat()

    const unpubItem = allItems.find((i: any) => i.label === 'Unpublished')
    expect(unpubItem).toBeDefined()
    expect(unpubItem.checked).toBe(true)

    const expiredItem = allItems.find((i: any) => i.label === 'Expired (Past Cutoff)')
    expect(expiredItem).toBeDefined()
    expect(expiredItem.checked).toBe(true)

    const cbtfItem = allItems.find((i: any) => i.label === 'CBTF Exams')
    expect(cbtfItem).toBeDefined()
    expect(cbtfItem.checked).toBe(true)

    // 2. Toggle Unpublished off -> dynamically excludes unpublished assignments
    unpubItem.onUpdateChecked(false)
    await wrapper.vm.$nextTick()

    expect(capturedAssignmentData).toHaveLength(4)
    expect(capturedAssignmentData.map((a) => a.id)).not.toContain('asg-unpub-active-standard')
    expect(filterBtn().text()).toContain('Filter (custom)')

    // 3. Toggle Expired off -> dynamically excludes expired assignments
    expiredItem.onUpdateChecked(false)
    await wrapper.vm.$nextTick()

    expect(capturedAssignmentData).toHaveLength(3)
    expect(capturedAssignmentData.map((a) => a.id)).not.toContain('asg-pub-expired-standard')

    // 4. Toggle CBTF off -> dynamically excludes CBTF assignments
    cbtfItem.onUpdateChecked(false)
    await wrapper.vm.$nextTick()

    expect(capturedAssignmentData).toHaveLength(2)
    expect(capturedAssignmentData.map((a) => a.id)).toEqual([
      'asg-pub-active-standard',
      'asg-pub-active-gta'
    ])

    // 5. Reset to default -> restores all assignments and reverts button label
    const resetItem = capturedMenuItems.flat().find((i: any) => i.label === 'Reset to default')
    expect(resetItem).toBeDefined()
    expect(resetItem.disabled).toBe(false)

    resetItem.onSelect()
    await wrapper.vm.$nextTick()

    expect(capturedAssignmentData).toHaveLength(5)
    expect(capturedAssignmentData.map((a) => a.id)).toEqual([
      'asg-pub-expired-standard',
      'asg-pub-active-standard',
      'asg-unpub-active-standard',
      'asg-pub-active-cbtf',
      'asg-pub-active-gta'
    ])
    expect(filterBtn().text()).toBe('Filter')
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, h } from 'vue'
import TeacherDashboard from '~/components/features/dashboard/Teacher.vue'
import type { StudentRosterRow } from '@@/shared/models/teacher'
import { actionsColumn } from '~/utils/tableHelpers'

const mockOpenStudentRedemptions = vi.fn()
const mockResyncAssignmentCbtfOverrides = vi.fn()

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

vi.mock('~/composables/features/useTeacherDashboard', () => ({
  useTeacherDashboard: () => ({
    assignmentsData: ref({ data: [] }),
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
    resyncAssignmentCbtfOverrides: mockResyncAssignmentCbtfOverrides
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

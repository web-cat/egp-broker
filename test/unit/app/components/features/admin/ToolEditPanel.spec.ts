import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import ToolEditPanel from '~/components/features/admin/ToolEditPanel.vue'
import type { ToolRow } from '@@/shared/models/tool'

const mockRegisterPassPort = vi.fn()
const mockSaveTool = vi.fn()
const mockToastAdd = vi.fn()

vi.stubGlobal('useAdminPlatforms', () => ({
  fetchPlatforms: vi.fn().mockReturnValue({
    data: ref({
      data: [{ id: 'plat-1', issuer: 'https://canvas.example.edu' }]
    })
  })
}))

vi.stubGlobal('useAdminTools', () => ({
  saveTool: mockSaveTool,
  registerPassPort: mockRegisterPassPort
}))

vi.mock('~/utils/date', () => ({
  formatDate: (d: string | null) => (d ? 'Sep 6, 2026, 12:00 PM' : '')
}))

vi.stubGlobal('useI18n', () => ({
  t: (k: string) => k,
  locale: ref('en-US')
}))

vi.stubGlobal('useToast', () => ({
  add: mockToastAdd
}))

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
  UCheckbox: {
    props: ['modelValue', 'label'],
    template: '<label><input type="checkbox" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)" />{{ label }}</label>'
  },
  USelect: true,
  BaseFormInput: {
    props: ['modelValue', 'label', 'name'],
    template: '<div><label>{{ label }}</label><input :name="name" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" /></div>'
  },
  UBadge: {
    props: ['color', 'variant', 'icon'],
    template: '<span class="badge" :data-color="color"><slot /></span>'
  },
  UButton: {
    props: ['label', 'loading'],
    template: '<button :disabled="loading" @click="$emit(\'click\')">{{ label }}</button>'
  },
  UAlert: {
    props: ['color', 'title', 'description'],
    template: '<div class="alert" :data-color="color"><span>{{ title }}</span><p>{{ description }}</p></div>'
  }
}

describe('ToolEditPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders default values for a new tool (supportsProxy=true, supportsPassport=false)', async () => {
    const wrapper = mount(ToolEditPanel, {
      props: {
        open: true,
        tool: null
      },
      global: {
        stubs: globalStubs
      }
    })

    await flushPromises()

    expect(wrapper.text()).toContain('Supports LTI Proxy')
    expect(wrapper.text()).toContain('Supports PassPort Extensions')
    expect(wrapper.text()).toContain('LTI Proxy Credentials')
    // PassPort section not shown when supportsPassport is false
    expect(wrapper.text()).not.toContain('PassPort Configuration')
  })

  it('renders PassPort configuration and status badge when tool has supportsPassport=true', async () => {
    const mockTool: ToolRow = {
      id: 'tool-1',
      name: 'CodeWorkout',
      baseUrl: 'https://codeworkout.edu',
      protocol: 'LTI13',
      key: 'cw-key',
      supportsProxy: true,
      supportsPassport: true,
      supportsExtensionApi: true,
      passportClientId: 'cw_client_1',
      passportRegistrationUrl: 'https://codeworkout.edu/api/passport/v1/register',
      passportExtensionUrl: 'https://codeworkout.edu/api/passport/v1/extensions',
      passportRegistrationStatus: 'REGISTERED',
      passportRegistrationError: null,
      passportRegisteredAt: '2026-09-06T12:00:00Z',
      passportRequestedProperties: null,
      platformId: 'plat-1',
      platformIssuer: 'https://canvas.example.edu',
      createdAt: '2026-09-01T00:00:00Z'
    }

    const wrapper = mount(ToolEditPanel, {
      props: {
        open: true,
        tool: mockTool
      },
      global: {
        stubs: globalStubs
      }
    })

    await flushPromises()

    expect(wrapper.text()).toContain('PassPort Configuration')
    expect(wrapper.text()).toContain('Registered')
    expect(wrapper.text()).toContain('Sep 6, 2026, 12:00 PM')
    expect(wrapper.text()).toContain('Register with PassPort')
  })

  it('displays failure alert banner when passportRegistrationStatus is FAILED', async () => {
    const mockTool: ToolRow = {
      id: 'tool-2',
      name: 'Failing Tool',
      baseUrl: 'https://fail.edu',
      protocol: 'LTI13',
      key: null,
      supportsProxy: false,
      supportsPassport: true,
      supportsExtensionApi: true,
      passportClientId: null,
      passportRegistrationUrl: 'https://fail.edu/register',
      passportExtensionUrl: null,
      passportRegistrationStatus: 'FAILED',
      passportRegistrationError: 'Connection timed out after 10000ms',
      passportRegisteredAt: null,
      passportRequestedProperties: null,
      platformId: null,
      platformIssuer: null,
      createdAt: '2026-09-01T00:00:00Z'
    }

    const wrapper = mount(ToolEditPanel, {
      props: {
        open: true,
        tool: mockTool
      },
      global: {
        stubs: globalStubs
      }
    })

    await flushPromises()

    expect(wrapper.text()).toContain('Failed')
    expect(wrapper.text()).toContain('Registration Failed')
    expect(wrapper.text()).toContain('Connection timed out after 10000ms')
  })

  it('triggers registerPassPort on clicking registration button and emits saved on success', async () => {
    const mockTool: ToolRow = {
      id: 'tool-3',
      name: 'Unregistered Tool',
      baseUrl: 'https://tool.edu',
      protocol: 'LTI13',
      key: null,
      supportsProxy: false,
      supportsPassport: true,
      supportsExtensionApi: true,
      passportClientId: null,
      passportRegistrationUrl: 'https://tool.edu/register',
      passportExtensionUrl: null,
      passportRegistrationStatus: 'NOT_REGISTERED',
      passportRegistrationError: null,
      passportRegisteredAt: null,
      passportRequestedProperties: null,
      platformId: null,
      platformIssuer: null,
      createdAt: '2026-09-01T00:00:00Z'
    }

    mockRegisterPassPort.mockResolvedValue({
      data: {
        ...mockTool,
        passportRegistrationStatus: 'PENDING'
      }
    })

    const wrapper = mount(ToolEditPanel, {
      props: {
        open: true,
        tool: mockTool
      },
      global: {
        stubs: globalStubs
      }
    })

    await flushPromises()

    // Find and click the "Register with PassPort" button
    const regButton = wrapper.findAll('button').find((b) => b.text().includes('Register with PassPort'))
    expect(regButton).toBeDefined()
    await regButton!.trigger('click')
    await flushPromises()

    expect(mockRegisterPassPort).toHaveBeenCalledWith('tool-3')
    expect(wrapper.emitted('saved')).toBeTruthy()
    expect(wrapper.emitted('saved')![0]).toEqual(['tool-3', { ...mockTool, passportRegistrationStatus: 'PENDING' }])
    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ title: 'PassPort registration initiated' }))
  })
})

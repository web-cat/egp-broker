import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import AdminIndexPage from '~/pages/admin/index.vue'

const mockUser = ref<any>({
  id: 'admin-1',
  email: 'admin@vt.edu',
  globalRole: 'ADMIN'
})

const mockToastAdd = vi.fn()

vi.mock('~/composables/features/useAdminStats', () => ({
  useAdminStats: () => ({
    error: ref(null),
    status: ref('idle'),
    stats: ref({
      platforms: 2,
      deployments: 3,
      platformList: [],
      deploymentList: []
    }),
    simpleCards: ref([])
  })
}))

vi.stubGlobal('useUserSession', () => ({
  user: mockUser
}))

vi.stubGlobal('useToast', () => ({
  add: mockToastAdd
}))

describe('app/pages/admin/index.vue', () => {
  const stubs = {
    UAlert: true,
    UIcon: true,
    UButton: {
      props: ['label', 'loading'],
      template: '<button :disabled="loading"><slot />{{ label }}</button>'
    },
    BaseCard: {
      template: '<div class="base-card"><slot /></div>'
    },
    NuxtLink: {
      props: ['to'],
      template: '<a><slot /></a>'
    },
    USkeleton: true
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders Email System Test section and sends test email', async () => {
    const mock$fetch = vi.fn().mockResolvedValueOnce({
      statusCode: 200,
      data: { success: true, email: 'admin@vt.edu' }
    })
    vi.stubGlobal('$fetch', mock$fetch)

    const wrapper = mount(AdminIndexPage, {
      global: { stubs }
    })

    expect(wrapper.text()).toContain('Email System Test')
    expect(wrapper.text()).toContain('admin@vt.edu')

    const button = wrapper.find('[data-testid="send-test-email-btn"]')
    expect(button.exists()).toBe(true)

    await button.trigger('click')

    expect(mock$fetch).toHaveBeenCalledWith('/api/admin/test-email', { method: 'POST' })
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Test Email Sent',
        color: 'success'
      })
    )
  })

  it('handles email send error and shows error toast', async () => {
    const mock$fetch = vi.fn().mockRejectedValueOnce({
      data: { statusMessage: 'SMTP connection refused' }
    })
    vi.stubGlobal('$fetch', mock$fetch)

    const wrapper = mount(AdminIndexPage, {
      global: { stubs }
    })

    const button = wrapper.find('[data-testid="send-test-email-btn"]')
    await button.trigger('click')

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Email Test Failed',
        description: 'SMTP connection refused',
        color: 'error'
      })
    )
  })
})

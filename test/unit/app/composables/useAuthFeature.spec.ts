import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, computed } from 'vue'
import { useAuthFeature } from '../../../../app/composables/features/useAuthFeature'

const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)
vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('useI18n', () => ({ t: (k: string) => k }))
vi.stubGlobal('useLocalePath', () => (p: string) => p)
vi.stubGlobal('useNotifications', () => ({ success: vi.fn(), error: vi.fn() }))
vi.stubGlobal('navigateTo', vi.fn())

const mockUser = ref<{ id: string; email: string; avatarUrl?: string | null } | null>({
  id: 'u-1',
  email: 'test@vt.edu',
  avatarUrl: null
})
const mockClear = vi.fn()
const mockRefresh = vi.fn()

vi.stubGlobal('useUserSession', () => ({
  loggedIn: computed(() => !!mockUser.value),
  user: mockUser,
  clear: mockClear,
  fetch: mockRefresh
}))

describe('useAuthFeature', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('computes robohash avatar fallback when avatarUrl is null', () => {
    const { avatarSrc } = useAuthFeature()
    expect(avatarSrc.value).toContain('robohash')
  })

  it('delegates login POST to /api/auth/login', async () => {
    mockFetch.mockResolvedValueOnce({ statusCode: 200, data: { user: { id: 'u-1' } } })
    const { login } = useAuthFeature()

    const res = await login({ email: 'test@vt.edu', password: 'password' })
    expect(mockFetch).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST',
      body: { email: 'test@vt.edu', password: 'password' }
    })
    expect(res.statusCode).toBe(200)
  })

  it('delegates register POST to /api/auth/register', async () => {
    mockFetch.mockResolvedValueOnce({ statusCode: 201, data: { email: 'test@vt.edu' } })
    const { register } = useAuthFeature()

    await register({ email: 'test@vt.edu' })
    expect(mockFetch).toHaveBeenCalledWith('/api/auth/register', {
      method: 'POST',
      body: { email: 'test@vt.edu' }
    })
  })

  it('delegates forgotPassword POST to /api/auth/forgot-password', async () => {
    mockFetch.mockResolvedValueOnce({ statusCode: 200, data: { email: 'test@vt.edu' } })
    const { forgotPassword } = useAuthFeature()

    await forgotPassword({ email: 'test@vt.edu' })
    expect(mockFetch).toHaveBeenCalledWith('/api/auth/forgot-password', {
      method: 'POST',
      body: { email: 'test@vt.edu' }
    })
  })

  it('delegates resetPassword POST to /api/auth/reset-password', async () => {
    mockFetch.mockResolvedValueOnce({ statusCode: 200, data: { email: 'test@vt.edu' } })
    const { resetPassword } = useAuthFeature()

    await resetPassword({ token: 'tok', password: 'new' })
    expect(mockFetch).toHaveBeenCalledWith('/api/auth/reset-password', {
      method: 'POST',
      body: { token: 'tok', password: 'new' }
    })
  })

  it('delegates resendVerification POST to /api/auth/resend-verification', async () => {
    mockFetch.mockResolvedValueOnce({ statusCode: 200, data: { email: 'test@vt.edu' } })
    const { resendVerification } = useAuthFeature()

    await resendVerification({ email: 'test@vt.edu' })
    expect(mockFetch).toHaveBeenCalledWith('/api/auth/resend-verification', {
      method: 'POST',
      body: { email: 'test@vt.edu' }
    })
  })

  it('delegates verifyEmail POST to /api/auth/verify-email', async () => {
    mockFetch.mockResolvedValueOnce({ statusCode: 200, data: { loggedIn: true } })
    const { verifyEmail } = useAuthFeature()

    await verifyEmail('token-123')
    expect(mockFetch).toHaveBeenCalledWith('/api/auth/verify-email', {
      method: 'POST',
      body: { token: 'token-123' }
    })
  })

  it('handles logout and navigates to home', async () => {
    mockFetch.mockResolvedValueOnce({})
    const { handleLogout } = useAuthFeature()

    await handleLogout()
    expect(mockClear).toHaveBeenCalled()
    expect(mockFetch).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' })
  })
})

import type { ApiResponse } from '@@/shared/types/api'
import type { PublicUser } from '@@/shared/models/user'

export const useAuthFeature = () => {
  const { loggedIn, user, clear, fetch: refreshSession } = useUserSession()
  const { t } = useI18n()
  const localePath = useLocalePath()
  const { success } = useNotifications()

  const avatarSrc = computed(() => {
    const base =
      user.value?.avatarUrl ||
      'https://0.gravatar.com/avatar/0000000000000000000000000000000000000000000000000000000000000000?d=robohash'
    return `${base}&s=150`
  })

  const login = async (body: unknown): Promise<ApiResponse<{ user: PublicUser }>> => {
    return $fetch<ApiResponse<{ user: PublicUser }>>('/api/auth/login', {
      method: 'POST',
      body
    })
  }

  const register = async (
    body: unknown
  ): Promise<ApiResponse<{ message: string; email: string }>> => {
    return $fetch<ApiResponse<{ message: string; email: string }>>('/api/auth/register', {
      method: 'POST',
      body
    })
  }

  const forgotPassword = async (
    body: unknown
  ): Promise<ApiResponse<{ message: string; email: string }>> => {
    return $fetch<ApiResponse<{ message: string; email: string }>>('/api/auth/forgot-password', {
      method: 'POST',
      body
    })
  }

  const resetPassword = async (
    body: unknown
  ): Promise<ApiResponse<{ message: string; email: string }>> => {
    return $fetch<ApiResponse<{ message: string; email: string }>>('/api/auth/reset-password', {
      method: 'POST',
      body
    })
  }

  const resendVerification = async (
    body: unknown
  ): Promise<ApiResponse<{ message: string; email: string }>> => {
    return $fetch<ApiResponse<{ message: string; email: string }>>(
      '/api/auth/resend-verification',
      {
        method: 'POST',
        body
      }
    )
  }

  const verifyEmail = async (
    token: string
  ): Promise<ApiResponse<{ user: PublicUser; loggedIn: boolean }>> => {
    return $fetch<ApiResponse<{ user: PublicUser; loggedIn: boolean }>>('/api/auth/verify-email', {
      method: 'POST',
      body: { token }
    })
  }

  const handleLogout = async () => {
    try {
      clear()
      await $fetch('/api/auth/logout', { method: 'POST' })

      success({
        title: t('auth.logout.messages.success.title'),
        message: t('auth.logout.messages.success.message')
      })

      await navigateTo(localePath('/'))
    } catch (e) {
      console.error('Logout error:', e)
      clear()
      await navigateTo(localePath('/'))
    }
  }

  return {
    loggedIn,
    user,
    avatarSrc,
    login,
    register,
    forgotPassword,
    resetPassword,
    resendVerification,
    verifyEmail,
    handleLogout,
    refreshSession
  }
}

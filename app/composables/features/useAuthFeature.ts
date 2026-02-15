
import { useUserSession } from '#imports'

export const useAuthFeature = () => {
    const { loggedIn, user, clear, fetch: refreshSession } = useUserSession()
    const { t } = useI18n()
    const localePath = useLocalePath()
    const { success } = useNotifications()

    const avatarSrc = computed(() => {
        const base = user.value?.avatarUrl || 'https://0.gravatar.com/avatar/0000000000000000000000000000000000000000000000000000000000000000?d=robohash'
        return `${base}&s=150`
    })

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
        handleLogout,
        refreshSession
    }
}


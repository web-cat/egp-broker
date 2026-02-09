<template>
  <UMain>
    <UHeader :to="localePath('/')">
      <template #title>
        <h1 class="text-2xl font-bold">
          <span class="text-primary">{{ appNameParts[0] }}</span>
          <span v-if="appNameParts[1]" class="text-secondary">{{ appNameParts[1] }}</span>
        </h1>
      </template>

      <template #right>
        <!-- User menu when logged in -->
        <UDropdownMenu v-if="loggedIn" :items="items">
          <UAvatar :alt="user?.name" :src="avatarSrc" size="sm" class="cursor-pointer" />
        </UDropdownMenu>

        <!-- Login button when not logged in -->
        <UButton
          v-else
          :to="localePath('/auth/login')"
          color="primary"
          variant="soft"
          size="sm"
          icon="i-lucide-log-in"
        >
          {{ t('auth.login.title') }}
        </UButton>

        <UButton
          v-if="loggedIn"
          variant="ghost"
          color="neutral"
          icon="i-lucide-library"
          :title="t('global.actions.changeCourse')"
          @click="handleChangeCourse"
        />

        <UButton
          v-if="user?.globalRole === 'ADMIN'"
          variant="ghost"
          color="neutral"
          icon="i-lucide-wrench"
          :to="localePath('/admin')"
          :title="t('pages.admin.title')"
        />

        <UColorModeButton />
      </template>
    </UHeader>

    <slot />

    <UFooter>
      <template #left>
        <p class="text-sm text-neutral-600 dark:text-neutral-400">
          {{ t('global.app.footer') }} • v{{ appVersion }}
        </p>
      </template>

      <template #right>
        <ULocaleSelect
          :model-value="locale"
          :locales="availableLocales"
          @update:model-value="(newLocale: string) => navigateTo(switchLocalePath(newLocale))"
        />
      </template>
    </UFooter>
  </UMain>
</template>

<script lang="ts" setup>
import type { DropdownMenuItem } from '@nuxt/ui'

const { loggedIn, user, clear, fetch: refreshSession } = useUserSession()
const { locale, locales, t } = useI18n()
const localePath = useLocalePath()
const switchLocalePath = useSwitchLocalePath()
const { success } = useNotifications()

// const hasContext = computed(() => !!user.value?.currentCourseId)

const handleChangeCourse = async () => {
  try {
    await $fetch('/api/me/context', { method: 'DELETE' })
    // Hard refresh to ensure all client state is properly reset
    await refreshSession()
    await navigateTo('/')
  } catch (e) {
    console.error('Failed to clear context:', e)
  }
}

// Available locales for the selector
const availableLocales = computed(() =>
  locales.value.map((l: any) => ({ code: l.code, name: l.name }))
)

const handleLogout = async () => {
  try {
    clear()

    await $fetch('/api/auth/logout', { method: 'POST' })

    success({
      title: t('auth.logout.messages.success.title'),
      message: t('auth.logout.messages.success.message')
    })

    await navigateTo(localePath('/'))
  } catch {
    // Handle logout error silently for all cases
    clear()
    await navigateTo(localePath('/'))
  }
}

// Computed properties
const appNameParts = computed(() => {
  const name = t('global.app.name')
  return name.split(' ')
})

const appVersion = computed(() => {
  const config = useRuntimeConfig()
  return config.public.version || '1.0.0'
})

const avatarSrc = computed(() => {
  const base =
    user.value?.avatarUrl ||
    'https://0.gravatar.com/avatar/0000000000000000000000000000000000000000000000000000000000000000?d=robohash'
  return `${base}&s=150`
})

const items = computed<DropdownMenuItem[][]>(() => [
  [
    {
      label: user.value?.name || user.value?.email,
      type: 'label',
      avatar: {
        src: avatarSrc.value
      }
    }
  ],
  [
    {
      label: t('auth.logout.title'),
      icon: 'i-lucide-log-out',
      onSelect: handleLogout
    }
  ]
])

// Head configuration
useHead({
  title: t('global.app.name'),
  meta: [
    { name: 'description', content: t('global.app.description') },
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ]
})
</script>

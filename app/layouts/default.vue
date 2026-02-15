<template>
  <UMain>
    <UHeader :to="localePath('/')" class="glass sticky top-0 z-50">
      <template #title>
        <h1 class="text-2xl font-bold tracking-tight">
          <span class="text-primary-600 dark:text-primary-400">{{ appNameParts[0] }}</span>
          <span v-if="appNameParts[1]" class="text-gray-500 dark:text-gray-400 font-light ml-1">{{
            appNameParts[1]
          }}</span>
        </h1>
      </template>

      <template #right>
        <!-- User menu when logged in -->
        <UserMenu v-if="loggedIn" />

        <!-- Login button when not logged in -->
        <BaseButton
          v-else
          :to="localePath('/auth/login')"
          color="primary"
          variant="soft"
          size="sm"
          icon="i-lucide-log-in"
        >
          {{ t('auth.login.title') }}
        </BaseButton>

        <BaseButton
          v-if="loggedIn"
          variant="ghost"
          color="neutral"
          icon="i-lucide-library"
          :title="t('global.actions.changeCourse')"
          @click="handleChangeCourse"
        />

        <BaseButton
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

    <div class="relative min-h-screen">
      <!-- Ambient Background Glow -->
      <div class="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div
          class="absolute top-0 left-1/4 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl"
        ></div>
        <div
          class="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary-500/10 rounded-full blur-3xl"
        ></div>
      </div>

      <slot />
    </div>

    <UFooter class="glass mt-auto border-t border-gray-200 dark:border-gray-800">
      <template #left>
        <p class="text-sm text-gray-500 dark:text-gray-400">
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
import { useCourseContext } from '~/composables/features/useCourseContext'
import UserMenu from '~/components/features/auth/UserMenu.vue'

const { loggedIn, user } = useUserSession()
const { locale, locales, t } = useI18n()
const localePath = useLocalePath()
const switchLocalePath = useSwitchLocalePath()
const { clearCourseContext } = useCourseContext()

const handleChangeCourse = async () => {
  await clearCourseContext()
}

// Available locales for the selector
const availableLocales = computed(() =>
  locales.value.map((l: any) => ({ code: l.code, name: l.name }))
)

// Computed properties
const appNameParts = computed(() => {
  const name = t('global.app.name')
  return name.split(' ')
})

const appVersion = computed(() => {
  const config = useRuntimeConfig()
  return config.public.version || '1.0.0'
})

// Head configuration
useHead({
  title: t('global.app.name'),
  meta: [
    { name: 'description', content: t('global.app.description') },
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ]
})
</script>

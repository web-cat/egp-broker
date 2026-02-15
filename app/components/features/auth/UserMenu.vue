<template>
  <UDropdownMenu :items="items">
    <UAvatar
      :alt="user ? `${user.firstName} ${user.lastName}` : 'User'"
      :src="avatarSrc"
      size="sm"
      class="cursor-pointer ring-2 ring-transparent hover:ring-primary-500 transition-all"
    />
  </UDropdownMenu>
</template>

<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { useAuthFeature } from '~/composables/features/useAuthFeature' // Explicit import if auto-import fails or for clarity

const { user, avatarSrc, handleLogout } = useAuthFeature()
const { t } = useI18n()

const items = computed<DropdownMenuItem[][]>(() => [
  [
    {
      label: user.value ? `${user.value.firstName} ${user.value.lastName}` : user.value?.email,
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
</script>

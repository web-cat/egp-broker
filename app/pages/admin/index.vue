<template>
  <div class="space-y-8">
    <UAlert
      v-if="error"
      color="error"
      icon="i-lucide-alert-triangle"
      title="Failed to load stats"
      :description="error.message"
    />

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
      <!-- Platforms Card -->
      <UCard class="text-center">
        <p class="text-sm font-medium uppercase">
          <NuxtLink
            to="/admin/platforms"
            class="text-neutral-500 hover:text-primary-500 transition-colors underline-offset-2 hover:underline"
          >
            Platforms
          </NuxtLink>
        </p>
        <p class="text-3xl font-bold mt-2">
          <USkeleton v-if="status === 'pending'" class="h-9 w-16 mx-auto" />
          <span v-else>{{ stats?.platforms ?? '—' }}</span>
        </p>
        <ul
          v-if="stats?.platformList?.length"
          class="mt-4 text-sm text-left space-y-1 text-neutral-600 dark:text-neutral-400"
        >
          <li v-for="p in stats.platformList" :key="p.id" class="truncate">
            {{ p.issuer ?? p.name }}
          </li>
        </ul>
      </UCard>

      <!-- Deployments Card -->
      <UCard class="text-center">
        <p class="text-sm font-medium uppercase">
          <NuxtLink
            to="/admin/deployments"
            class="text-neutral-500 hover:text-primary-500 transition-colors underline-offset-2 hover:underline"
          >
            Deployments
          </NuxtLink>
        </p>
        <p class="text-3xl font-bold mt-2">
          <USkeleton v-if="status === 'pending'" class="h-9 w-16 mx-auto" />
          <span v-else>{{ stats?.deployments ?? '—' }}</span>
        </p>
        <ul
          v-if="stats?.deploymentList?.length"
          class="mt-4 text-sm text-left space-y-1 text-neutral-600 dark:text-neutral-400"
        >
          <li v-for="d in stats.deploymentList" :key="d.id" class="truncate font-mono">
            {{ d.deploymentId }}
          </li>
        </ul>
      </UCard>

      <!-- Simple count cards -->
      <UCard v-for="stat in simpleCards" :key="stat.label" class="text-center">
        <p class="text-sm font-medium uppercase">
          <NuxtLink
            :to="stat.to"
            class="text-neutral-500 hover:text-primary-500 transition-colors underline-offset-2 hover:underline"
          >
            {{ stat.label }}
          </NuxtLink>
        </p>
        <p class="text-3xl font-bold mt-2">
          <USkeleton v-if="status === 'pending'" class="h-9 w-16 mx-auto" />
          <span v-else>{{ stat.value }}</span>
        </p>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ApiResponse } from '@@/shared/types/api'
import type { AdminStats } from '@@/server/api/admin/stats.get'

const { data, error, status } = await useFetch<ApiResponse<AdminStats>>('/api/admin/stats')

const stats = computed(() => data.value?.data)

const simpleCards = computed(() => {
  const s = stats.value
  return [
    { label: 'Courses', value: s?.courses ?? '—', to: '/admin/courses' },
    { label: 'Users', value: s?.users ?? '—', to: '/admin/users' }
  ]
})
</script>

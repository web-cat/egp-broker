<template>
  <div>
    <UAlert
      v-if="error"
      color="error"
      icon="i-lucide-alert-triangle"
      title="Failed to load stats"
      :description="error.message"
      class="mb-6"
    />

    <!-- Email Diagnostics / Test Email Bar -->
    <div
      class="mb-6 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
    >
      <div class="flex items-center gap-3">
        <div
          class="p-2.5 rounded-lg bg-primary-50 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400 shrink-0"
        >
          <UIcon name="i-lucide-mail" class="w-5 h-5" />
        </div>
        <div>
          <h4 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Email System Test
          </h4>
          <p class="text-xs text-neutral-500 dark:text-neutral-400">
            Send a test email to your account ({{ userEmail || 'your email' }}) to verify SMTP
            settings.
          </p>
        </div>
      </div>
      <UButton
        data-testid="send-test-email-btn"
        color="primary"
        variant="subtle"
        size="sm"
        icon="i-lucide-send"
        label="Send Test Email"
        :loading="sendingTestEmail"
        @click="handleSendTestEmail"
      />
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
      <!-- Platforms Card -->
      <BaseCard class="text-center">
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
      </BaseCard>

      <!-- Deployments Card -->
      <BaseCard class="text-center">
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
      </BaseCard>

      <!-- Simple count cards -->
      <BaseCard v-for="stat in simpleCards" :key="stat.label" class="text-center">
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
      </BaseCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAdminStats } from '~/composables/features/useAdminStats'

const { error, status, stats, simpleCards } = useAdminStats()
const { user } = useUserSession()
const toast = useToast()

const userEmail = computed(() => user.value?.email)
const sendingTestEmail = ref(false)

const handleSendTestEmail = async () => {
  sendingTestEmail.value = true
  try {
    const res = await $fetch<{ statusCode: number; data: { success: boolean; email: string } }>(
      '/api/admin/test-email',
      { method: 'POST' }
    )
    toast.add({
      title: 'Test Email Sent',
      description: `A test email has been dispatched to ${res?.data?.email || userEmail.value || 'your email'}.`,
      color: 'success'
    })
  } catch (err: any) {
    toast.add({
      title: 'Email Test Failed',
      description: err?.data?.statusMessage || err?.message || 'Failed to dispatch test email.',
      color: 'error'
    })
  } finally {
    sendingTestEmail.value = false
  }
}
</script>

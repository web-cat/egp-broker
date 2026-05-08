<template>
  <UContainer class="py-12">
    <UCard class="max-w-xl mx-auto overflow-hidden">
      <template #header>
        <div class="flex items-center gap-3">
          <div class="p-2 bg-warning-50 dark:bg-warning-950 rounded-lg">
            <UIcon name="i-lucide-shield-alert" class="w-6 h-6 text-warning-500" />
          </div>
          <div>
            <h1 class="text-xl font-bold">Unregistered Platform</h1>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              An LTI launch was attempted from an unknown issuer.
            </p>
          </div>
        </div>
      </template>

      <div class="space-y-6">
        <div
          class="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800"
        >
          <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Issuer (iss)
          </p>
          <code class="text-sm break-all font-mono text-primary-600 dark:text-primary-400">{{
            issuer
          }}</code>
        </div>

        <div v-if="isAdmin" class="space-y-4">
          <div
            class="p-4 bg-primary-50 dark:bg-primary-950/30 rounded-lg border border-primary-100 dark:border-primary-900/50"
          >
            <p class="text-sm text-primary-700 dark:text-primary-300">
              <strong>Admin Detected:</strong> You can register this platform now to allow launches
              from this environment.
            </p>
          </div>

          <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
            <UFormGroup label="Platform Name" name="name">
              <UInput v-model="state.name" placeholder="e.g. Canvas Endeavour" />
            </UFormGroup>

            <UFormGroup
              label="Client ID"
              name="clientId"
              help="The Client ID provided by the LMS for this tool."
            >
              <UInput v-model="state.clientId" />
            </UFormGroup>

            <div class="grid grid-cols-1 gap-4">
              <UFormGroup label="Auth Endpoint" name="authEndpoint">
                <UInput v-model="state.authEndpoint" />
              </UFormGroup>
              <UFormGroup label="Token Endpoint" name="tokenEndpoint">
                <UInput v-model="state.tokenEndpoint" />
              </UFormGroup>
              <UFormGroup label="JWKS Endpoint" name="jwksEndpoint">
                <UInput v-model="state.jwksEndpoint" />
              </UFormGroup>
            </div>

            <div class="pt-4 flex gap-3">
              <UButton type="submit" block :loading="loading" color="primary">
                Register & Resume Launch
              </UButton>
              <UButton to="/admin/platforms" variant="ghost" block> Cancel </UButton>
            </div>
          </UForm>
        </div>

        <div v-else class="text-center py-6 space-y-4">
          <UIcon name="i-lucide-lock" class="w-12 h-12 text-gray-300 mx-auto" />
          <div class="space-y-2">
            <h3 class="font-semibold text-lg">Admin Access Required</h3>
            <p class="text-sm text-gray-500 max-w-xs mx-auto">
              Please log in as an Administrator to register this platform and continue the LTI
              launch.
            </p>
          </div>
          <UButton to="/login" color="primary" icon="i-lucide-log-in"> Log in as Admin </UButton>
        </div>
      </div>
    </UCard>
  </UContainer>
</template>

<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '#ui/types'

const route = useRoute()
const toast = useToast()
const { user } = useUserSession()

const issuer = route.query.iss as string
const isAdmin = computed(() => user.value?.globalRole === 'ADMIN')
const loading = ref(false)

// Pre-fill Canvas defaults if it looks like a Canvas issuer
const isCanvas = issuer?.includes('canvas') || issuer?.includes('instructure')

const state = reactive({
  name: isCanvas ? 'Canvas' : '',
  clientId: '',
  authEndpoint: isCanvas ? `${issuer}/api/lti/authorize_redirect` : '',
  tokenEndpoint: isCanvas ? `${issuer}/login/oauth2/token` : '',
  jwksEndpoint: isCanvas ? `${issuer}/api/lti/security/jwks` : ''
})

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  clientId: z.string().min(1, 'Client ID is required'),
  authEndpoint: z.string().url('Invalid URL'),
  tokenEndpoint: z.string().url('Invalid URL'),
  jwksEndpoint: z.string().url('Invalid URL')
})

async function onSubmit(event: FormSubmitEvent<z.output<typeof schema>>) {
  loading.value = true
  try {
    // 1. Create the platform
    await $fetch('/api/admin/platforms', {
      method: 'POST',
      body: {
        ...event.data,
        issuer
      }
    })

    toast.add({
      title: 'Platform Registered',
      description: 'The platform has been added. Resuming launch...',
      color: 'success'
    })

    // 2. Resume the launch by POSTing back to the login endpoint
    // We use a standard form submission to trigger the OIDC flow
    const form = document.createElement('form')
    form.method = 'POST'
    form.action = '/api/lti13/login'

    const params = {
      iss: issuer,
      login_hint: route.query.login_hint,
      target_link_uri: route.query.target_link_uri,
      lti_message_hint: route.query.lti_message_hint
    }

    for (const [key, value] of Object.entries(params)) {
      const input = document.createElement('input')
      input.type = 'hidden'
      input.name = key
      input.value = value as string
      form.appendChild(input)
    }

    document.body.appendChild(form)
    form.submit()
  } catch (err: any) {
    toast.add({
      title: 'Registration Failed',
      description: err.data?.message || 'An unexpected error occurred',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}
</script>

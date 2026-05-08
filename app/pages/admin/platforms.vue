<template>
  <BaseDataTable
    :data="platforms?.data"
    :columns="platformColumns"
    :loading="platformsStatus === 'pending'"
    searchable
    search-placeholder="Search platforms…"
    empty-icon="i-lucide-layers"
    empty-text="No platforms registered yet."
  >
    <template #toolbar>
      <UButton icon="i-lucide-plus" label="Add Platform" @click="isAddModalOpen = true" />
    </template>
  </BaseDataTable>

  <!-- Add Platform Modal -->
  <UModal v-model="isAddModalOpen">
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="text-base font-semibold">Register New LTI Platform</h3>
          <UButton color="gray" variant="ghost" icon="i-lucide-x" class="-my-1" @click="isAddModalOpen = false" />
        </div>
      </template>

      <UForm :schema="schema" :state="state" @submit="onSubmit" class="space-y-4">
        <UFormGroup label="Platform Name" name="name">
          <UInput v-model="state.name" placeholder="e.g. Canvas Production" />
        </UFormGroup>

        <UFormGroup label="Issuer (iss)" name="issuer" help="The URL of the platform (e.g. https://canvas.instructure.com)">
          <UInput v-model="state.issuer" @update:model-value="onIssuerUpdate" />
        </UFormGroup>

        <UFormGroup label="Client ID" name="clientId">
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

        <div class="flex justify-end gap-3 pt-4">
          <UButton variant="ghost" label="Cancel" @click="isAddModalOpen = false" />
          <UButton type="submit" color="primary" label="Save Platform" :loading="loading" />
        </div>
      </UForm>
    </UCard>
  </UModal>
</template>

<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

interface PlatformRow {
  id: string
  issuer: string
  clientId: string
  name: string | null
  deploymentCount: number
  createdAt: string
}

// --- Page title ---
const { setTitle } = useAdminPageTitle()
setTitle('Platforms')

// --- Notifications ---
const route = useRoute()
const toast = useToast()

onMounted(() => {
  if (route.query.error) {
    toast.add({
      title: 'Action Required',
      description: route.query.error as string,
      color: 'warning',
      icon: 'i-lucide-alert-triangle',
      timeout: 10000
    })
    // Clear the error from the URL
    navigateTo({ path: route.path, query: {} }, { replace: true })
  }
})

// --- Data fetching ---
const { fetchPlatforms } = useAdminPlatforms()
const { data: platforms, status: platformsStatus, refresh } = await fetchPlatforms()

// --- Add Platform Logic ---
import { z } from 'zod'
import type { FormSubmitEvent } from '#ui/types'

const isAddModalOpen = ref(false)
const loading = ref(false)
const toast = useToast()

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  issuer: z.string().url('Must be a valid URL'),
  clientId: z.string().min(1, 'Client ID is required'),
  authEndpoint: z.string().url('Invalid URL'),
  tokenEndpoint: z.string().url('Invalid URL'),
  jwksEndpoint: z.string().url('Invalid URL')
})

const state = reactive({
  name: '',
  issuer: '',
  clientId: '',
  authEndpoint: '',
  tokenEndpoint: '',
  jwksEndpoint: ''
})

function onIssuerUpdate(val: string) {
  if (!val) return
  const isCanvas = val.includes('canvas') || val.includes('instructure')
  if (isCanvas) {
    const cleanIssuer = val.replace(/\/$/, '')
    state.authEndpoint = `${cleanIssuer}/api/lti/authorize_redirect`
    state.tokenEndpoint = `${cleanIssuer}/login/oauth2/token`
    state.jwksEndpoint = `${cleanIssuer}/api/lti/security/jwks`
    if (!state.name) state.name = 'Canvas'
  }
}

async function onSubmit(event: FormSubmitEvent<z.output<typeof schema>>) {
  loading.value = true
  try {
    await $fetch('/api/admin/platforms', {
      method: 'POST',
      body: event.data
    })
    
    toast.add({ title: 'Platform added successfully', color: 'success' })
    isAddModalOpen.value = false
    refresh()
    
    // Reset state
    Object.assign(state, {
      name: '',
      issuer: '',
      clientId: '',
      authEndpoint: '',
      tokenEndpoint: '',
      jwksEndpoint: ''
    })
  } catch (err: any) {
    toast.add({ 
      title: 'Failed to add platform', 
      description: err.data?.message || 'Check logs', 
      color: 'error' 
    })
  } finally {
    loading.value = false
  }
}

const platformColumns: TableColumn<PlatformRow>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => row.getValue('name') || '—'
  },
  {
    accessorKey: 'issuer',
    header: 'Issuer',
    cell: ({ row }) => {
      const issuer = row.getValue('issuer') as string
      try {
        return new URL(issuer).hostname
      } catch {
        return issuer
      }
    }
  },
  {
    accessorKey: 'clientId',
    header: 'Client ID'
  },
  {
    accessorKey: 'deploymentCount',
    header: 'Deployments',
    cell: countBadgeCell('deploymentCount'),
    meta: { class: { th: 'text-center', td: 'text-center' } }
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    cell: dateCellRenderer('createdAt')
  },
  actionsColumn<PlatformRow>((row) => [
    [
      {
        label: 'View courses',
        icon: 'i-lucide-book-open',
        onSelect: () => navigateTo({ path: '/admin/courses', query: { p: row.original.id } })
      },
      {
        label: 'View deployments',
        icon: 'i-lucide-share-2',
        onSelect: () => navigateTo({ path: '/admin/deployments', query: { p: row.original.id } })
      },
      { label: 'Edit', icon: 'i-lucide-pencil' }
    ],
    [{ label: 'Delete', icon: 'i-lucide-trash-2', color: 'error' as const }]
  ])
]
</script>

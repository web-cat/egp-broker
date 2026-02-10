<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    data: Record<string, unknown>[] | null | undefined
    columns: Record<string, unknown>[]
    loading?: boolean
    searchable?: boolean
    searchPlaceholder?: string
    pageSize?: number
    emptyIcon?: string
    emptyText?: string
  }>(),
  {
    loading: false,
    searchable: false,
    searchPlaceholder: 'Search…',
    pageSize: 10,
    emptyIcon: 'i-lucide-inbox',
    emptyText: 'No data found.'
  }
)

const globalFilter = ref('')
const page = ref(1)

const hasData = computed(() => (props.data?.length ?? 0) > 0)
const totalRows = computed(() => props.data?.length ?? 0)
const totalPages = computed(() => Math.max(1, Math.ceil(totalRows.value / props.pageSize)))
</script>

<template>
  <UCard>
    <!-- Toolbar -->
    <template v-if="searchable || $slots.toolbar" #header>
      <div class="flex items-center justify-between gap-4">
        <UInput
          v-if="searchable"
          v-model="globalFilter"
          icon="i-lucide-search"
          :placeholder="searchPlaceholder"
          class="max-w-sm"
        />
        <div v-else />
        <div class="flex items-center gap-2">
          <slot name="toolbar" />
        </div>
      </div>
    </template>

    <!-- Table -->
    <UTable
      v-if="hasData"
      v-model:global-filter="globalFilter"
      :data="data!"
      :columns="columns"
      :loading="loading"
      class="flex-1"
    />

    <!-- Loading state -->
    <div v-else-if="loading" class="flex justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="w-10 h-10 animate-spin text-primary-500" />
    </div>

    <!-- Empty state -->
    <div v-else class="text-center py-12 text-neutral-500">
      <UIcon :name="emptyIcon" class="w-12 h-12 mx-auto mb-4 opacity-20" />
      <p>{{ emptyText }}</p>
    </div>

    <!-- Pagination footer -->
    <template v-if="hasData && totalPages > 1" #footer>
      <div class="flex items-center justify-between">
        <p class="text-sm text-neutral-500">
          {{ totalRows }} rows
        </p>
        <UPagination
          v-model:page="page"
          :items-per-page="pageSize"
          :total="totalRows"
        />
      </div>
    </template>
  </UCard>
</template>

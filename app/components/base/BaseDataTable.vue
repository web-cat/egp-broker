<script setup lang="ts" generic="T extends Record<string, unknown> = Record<string, unknown>">
import { ref, computed, watch } from 'vue'
import type { TableColumn } from '@nuxt/ui'

const props = withDefaults(
  defineProps<{
    data: T[] | null | undefined
    columns: TableColumn<T>[]
    loading?: boolean
    searchable?: boolean
    searchPlaceholder?: string
    pageSize?: number
    emptyIcon?: string
    emptyText?: string
    rowClass?: (row: T) => string
  }>(),
  {
    loading: false,
    searchable: false,
    searchPlaceholder: 'Search…',
    pageSize: 50,
    emptyIcon: 'i-lucide-inbox',
    emptyText: 'No data found.',
    rowClass: undefined
  }
)

const globalFilter = ref('')

const pagination = ref({
  pageIndex: 0,
  pageSize: props.pageSize
})

watch(
  () => props.pageSize,
  (newSize) => {
    pagination.value.pageSize = newSize
  }
)

watch(globalFilter, () => {
  pagination.value.pageIndex = 0
})

const page = computed({
  get: () => (pagination.value.pageIndex ?? 0) + 1,
  set: (val: number) => {
    pagination.value = {
      ...pagination.value,
      pageIndex: Math.max(0, val - 1)
    }
  }
})

const hasData = computed(() => (props.data?.length ?? 0) > 0)
const totalRows = computed(() => props.data?.length ?? 0)

const totalPages = computed(() => Math.max(1, Math.ceil(totalRows.value / props.pageSize)))

const tableMeta = computed(() => {
  if (!props.rowClass) return undefined
  return {
    class: {
      tr: (row: T) => props.rowClass?.(row) ?? ''
    }
  }
})
</script>

<template>
  <UCard :ui="{ body: 'p-2 sm:p-2' }">
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
      v-model:pagination="pagination"
      :data="data as any"
      :columns="columns as any"
      :loading="loading"
      :meta="tableMeta"
      :ui="{ td: 'p-2 sm:p-2', th: 'p-2 sm:p-2' }"
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
        <p class="text-sm text-neutral-500">{{ totalRows }} rows</p>
        <UPagination v-model:page="page" :items-per-page="pageSize" :total="totalRows" />
      </div>
    </template>
  </UCard>
</template>

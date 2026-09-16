<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-xl font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
          <UIcon name="i-lucide-calendar-clock" class="w-6 h-6 text-primary-500" />
          CBTF Reservations
        </h1>
        <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Manage exam reservations, monitor arrivals, adjust seating, and propagate schedule changes to Canvas.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <UButton
          to="/admin/cbtf"
          variant="outline"
          color="neutral"
          icon="i-lucide-landmark"
          label="Testing Center Facility"
        />
      </div>
    </div>

    <!-- Reusable Reservations Table with Filtering, Pagination, and Resync -->
    <FeaturesCbtfReservationsTable
      ref="tableRef"
      :read-only="false"
      :show-resync-canvas="true"
      endpoint="/api/proctor/reservations"
      @edit="openEdit"
      @delete="openDelete"
    />

    <!-- Edit Slideover Panel -->
    <FeaturesAdminCbtfReservationEditPanel
      v-model:open="editOpen"
      :reservation="selectedReservation"
      :saving="isSaving"
      @save="handleSaveEdit"
    />

    <!-- Delete Confirmation Modal -->
    <BaseConfirmationModal
      v-model:open="deleteOpen"
      title="Delete Reservation"
      :description="`Are you sure you want to delete the reservation for ${selectedReservation?.studentName || 'this student'}?`"
      confirm-label="Delete Reservation"
      confirm-color="error"
      confirm-icon="i-lucide-trash-2"
      :loading="isDeleting"
      @confirm="handleConfirmDelete"
    >
      <div class="space-y-2 text-sm text-neutral-500">
        <p>This action will permanently delete the reservation from the system and free the testing seat.</p>
        <p v-if="selectedReservation?.canvasOverrideId" class="text-amber-600 dark:text-amber-400 font-medium">
          The corresponding assignment override in Canvas will also be removed automatically.
        </p>
      </div>
    </BaseConfirmationModal>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAdminPageTitle } from '~/composables/features/admin/useAdminPageTitle'
import { useAdminCbtfReservations } from '~/composables/features/admin/useAdminCbtfReservations'
import type { CbtfReservationDto } from '@@/shared/models/cbtf'
import type { CbtfAdminUpdateReservationInput } from '@@/shared/schemas/cbtf.schema'

definePageMeta({
  middleware: ['admin-only']
})

const { setTitle } = useAdminPageTitle()
setTitle('CBTF Reservations')

const { updateReservation, deleteReservation } = useAdminCbtfReservations()

const tableRef = ref<any>(null)
const editOpen = ref(false)
const deleteOpen = ref(false)
const isSaving = ref(false)
const isDeleting = ref(false)
const selectedReservation = ref<CbtfReservationDto | null>(null)

const openEdit = (res: CbtfReservationDto) => {
  selectedReservation.value = res
  editOpen.value = true
}

const openDelete = (res: CbtfReservationDto) => {
  selectedReservation.value = res
  deleteOpen.value = true
}

const handleSaveEdit = async ({ id, data }: { id: string; data: CbtfAdminUpdateReservationInput }) => {
  isSaving.value = true
  try {
    await updateReservation(id, data)
    editOpen.value = false
    tableRef.value?.fetchReservations?.()
  } finally {
    isSaving.value = false
  }
}

const handleConfirmDelete = async () => {
  if (!selectedReservation.value) return
  isDeleting.value = true
  try {
    await deleteReservation(selectedReservation.value.id)
    deleteOpen.value = false
    tableRef.value?.fetchReservations?.()
  } finally {
    isDeleting.value = false
  }
}
</script>

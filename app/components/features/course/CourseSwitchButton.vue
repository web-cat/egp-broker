<template>
  <BaseButton
    variant="ghost"
    color="neutral"
    icon="i-lucide-library"
    :title="t('global.actions.changeCourse')"
    :loading="loading"
    @click="handleChangeCourse"
  />
</template>

<script lang="ts" setup>
import { useCourseContext } from '~/composables/features/useCourseContext'

const { t } = useI18n()
const { clearCourseContext } = useCourseContext()
const loading = ref(false)

const handleChangeCourse = async () => {
  loading.value = true
  try {
    await clearCourseContext()
  } finally {
    loading.value = false
  }
}
</script>

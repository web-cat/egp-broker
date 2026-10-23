export const useCourseContext = () => {
  const { fetch: refreshSession } = useUserSession()
  const selecting = ref<string | null>(null)

  const setCourseContext = async (courseId: string) => {
    selecting.value = courseId
    try {
      await $fetch('/api/me/context', {
        method: 'POST',
        body: { courseId }
      })
      // Refresh the session/enrollment data
      await refreshSession()
      // Optional: Hard refresh or navigate to ensure state is clean
      // await navigateTo('/')
    } catch (e) {
      console.error('Failed to select course:', e)
      throw e
    } finally {
      selecting.value = null
    }
  }

  const clearCourseContext = async () => {
    try {
      await $fetch('/api/me/context', { method: 'DELETE' })
      await refreshSession()
      await navigateTo('/')
    } catch (e) {
      console.error('Failed to clear context:', e)
      throw e
    }
  }

  const updateCourseSettings = async (
    courseId: string,
    settings: {
      interviewLocation?: string | null
      cbtfTitlePattern?: string | null
      interviewTitlePattern?: string | null
    }
  ): Promise<{
    data: {
      id: string
      interviewLocation: string | null
      cbtfTitlePattern: string | null
      interviewTitlePattern: string | null
    }
  }> => {
    return $fetch(`/api/me/courses/${courseId}`, {
      method: 'PATCH',
      body: settings
    })
  }

  return {
    selecting,
    setCourseContext,
    clearCourseContext,
    updateCourseSettings
  }
}

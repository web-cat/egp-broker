export function useLtiSetup() {
  const fetchLtiTools = async (): Promise<any[]> => {
    return $fetch<any[]>('/api/lti13/tools')
  }

  const fetchProxyGradeTranslations = async (): Promise<any[]> => {
    return $fetch<any[]>('/api/proxy/grade-translations')
  }

  const configureAssignment = async (
    assignmentId: string,
    body: { toolId: string; gradeTranslationId: string | null }
  ): Promise<any> => {
    return $fetch(`/api/assignments/${assignmentId}/configure`, {
      method: 'POST',
      body
    })
  }

  return {
    fetchLtiTools,
    fetchProxyGradeTranslations,
    configureAssignment
  }
}

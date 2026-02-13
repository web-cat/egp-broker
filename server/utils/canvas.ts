export interface CanvasAssignment {
  id: number
  name: string
  description: string
  created_at: string
  updated_at: string
  due_at: string | null
  lock_at: string | null
  unlock_at: string | null
  has_submitted_submissions: boolean
  points_possible: number
  grading_type: string
  submission_types: string[]
  published: boolean
  html_url: string
  url: string
  quiz_id?: number
  rubric?: any[]
  use_rubric_for_grading?: boolean
  rubric_settings?: any
  allowed_extensions?: string[]
}

/**
 * Fetches assignments from the Canvas API for a specific course.
 * Handles pagination handling to get all assignments.
 */
export async function fetchCanvasAssignments(
  domain: string,
  courseId: string,
  accessToken: string
): Promise<CanvasAssignment[]> {
  const assignments: CanvasAssignment[] = []
  let url = `https://${domain}/api/v1/courses/${courseId}/assignments?per_page=100`

  try {
    while (url) {
      const response = await $fetch.raw<CanvasAssignment[]>(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json'
        }
      })

      if (response._data) {
        assignments.push(...response._data)
      }

      // Parse Link header for pagination
      const linkHeader = response.headers.get('link')
      if (linkHeader) {
        const links = linkHeader.split(',')
        const nextLink = links.find((link) => link.includes('rel="next"'))
        if (nextLink) {
          const match = nextLink.match(/<([^>]+)>/)
          url = match ? match[1] : ''
        } else {
          url = ''
        }
      } else {
        url = ''
      }
    }
  } catch (error: any) {
    console.error('Error fetching Canvas assignments:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: 'Failed to fetch assignments from Canvas',
      data: error.data
    })
  }

  return assignments
}

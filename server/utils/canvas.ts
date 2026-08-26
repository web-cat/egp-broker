import { createError } from 'h3'

export interface CanvasAssignmentOverride {
  id: number
  assignment_id: number
  title: string
  created_at?: string
  updated_at?: string
  due_at?: string | null
  all_day?: boolean
  all_day_date?: string | null
  unlock_at?: string | null
  lock_at?: string | null
  course_section_id?: number | null
  group_id?: number | null
  student_ids?: number[]
}

export interface CanvasSection {
  id: number
  name: string
  course_id: number
  sis_section_id?: string | null
  integration_id?: string | null
  start_at?: string | null
  end_at?: string | null
  total_students?: number
  enrollments?: Array<{
    id: number
    user_id: number
    course_section_id: number
    role: string
    type: string
  }>
}

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
  overrides?: CanvasAssignmentOverride[]
}

/**
 * Resolves the API domain for Canvas REST API requests.
 *
 * In commercial Canvas deployments (e.g. Canvas by Instructure), the LTI issuer
 * is often generic ('https://canvas.instructure.com'), but the actual tenant API calls
 * must go to the institution's specific domain (e.g. 'canvas.vt.edu').
 *
 * This function resolves the domain in order of precedence:
 * 1. An explicit, valid deploymentHost (if configured/resolved as a valid hostname)
 * 2. Hostname parsed from the platform's authEndpoint, tokenEndpoint, or jwksEndpoint
 * 3. Hostname parsed from the platform's issuer
 */
export function getPlatformCanvasDomain(
  platform: {
    issuer: string
    authEndpoint?: string | null
    tokenEndpoint?: string | null
    jwksEndpoint?: string | null
  },
  deploymentHost?: string | null
): string {
  // If deploymentHost is present and looks like a valid hostname (no colon, contains dot)
  if (deploymentHost) {
    const cleaned = deploymentHost
      .trim()
      .replace(/^https?:\/\//, '')
      .split('/')[0]
    // Filter out internal GUIDs (which often have colons like "yDz0MxxBs02YM08vCb8fQ85ISbDXw62vLT6KiA6s:canvas-lms")
    if (cleaned && !cleaned.includes(':') && cleaned.includes('.')) {
      return cleaned
    }
  }

  // Next, extract hostname from platform entry points (tokenEndpoint, authEndpoint, jwksEndpoint)
  const endpoints = [platform.tokenEndpoint, platform.authEndpoint, platform.jwksEndpoint]
  for (const ep of endpoints) {
    if (ep) {
      try {
        const url = new URL(ep.startsWith('http') ? ep : `https://${ep}`)
        if (
          url.hostname &&
          !url.hostname.includes(':') &&
          url.hostname !== 'canvas.instructure.com'
        ) {
          return url.hostname
        }
      } catch {
        // Continue to next endpoint
      }
    }
  }

  // Fallback: use first valid endpoint hostname (even if canvas.instructure.com)
  for (const ep of endpoints) {
    if (ep) {
      try {
        const url = new URL(ep.startsWith('http') ? ep : `https://${ep}`)
        if (url.hostname) {
          return url.hostname
        }
      } catch {
        // Continue to next endpoint
      }
    }
  }

  // Final fallback: issuer hostname
  try {
    const url = new URL(
      platform.issuer.startsWith('http') ? platform.issuer : `https://${platform.issuer}`
    )
    return url.hostname
  } catch {
    return platform.issuer
  }
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
  let url = `https://${domain}/api/v1/courses/${courseId}/assignments?include[]=overrides&per_page=100`

  try {
    while (url) {
      console.info(`[Canvas API] GET ${url}`)
      const response = await $fetch.raw<CanvasAssignment[]>(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json'
        }
      })

      const records = response._data
      console.info(
        `[Canvas API] Status ${response.status}, received: ${Array.isArray(records) ? `${records.length} items` : typeof records}`
      )

      if (records && Array.isArray(records)) {
        assignments.push(...records)
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

/**
 * Fetches sections (with enrollments) from the Canvas API for a specific course.
 */
export async function fetchCanvasSections(
  domain: string,
  courseId: string,
  accessToken: string
): Promise<CanvasSection[]> {
  const sections: CanvasSection[] = []
  let url = `https://${domain}/api/v1/courses/${courseId}/sections?include[]=enrollments&per_page=100`

  try {
    while (url) {
      console.info(`[Canvas API] GET ${url}`)
      const response = await $fetch.raw<CanvasSection[]>(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json'
        }
      })

      const records = response._data
      console.info(
        `[Canvas API] Status ${response.status}, received: ${Array.isArray(records) ? `${records.length} sections` : typeof records}`
      )

      if (records && Array.isArray(records)) {
        sections.push(...records)
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
    console.error('Error fetching Canvas sections:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: 'Failed to fetch sections from Canvas',
      data: error.data
    })
  }

  return sections
}

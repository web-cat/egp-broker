import { describe, it, expect } from 'vitest'
import { getPlatformCanvasDomain } from '@@/server/utils/canvas'

describe('getPlatformCanvasDomain', () => {
  it('extracts custom institution domain from endpoints when issuer is canvas.instructure.com and deploymentHost is a GUID', () => {
    const platform = {
      issuer: 'https://canvas.instructure.com',
      authEndpoint: 'https://canvas.vt.edu/api/lti/authorize_redirect',
      tokenEndpoint: 'https://canvas.vt.edu/login/oauth2/token',
      jwksEndpoint: 'https://canvas.vt.edu/api/lti/security/jwks'
    }
    const deploymentHost = 'yDz0MxxBs02YM08vCb8fQ85ISbDXw62vLT6KiA6s:canvas-lms'

    const domain = getPlatformCanvasDomain(platform, deploymentHost)
    expect(domain).toBe('canvas.vt.edu')
  })

  it('prefers a clean deploymentHost if it is a valid hostname', () => {
    const platform = {
      issuer: 'https://canvas.instructure.com',
      authEndpoint: 'https://canvas.vt.edu/api/lti/authorize_redirect',
      tokenEndpoint: 'https://canvas.vt.edu/login/oauth2/token',
      jwksEndpoint: 'https://canvas.vt.edu/api/lti/security/jwks'
    }
    const deploymentHost = 'custom-canvas.example.edu'

    const domain = getPlatformCanvasDomain(platform, deploymentHost)
    expect(domain).toBe('custom-canvas.example.edu')
  })

  it('resolves domain from authEndpoint if tokenEndpoint is missing', () => {
    const platform = {
      issuer: 'https://canvas.instructure.com',
      authEndpoint: 'https://canvas.vt.edu/api/lti/authorize_redirect',
      tokenEndpoint: null,
      jwksEndpoint: null
    }

    const domain = getPlatformCanvasDomain(platform, null)
    expect(domain).toBe('canvas.vt.edu')
  })

  it('falls back to issuer if endpoints are absent or generic', () => {
    const platform = {
      issuer: 'https://canvas.instructure.com',
      authEndpoint: null,
      tokenEndpoint: null,
      jwksEndpoint: null
    }

    const domain = getPlatformCanvasDomain(platform, null)
    expect(domain).toBe('canvas.instructure.com')
  })
})

describe('Canvas sections and enrollments API fetchers', () => {
  it('fetchCanvasSections requests students and enrollments include parameters and returns sections', async () => {
    const { fetchCanvasSections } = await import('@@/server/utils/canvas')
    const mockRaw = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers(),
      _data: [
        {
          id: 101,
          name: 'Section 01',
          course_id: 12345,
          students: [
            {
              id: 991,
              name: 'Student One',
              login_id: 'sone',
              email: 'sone@vt.edu'
            }
          ]
        }
      ]
    })
    vi.stubGlobal('$fetch', Object.assign(vi.fn(), { raw: mockRaw }))

    const sections = await fetchCanvasSections('canvas.vt.edu', '12345', 'test-token')
    expect(sections).toHaveLength(1)
    expect(sections[0].id).toBe(101)
    expect(sections[0].students?.[0].login_id).toBe('sone')
    expect(mockRaw).toHaveBeenCalledWith(
      'https://canvas.vt.edu/api/v1/courses/12345/sections?include[]=students&include[]=enrollments&per_page=100',
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer test-token',
          Accept: 'application/json'
        }
      })
    )
  })

  it('fetchCanvasCourseEnrollments retrieves paginated course enrollments', async () => {
    const { fetchCanvasCourseEnrollments } = await import('@@/server/utils/canvas')
    const mockRaw = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers(),
      _data: [
        {
          id: 1,
          user_id: 991,
          course_id: 12345,
          course_section_id: 101,
          type: 'StudentEnrollment',
          user: {
            id: 991,
            login_id: 'sone',
            email: 'sone@vt.edu'
          }
        }
      ]
    })
    vi.stubGlobal('$fetch', Object.assign(vi.fn(), { raw: mockRaw }))

    const enrollments = await fetchCanvasCourseEnrollments('canvas.vt.edu', '12345', 'test-token')
    expect(enrollments).toHaveLength(1)
    expect(enrollments[0].course_section_id).toBe(101)
    expect(enrollments[0].user?.login_id).toBe('sone')
    expect(mockRaw).toHaveBeenCalledWith(
      'https://canvas.vt.edu/api/v1/courses/12345/enrollments?type[]=StudentEnrollment&include[]=user&per_page=100',
      expect.any(Object)
    )
  })

  it('fetchCanvasSectionEnrollments retrieves enrollments for a specific section', async () => {
    const { fetchCanvasSectionEnrollments } = await import('@@/server/utils/canvas')
    const mockRaw = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers(),
      _data: [
        {
          id: 2,
          user_id: 992,
          course_id: 12345,
          course_section_id: 102,
          type: 'StudentEnrollment',
          user: {
            id: 992,
            login_id: 'stwo',
            email: 'stwo@vt.edu'
          }
        }
      ]
    })
    vi.stubGlobal('$fetch', Object.assign(vi.fn(), { raw: mockRaw }))

    const enrollments = await fetchCanvasSectionEnrollments('canvas.vt.edu', 102, 'test-token')
    expect(enrollments).toHaveLength(1)
    expect(enrollments[0].user_id).toBe(992)
  })
})

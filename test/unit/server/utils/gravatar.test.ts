import { describe, it, expect } from 'vitest'
import { getGravatarUrl } from '@@/server/utils/gravatar'

describe('getGravatarUrl', () => {
  it('returns default robohash when email is not provided', () => {
    const url = getGravatarUrl()
    expect(url).toContain('https://0.gravatar.com/avatar/')
    expect(url).toContain('d=robohash')
  })

  it('generates deterministic SHA-256 avatar url from email', () => {
    const url = getGravatarUrl('User@Example.com ')
    expect(url).toContain('https://0.gravatar.com/avatar/')
    expect(url).toContain('d=robohash')
    // Email should be normalized (lowercase & trimmed)
    const expected = getGravatarUrl('user@example.com')
    expect(url).toBe(expected)
  })
})

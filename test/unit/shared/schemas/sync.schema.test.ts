import { describe, it, expect } from 'vitest'
import { savePlatformApiKeySchema, syncStatusSchema } from '@@/shared/schemas/sync.schema'

describe('Sync Schemas', () => {
  describe('savePlatformApiKeySchema', () => {
    it('validates and trims API key', () => {
      const parsed = savePlatformApiKeySchema.parse({ apiKey: '  secret-token-123  ' })
      expect(parsed.apiKey).toBe('secret-token-123')
    })

    it('rejects empty API key', () => {
      expect(() => savePlatformApiKeySchema.parse({ apiKey: '   ' })).toThrow()
    })
  })

  describe('syncStatusSchema', () => {
    it('validates sync status output', () => {
      const valid = {
        canSync: true,
        platformName: 'Canvas Production',
        hasCourseContext: true
      }
      expect(syncStatusSchema.parse(valid)).toEqual(valid)
    })
  })
})

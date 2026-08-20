import { z } from 'zod'

export const savePlatformApiKeySchema = z.object({
  apiKey: z.string().min(1, 'API Key / Access Token is required').trim()
})

export type SavePlatformApiKeyInput = z.infer<typeof savePlatformApiKeySchema>

export const syncStatusSchema = z.object({
  canSync: z.boolean(),
  platformName: z.string().nullable().optional(),
  hasCourseContext: z.boolean().optional()
})

export type SyncStatusResponse = z.infer<typeof syncStatusSchema>

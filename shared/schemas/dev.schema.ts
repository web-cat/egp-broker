import { z } from 'zod'

export const MockLaunchSchema = z.object({
  email: z.string().email().optional(),
  courseId: z.string().optional(),
  courseTitle: z.string().optional(),
  courseLabel: z.string().optional(),
  role: z.string().optional()
})

export type MockLaunchInput = z.infer<typeof MockLaunchSchema>

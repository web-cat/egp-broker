import { z } from 'zod'

export const courseSectionRowSchema = z.object({
  id: z.string(),
  canvasSectionId: z.string(),
  name: z.string(),
  totalStudents: z.number(),
  totalOverrides: z.number()
})

export type CourseSectionRow = z.infer<typeof courseSectionRowSchema>

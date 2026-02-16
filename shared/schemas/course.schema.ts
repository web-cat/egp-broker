import { z } from 'zod'

export const CourseContextSchema = z.object({
  courseId: z.string().cuid2()
})

export type CourseContextInput = z.infer<typeof CourseContextSchema>

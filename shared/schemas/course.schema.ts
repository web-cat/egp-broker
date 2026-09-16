import { z } from 'zod'

export const CourseContextSchema = z.object({
  courseId: z.string().cuid2()
})

export type CourseContextInput = z.infer<typeof CourseContextSchema>

export const updateCourseSettingsSchema = z.object({
  interviewLocation: z.string().trim().max(255).nullable().optional()
})

export type UpdateCourseSettingsInput = z.infer<typeof updateCourseSettingsSchema>

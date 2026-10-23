import { z } from 'zod'

export const CourseContextSchema = z.object({
  courseId: z.string().cuid2()
})

export type CourseContextInput = z.infer<typeof CourseContextSchema>

export const regexPatternSchema = z
  .string()
  .trim()
  .max(255)
  .nullable()
  .optional()
  .refine(
    (val) => {
      if (!val) return true
      try {
        new RegExp(val, 'i')
        return true
      } catch {
        return false
      }
    },
    { message: 'Invalid regular expression pattern' }
  )

export const updateCourseSettingsSchema = z.object({
  interviewLocation: z.string().trim().max(255).nullable().optional(),
  cbtfTitlePattern: regexPatternSchema,
  interviewTitlePattern: regexPatternSchema
})

export type UpdateCourseSettingsInput = z.infer<typeof updateCourseSettingsSchema>

export const studentContextQuerySchema = z.object({
  courseId: z.string().optional()
})

export type StudentContextQuery = z.infer<typeof studentContextQuerySchema>

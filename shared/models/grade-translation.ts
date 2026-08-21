import { z } from 'zod'

export const gradeTranslationMappingSchema = z.record(z.string(), z.unknown())

export const gradeTranslationRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  maxScore: z.number().nullable().optional(),
  mapping: gradeTranslationMappingSchema.nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
})

export type GradeTranslationRow = z.infer<typeof gradeTranslationRowSchema>

export const createGradeTranslationSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().nullable().optional(),
  maxScore: z.number().optional().default(1.0),
  mapping: gradeTranslationMappingSchema.optional()
})

export const updateGradeTranslationSchema = createGradeTranslationSchema.partial()

export type CreateGradeTranslationInput = z.infer<typeof createGradeTranslationSchema>
export type UpdateGradeTranslationInput = z.infer<typeof updateGradeTranslationSchema>

import { z } from 'zod'

export const gtaTimeRegex = /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/

export const gtaInterviewStatusEnum = z.enum([
  'SCHEDULED',
  'CHECKED_IN',
  'CHECKED_OUT',
  'COMPLETED',
  'MISSED',
  'CANCELLED'
])

export type GtaInterviewStatusType = z.infer<typeof gtaInterviewStatusEnum>

export const createGtaShiftInputSchema = z
  .object({
    courseId: z.string().min(1, 'Course ID is required'),
    userId: z.string().min(1, 'GTA User ID is required'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be formatted as YYYY-MM-DD'),
    startTime: z.string().regex(gtaTimeRegex, 'Invalid startTime format (HH:mm)'),
    endTime: z.string().regex(gtaTimeRegex, 'Invalid endTime format (HH:mm)')
  })
  .refine((data) => data.endTime > data.startTime, {
    message: 'endTime must be after startTime',
    path: ['endTime']
  })

export type CreateGtaShiftInput = z.infer<typeof createGtaShiftInputSchema>

export const updateGtaShiftInputSchema = z
  .object({
    userId: z.string().min(1, 'GTA User ID is required').optional(),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be formatted as YYYY-MM-DD')
      .optional(),
    startTime: z.string().regex(gtaTimeRegex, 'Invalid startTime format (HH:mm)').optional(),
    endTime: z.string().regex(gtaTimeRegex, 'Invalid endTime format (HH:mm)').optional()
  })
  .refine(
    (data) => {
      if (data.startTime && data.endTime) {
        return data.endTime > data.startTime
      }
      return true
    },
    {
      message: 'endTime must be after startTime',
      path: ['endTime']
    }
  )

export type UpdateGtaShiftInput = z.infer<typeof updateGtaShiftInputSchema>

export const gtaBatchShiftSlotSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(gtaTimeRegex, 'Invalid startTime format (HH:mm)'),
    endTime: z.string().regex(gtaTimeRegex, 'Invalid endTime format (HH:mm)')
  })
  .refine((data) => data.endTime > data.startTime, {
    message: 'endTime must be after startTime',
    path: ['endTime']
  })

export type GtaBatchShiftSlot = z.infer<typeof gtaBatchShiftSlotSchema>

export const gtaBatchGenerateShiftsSchema = z
  .object({
    courseId: z.string().min(1, 'Course ID is required'),
    userId: z.string().min(1, 'GTA User ID is required'),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be formatted as YYYY-MM-DD'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be formatted as YYYY-MM-DD'),
    shifts: z.array(gtaBatchShiftSlotSchema).min(1, 'At least one shift slot is required')
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: 'endDate must be on or after startDate',
    path: ['endDate']
  })

export type GtaBatchGenerateShiftsInput = z.infer<typeof gtaBatchGenerateShiftsSchema>

export const createGtaInterviewReservationInputSchema = z.object({
  assignmentId: z.string().min(1, 'Assignment ID is required'),
  startTime: z.string().datetime()
})

export type CreateGtaInterviewReservationInput = z.infer<
  typeof createGtaInterviewReservationInputSchema
>

export const updateGtaInterviewReservationInputSchema = z.object({
  status: gtaInterviewStatusEnum.optional(),
  notes: z.string().max(10000, 'Notes cannot exceed 10,000 characters').nullable().optional()
})

export type UpdateGtaInterviewReservationInput = z.infer<
  typeof updateGtaInterviewReservationInputSchema
>

export const updateCourseInterviewLocationInputSchema = z.object({
  interviewLocation: z
    .string()
    .trim()
    .max(255, 'Location cannot exceed 255 characters')
    .nullable()
    .optional()
})

export type UpdateCourseInterviewLocationInput = z.infer<
  typeof updateCourseInterviewLocationInputSchema
>

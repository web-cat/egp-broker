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
  startTime: z.string().datetime(),
  rescheduleReservationId: z.string().cuid().or(z.string().min(1)).optional()
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

export interface GtaInterviewSlotDto {
  startTime: string
  endTime: string
  time24?: string
  label?: string
  timeLabel?: string
  availableGtaCount?: number
  totalGtaCount?: number
  capacity?: number
  availableCapacity?: number
  totalGtasOnDuty?: number
}

export interface GtaInterviewHalfDayBlockDto {
  id: string
  date: string
  dayOfWeek?: number
  dayName?: string
  blockType?: 'MORNING' | 'AFTERNOON'
  halfDay?: 'MORNING' | 'AFTERNOON'
  period?: string
  label: string
  blockLabel?: string
  dateLabel?: string
  timeRangeLabel?: string
  isCurrentBlock?: boolean
  openSlotsCount?: number
  availableSlotsCount?: number
  totalSlotsCount?: number
  totalCapacity?: number
  utilizationPercentage?: number
  isHighDemand?: boolean
  slots: GtaInterviewSlotDto[]
}

export interface GtaInterviewSlotsResponse {
  assignmentId: string
  assignmentTitle: string
  interviewLocation?: string | null
  interviewWindowStart?: string | Date | null
  interviewWindowEnd?: string | Date | null
  blocks: GtaInterviewHalfDayBlockDto[]
}

export interface GtaInterviewReservationDto {
  id: string
  assignmentId: string
  assignmentTitle?: string
  studentId: string
  gtaId: string
  startTime: string
  endTime: string
  status: GtaInterviewStatusType
  interviewLocation?: string | null
  notes?: string | null
  createdAt?: string
  updatedAt?: string
  gta?: {
    id: string
    firstName: string | null
    lastName: string | null
    email: string
  } | null
  student?: {
    id: string
    name?: string | null
    email?: string | null
  } | null
}

export interface ImpactedReservation {
  reservationId: string
  studentId: string
  studentName: string
  studentEmail: string
  assignmentId: string
  assignmentTitle: string
  startTime: string
  endTime: string
  previousGtaId: string
  previousGtaName: string
  newGtaId?: string
  newGtaName?: string
  reason?: string
}

export interface ShiftImpactSummary {
  rescheduled: ImpactedReservation[]
  cancelled: ImpactedReservation[]
}

export interface AvailableGtaDto {
  id: string
  name: string
  email: string
}

export interface GtaShiftSlotDetail {
  startTime: string
  endTime: string
  timeLabel: string
  isReserved: boolean
  reservation?: {
    id: string
    studentId: string
    studentName: string
    studentEmail: string
    assignmentId: string
    assignmentTitle: string
    status: GtaInterviewStatusType
    startTime: string
    endTime: string
  }
  canReschedule: boolean
  availableGtas: AvailableGtaDto[]
}

export interface GtaShiftDetailsDto {
  shift: {
    id: string
    courseId: string
    userId: string
    date: string
    startTime: string
    endTime: string
    gta: {
      id: string
      name: string
      email: string
      avatarUrl?: string | null
    }
  }
  slots: GtaShiftSlotDetail[]
  totalSlots: number
  reservedCount: number
  vacantCount: number
}

export const rescheduleInterviewReservationInputSchema = z.object({
  targetGtaId: z.string().optional()
})

export type RescheduleInterviewReservationInput = z.infer<
  typeof rescheduleInterviewReservationInputSchema
>

export const previewShiftImpactInputSchema = z.object({
  userId: z.string().optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)')
    .optional(),
  startTime: z.string().regex(gtaTimeRegex, 'Invalid startTime format (HH:mm)').optional(),
  endTime: z.string().regex(gtaTimeRegex, 'Invalid endTime format (HH:mm)').optional(),
  isDelete: z.boolean().optional()
})

export type PreviewShiftImpactInput = z.infer<typeof previewShiftImpactInputSchema>

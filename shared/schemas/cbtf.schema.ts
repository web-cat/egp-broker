/**
 * CBTF (Computer-Based Testing Facility) Schemas
 *
 * Validation schemas for CBTF operations, queries, and proctoring
 */

import { z } from 'zod'

export const cbtfTimeRegex = /^([01]\d|2[0-3]):[0-5]\d$/

export const cbtfReservationStatusEnum = z.enum([
  'SCHEDULED',
  'CHECKED_IN',
  'COMPLETED',
  'MISSED',
  'CANCELLED'
])

export const cbtfFacilityConfigSchema = z.object({
  name: z.string().min(1, 'Facility name is required').max(100),
  totalSeats: z.number().int().min(1, 'At least 1 seat is required').max(500),
  seatAllocationOrder: z
    .array(z.number().int().positive())
    .min(1, 'Seat allocation order must not be empty')
})

export const cbtfOperatingHoursInputSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    openTime: z.string().regex(cbtfTimeRegex, 'Invalid open time format (HH:mm)'),
    closeTime: z.string().regex(cbtfTimeRegex, 'Invalid close time format (HH:mm)')
  })
  .refine((data) => data.closeTime > data.openTime, {
    message: 'closeTime must be after openTime',
    path: ['closeTime']
  })

export const cbtfScheduleExceptionInputSchema = z.object({
  date: z.string().datetime(),
  isClosed: z.boolean().default(false),
  openTime: z
    .string()
    .regex(cbtfTimeRegex, 'Invalid open time format (HH:mm)')
    .nullable()
    .optional(),
  closeTime: z
    .string()
    .regex(cbtfTimeRegex, 'Invalid close time format (HH:mm)')
    .nullable()
    .optional(),
  reason: z.string().max(200).nullable().optional()
})

export const cbtfProctorShiftInputSchema = z
  .object({
    userId: z.string().cuid(),
    date: z.string().datetime(),
    startTime: z.string().regex(cbtfTimeRegex, 'Invalid start time format (HH:mm)'),
    endTime: z.string().regex(cbtfTimeRegex, 'Invalid end time format (HH:mm)')
  })
  .refine((data) => data.endTime > data.startTime, {
    message: 'endTime must be after startTime',
    path: ['endTime']
  })

export const createReservationInputSchema = z.object({
  assignmentId: z.string().cuid(),
  startTime: z.string().datetime()
})

export const rescheduleReservationInputSchema = z.object({
  startTime: z.string().datetime()
})

export const proctorCheckInInputSchema = z.object({
  studentId: z.string().trim().min(1, 'Student ID is required')
})

export const proctorCheckOutInputSchema = z.object({
  studentId: z.string().trim().min(1, 'Student ID is required')
})

export const cbtfAvailabilityQuerySchema = z.object({
  assignmentId: z.string().cuid(),
  timeOfDayPreference: z.enum(['morning', 'afternoon']).optional(),
  selectedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD')
    .optional()
})

export const cbtfReservationRowSchema = z.object({
  id: z.string(),
  facilityId: z.string(),
  assignmentId: z.string(),
  assignmentTitle: z.string().optional(),
  userId: z.string(),
  studentName: z.string().optional(),
  studentId: z.string().nullable().optional(),
  studentAvatarUrl: z.string().nullable().optional(),
  seatNumber: z.number().int(),
  startTime: z.string(),
  endTime: z.string(),
  status: cbtfReservationStatusEnum,
  checkedInAt: z.string().nullable(),
  checkedOutAt: z.string().nullable(),
  checkedInByUserId: z.string().nullable(),
  checkedOutByUserId: z.string().nullable()
})

export type CbtfFacilityConfigInput = z.infer<typeof cbtfFacilityConfigSchema>
export type CbtfOperatingHoursInput = z.infer<typeof cbtfOperatingHoursInputSchema>
export type CbtfScheduleExceptionInput = z.infer<typeof cbtfScheduleExceptionInputSchema>
export type CbtfProctorShiftInput = z.infer<typeof cbtfProctorShiftInputSchema>
export type CreateReservationInput = z.infer<typeof createReservationInputSchema>
export type RescheduleReservationInput = z.infer<typeof rescheduleReservationInputSchema>
export type ProctorCheckInInput = z.infer<typeof proctorCheckInInputSchema>
export type ProctorCheckOutInput = z.infer<typeof proctorCheckOutInputSchema>
export type CbtfAvailabilityQuery = z.infer<typeof cbtfAvailabilityQuerySchema>
export type CbtfReservationRow = z.infer<typeof cbtfReservationRowSchema>

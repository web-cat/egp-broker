/**
 * Pass Model
 *
 * This file contains Pass-related types, interfaces and validation schemas
 */

import type { StudentPassPool, PassType } from '@prisma/client'

import { z } from 'zod'

/**
 * Simplified pass pool for student dashboard
 */
export interface SimplePassPool {
  id: string
  name: string
  balance: number
}

export const redemptionRowSchema = z.object({
  id: z.string(),
  assignmentTitle: z.string().nullable(),
  createdAt: z.string(),
  cost: z.number(),
  hoursPerPass: z.number(),
  availableFrom: z.string().nullable(),
  acceptUntil: z.string().nullable(),
  isActive: z.boolean()
})

export type RedemptionRow = z.infer<typeof redemptionRowSchema>

/**
 * PassType data for dashboard
 */
export const passTypeDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  extensionOnly: z.boolean(),
  initialBalance: z.number(),
  allowRequests: z.boolean(),
  hoursPerPass: z.number(),
  titlePattern: z.string().nullable(),
  coolDownPeriod: z.number().nullable(),
  coolDownUnit: z.enum(['HOUR', 'DAY', 'WEEK']).nullable(),
  coolDownReset: z.enum(['HOUR', 'DAY', 'WEEK']).nullable(),
  coolDownResetOffset: z.number().nullable(),
  minDaysPastDue: z.number().nullable(),
  maxDaysPastDue: z.number().nullable(),
  createdAt: z.string()
})

export type PassTypeData = z.infer<typeof passTypeDataSchema>

export const createPassTypeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().nullable(),
  extensionOnly: z.boolean().default(false),
  initialBalance: z.number().int().min(0).default(3),
  allowRequests: z.boolean().default(false),
  hoursPerPass: z.number().min(0).default(24),
  titlePattern: z.string().optional().nullable(),
  coolDownPeriod: z.number().int().min(0).optional().nullable(),
  coolDownUnit: z.enum(['HOUR', 'DAY', 'WEEK']).optional().nullable(),
  coolDownReset: z.enum(['HOUR', 'DAY', 'WEEK']).optional().nullable(),
  coolDownResetOffset: z.number().int().min(0).optional().nullable(),
  minDaysPastDue: z.number().int().min(0).optional().nullable(),
  maxDaysPastDue: z.number().int().min(0).optional().nullable()
})

export const updatePassTypeSchema = createPassTypeSchema.partial()

/**
 * Helper to convert Prisma StudentPassPool to SimplePassPool
 */
export function toSimplePassPool(pool: StudentPassPool & { passType: PassType }): SimplePassPool {
  return {
    id: pool.id,
    name: pool.passType.name,
    balance: pool.balance
  }
}

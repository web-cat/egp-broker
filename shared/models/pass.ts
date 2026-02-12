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

/**
 * PassType data for dashboard
 */
export interface PassTypeData {
  id: string
  name: string
  description: string | null
  extensionOnly: boolean
  initialBalance: number
  allowRequests: boolean
  hoursPerPass: number
  titlePattern: string | null
  coolDownPeriod: number | null
  coolDownUnit: 'HOUR' | 'DAY' | 'WEEK' | null
  coolDownReset: 'HOUR' | 'DAY' | 'WEEK' | null
  minDaysPastDue: number | null
  maxDaysPastDue: number | null
  createdAt: string
}

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

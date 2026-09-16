/**
 * CBTF (Computer-Based Testing Facility) Models
 *
 * Types, interfaces, and DTOs for the CBTF Scheduler feature
 */

import type {
  CbtfFacility,
  CbtfOperatingHours,
  CbtfScheduleException,
  CbtfProctorShift,
  CbtfReservation,
  CbtfReservationStatus,
  CbtfReservationNote
} from '@prisma/client'

export type {
  CbtfFacility,
  CbtfOperatingHours,
  CbtfScheduleException,
  CbtfProctorShift,
  CbtfReservation,
  CbtfReservationStatus,
  CbtfReservationNote
}

export interface CbtfFacilitySummary {
  id: string
  name: string
  totalSeats: number
  seatAllocationOrder: number[]
  checkInLeadMinutes?: number
  checkInGraceMinutes?: number
  timezone?: string
  createdAt: string
  updatedAt: string
}

export interface CbtfOperatingHoursDto {
  id: string
  facilityId: string
  dayOfWeek: number
  openTime: string
  closeTime: string
}

export interface CbtfScheduleExceptionDto {
  id: string
  facilityId: string
  date: string
  isClosed: boolean
  openTime: string | null
  closeTime: string | null
  reason: string | null
}

export interface CbtfProctorShiftDto {
  id: string
  facilityId: string
  userId: string
  userName?: string
  date: string
  startTime: string
  endTime: string
}

export interface CbtfReservationDto {
  id: string
  facilityId: string
  assignmentId: string
  assignmentTitle?: string
  userId: string
  studentName?: string
  studentEmail?: string | null
  studentId?: string | null
  studentAvatarUrl?: string | null
  seatNumber: number
  startTime: string
  endTime: string
  status: CbtfReservationStatus
  checkedInAt: string | null
  checkedOutAt: string | null
  checkedInByUserId: string | null
  checkedOutByUserId: string | null
  canvasOverrideId?: string | null
  noteCount?: number
  notes?: CbtfReservationNoteDto[]
}

export interface CbtfReservationNoteDto {
  id: string
  reservationId: string
  authorId: string
  authorName?: string
  content: string
  hasPhotos: boolean
  createdAt: string
  updatedAt: string
}

export interface CbtfRecommendedDay {
  date: string // YYYY-MM-DD
  dayOfWeek: number
  label: string // e.g. "Monday, Sep 8"
  openSlotsCount: number
  utilizationPercentage: number
}

export interface CbtfHalfDayBlock {
  id: string // e.g. "2026-09-15-morning"
  date: string // YYYY-MM-DD
  dayOfWeek: number
  blockType: 'morning' | 'afternoon'
  label: string // e.g. "Tuesday Morning"
  dateLabel: string // e.g. "Sep 15"
  timeRangeLabel: string // e.g. "8:00 AM – 1:00 PM"
  isCurrentBlock: boolean
  openSlotsCount: number
  totalSlotsCount: number
  utilizationPercentage: number
  isHighDemand: boolean // true if utilizationPercentage > 60
}

export interface CbtfHourlySlotChoice {
  hour: number // e.g. 9 for 09:00
  startTime: string // ISO string
  endTime: string // ISO string
  formattedTime: string // e.g. "9:15 AM"
}

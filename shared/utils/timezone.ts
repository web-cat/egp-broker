/**
 * Centralized Timezone Utilities & Constants
 *
 * Single Source of Truth (SSoT) for handling timezone conversions between
 * local wall-clock times (e.g. shifts, operating hours) and UTC instants (reservations).
 */

export const DEFAULT_TIMEZONE = 'America/New_York'
export const DEFAULT_CBTF_TIMEZONE = DEFAULT_TIMEZONE
export const DEFAULT_GTA_TIMEZONE = DEFAULT_TIMEZONE

/**
 * Returns formatted "YYYY-MM-DD" string for a Date in the given IANA timezone.
 */
export function getLocalDateString(date: Date, timeZone: string = DEFAULT_TIMEZONE): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
  return formatter.format(date)
}

/**
 * Extracts a calendar date string ("YYYY-MM-DD") from either an ISO/date string or Date object.
 * If the Date is at midnight UTC, its UTC date is preserved; otherwise it is evaluated in timeZone.
 */
export function extractCalendarDate(
  date: Date | string,
  timeZone: string = DEFAULT_TIMEZONE
): string {
  if (typeof date === 'string') return date.split('T')[0]
  if (
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0
  ) {
    return date.toISOString().split('T')[0]
  }
  return getLocalDateString(date, timeZone)
}

/**
 * Returns day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday) for a Date in the specified timezone.
 */
export function getLocalDayOfWeek(date: Date, timeZone: string = DEFAULT_TIMEZONE): number {
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' })
  const day = formatter.format(date)
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return map[day] ?? 0
}

/**
 * Extracts 24-hour hour, minute, day of week, and 12-hour formatted time string in the specified timezone.
 */
export function getLocalTimeParts(
  date: Date,
  timeZone: string = DEFAULT_TIMEZONE
): {
  hour24: number
  minute: number
  dayOfWeek: number
  formattedTime: string
} {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: false
  })
  const parts = Object.fromEntries(formatter.formatToParts(date).map((p) => [p.type, p.value]))
  const hour24 = parts.hour === '24' ? 0 : Number(parts.hour)
  const minute = Number(parts.minute)

  const displayFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
  const formattedTime = displayFormatter.format(date)

  return {
    hour24,
    minute,
    dayOfWeek: getLocalDayOfWeek(date, timeZone),
    formattedTime
  }
}

/**
 * Builds an absolute Date object (in UTC) by combining a calendar date (Date or "YYYY-MM-DD")
 * and a 24-hour "HH:mm" time string interpreted in the specified IANA timezone.
 */
export function combineDateAndTime(
  date: Date | string,
  timeStr: string,
  timeZone: string = DEFAULT_TIMEZONE
): Date {
  const dateStr = extractCalendarDate(date, timeZone)
  const [year, month, day] = dateStr.split('-').map(Number)
  const [hours, minutes] = timeStr.split(':').map(Number)

  if (timeZone === 'UTC') {
    return new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0))
  }

  const naiveUtc = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0))
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
  const parts = Object.fromEntries(formatter.formatToParts(naiveUtc).map((p) => [p.type, p.value]))
  const parsedHour = parts.hour === '24' ? 0 : Number(parts.hour)
  const inTz = new Date(
    Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      parsedHour,
      Number(parts.minute),
      Number(parts.second)
    )
  )
  const offsetMs = inTz.getTime() - naiveUtc.getTime()
  return new Date(naiveUtc.getTime() - offsetMs)
}

/**
 * Normalizes common variations of human-entered times into a strict 24-hour "HH:mm" string.
 * Supports:
 * - 24-hour format: "09:00", "9:00", "14:30"
 * - 12-hour format with AM/PM: "9:00 AM", "9:00am", "9am", "9 AM", "1:30pm", "1:30 PM", "12:00 AM", "12:00 PM"
 * - Plain hour: "9", "14"
 */
export function normalizeTimeTo24h(input?: string | null): string | null {
  if (!input) return null
  const trimmed = input.trim()
  if (!trimmed) return null

  // Match: (hours)(:minutes)? (optional seconds)? (am/pm)?
  // e.g. "9", "09:00", "9:00am", "9:00 AM", "1:30pm", "13:45"
  const match = trimmed.match(/^(\d{1,2})(?::(\d{1,2}))?(?::\d{1,2})?\s*(am|pm)?$/i)
  if (!match) return null

  let hour = parseInt(match[1], 10)
  const minute = match[2] !== undefined ? parseInt(match[2], 10) : 0
  const meridian = match[3]?.toLowerCase()

  if (minute < 0 || minute > 59) return null

  if (meridian === 'pm') {
    if (hour < 1 || hour > 12) return null
    if (hour < 12) hour += 12
  } else if (meridian === 'am') {
    if (hour < 1 || hour > 12) return null
    if (hour === 12) hour = 0
  } else {
    // No AM/PM: must be valid 24-hour hour (0..23)
    if (hour < 0 || hour > 23) return null
  }

  const hh = hour.toString().padStart(2, '0')
  const mm = minute.toString().padStart(2, '0')
  return `${hh}:${mm}`
}

/**
 * Formats a Date or ISO string into a local input string ("YYYY-MM-DDTHH:mm") in the specified timezone.
 */
export function formatDateTimeInput(
  date: Date | string | null | undefined,
  timeZone: string = DEFAULT_TIMEZONE
): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return ''

  const dateStr = getLocalDateString(d, timeZone)
  const parts = getLocalTimeParts(d, timeZone)
  const hh = parts.hour24.toString().padStart(2, '0')
  const mm = parts.minute.toString().padStart(2, '0')
  return `${dateStr}T${hh}:${mm}`
}

/**
 * Parses an input string ("YYYY-MM-DDTHH:mm" or "YYYY-MM-DD") in the specified timezone into a UTC ISO string.
 */
export function parseDateTimeInput(
  value: string | null | undefined,
  timeZone: string = DEFAULT_TIMEZONE
): string | null {
  if (!value || typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null

  const [datePart, timePart] = trimmed.split('T')
  if (!datePart) return null
  const timeStr = timePart ? timePart.slice(0, 5) : '00:00'
  return combineDateAndTime(datePart, timeStr, timeZone).toISOString()
}

/**
 * Formats a timestamp into an upcoming display string ("Mon DD at H:mm AM/PM") in the specified timezone.
 */
export function formatUpcomingDate(
  date: Date | string,
  timeZone: string = DEFAULT_TIMEZONE
): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '—'

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'short',
    day: 'numeric'
  })
  const parts = getLocalTimeParts(d, timeZone)
  return `${formatter.format(d)} at ${parts.formattedTime}`
}

/**
 * Formats a start and end instant into a time slot range string ("Mon DD, H:mm AM/PM – H:mm AM/PM") in the specified timezone.
 */
export function formatSlotRange(
  start: Date | string,
  end: Date | string,
  timeZone: string = DEFAULT_TIMEZONE
): string {
  const s = typeof start === 'string' ? new Date(start) : start
  const e = typeof end === 'string' ? new Date(end) : end
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return '—'

  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })
  const startParts = getLocalTimeParts(s, timeZone)
  const endParts = getLocalTimeParts(e, timeZone)
  return `${dateFormatter.format(s)}, ${startParts.formattedTime} – ${endParts.formattedTime}`
}

/**
 * Checks whether an instant falls in the morning block (< 12:30 PM local wall-clock) in the specified timezone.
 */
export function isMorningSlot(date: Date | string, timeZone: string = DEFAULT_TIMEZONE): boolean {
  const d = typeof date === 'string' ? new Date(date) : date
  const parts = getLocalTimeParts(d, timeZone)
  return parts.hour24 < 12 || (parts.hour24 === 12 && parts.minute < 30)
}

/**
 * Formats a date using Intl.DateTimeFormat strictly locked to the specified timezone.
 */
export function formatDateInTz(
  date: Date | string | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  },
  timeZone: string = DEFAULT_TIMEZONE,
  locale: string = 'en-US'
): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(d)
}

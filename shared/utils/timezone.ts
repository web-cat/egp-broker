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

export interface ParsedShiftSlot {
  dayOfWeek: number // 0 = Sun, 1 = Mon, ..., 6 = Sat
  dayName: string
  startTime: string // "HH:mm" (24h)
  endTime: string // "HH:mm" (24h)
  durationHours: number
}

const DAY_MAP: Record<string, { dayOfWeek: number; dayName: string }> = {
  mon: { dayOfWeek: 1, dayName: 'Monday' },
  monday: { dayOfWeek: 1, dayName: 'Monday' },
  tue: { dayOfWeek: 2, dayName: 'Tuesday' },
  tues: { dayOfWeek: 2, dayName: 'Tuesday' },
  tuesday: { dayOfWeek: 2, dayName: 'Tuesday' },
  wed: { dayOfWeek: 3, dayName: 'Wednesday' },
  wednesday: { dayOfWeek: 3, dayName: 'Wednesday' },
  thu: { dayOfWeek: 4, dayName: 'Thursday' },
  thur: { dayOfWeek: 4, dayName: 'Thursday' },
  thurs: { dayOfWeek: 4, dayName: 'Thursday' },
  thursday: { dayOfWeek: 4, dayName: 'Thursday' },
  fri: { dayOfWeek: 5, dayName: 'Friday' },
  friday: { dayOfWeek: 5, dayName: 'Friday' },
  sat: { dayOfWeek: 6, dayName: 'Saturday' },
  saturday: { dayOfWeek: 6, dayName: 'Saturday' },
  sun: { dayOfWeek: 0, dayName: 'Sunday' },
  sunday: { dayOfWeek: 0, dayName: 'Sunday' }
}

/**
 * Normalizes a time string (e.g. "2", "2:00", "11:30") and optional meridian ("AM"/"PM")
 * into a 24-hour "HH:mm" string and minute count from midnight.
 */
function to24HourTime(
  timeStr: string,
  meridian?: string
): { time24: string; minutes: number } | null {
  const parts = timeStr.trim().split(':')
  let hour = parseInt(parts[0], 10)
  const minute = parts.length > 1 ? parseInt(parts[1], 10) : 0

  if (isNaN(hour) || isNaN(minute) || minute < 0 || minute >= 60) {
    return null
  }

  const mer = meridian?.toUpperCase()

  if (mer === 'PM') {
    if (hour < 12) hour += 12
  } else if (mer === 'AM') {
    if (hour === 12) hour = 0
  }

  if (hour < 0 || hour >= 24) {
    return null
  }

  const hh = hour.toString().padStart(2, '0')
  const mm = minute.toString().padStart(2, '0')
  return {
    time24: `${hh}:${mm}`,
    minutes: hour * 60 + minute
  }
}

/**
 * Parses a shift time range (e.g. "2:00–5:00 PM", "9:00 AM–12:00 PM", "09:00 - 17:00")
 */
function parseTimeRange(
  rawRange: string
): { startTime: string; endTime: string; durationHours: number } | null {
  // Regex to match "START [AM|PM] to/–/-/— END [AM|PM]"
  const rangeRegex =
    /(\d{1,2}(?::\d{2})?)\s*(AM|PM)?\s*(?:–|—|-|\bto\b)\s*(\d{1,2}(?::\d{2})?)\s*(AM|PM)?/i
  const match = rawRange.match(rangeRegex)
  if (!match) return null

  const [, startRaw, startMeridian, endRaw, endMeridian] = match

  let resolvedStartMer = startMeridian
  const resolvedEndMer = endMeridian

  // Smart meridian resolution:
  // If end is PM and start has no meridian specified:
  // E.g. "2:00 - 5:00 PM": start should be PM (14:00)
  // E.g. "11:30 - 2:30 PM": start should be AM (11:30)
  if (!resolvedStartMer && resolvedEndMer?.toUpperCase() === 'PM') {
    const startHour = parseInt(startRaw.split(':')[0], 10)
    const endHour = parseInt(endRaw.split(':')[0], 10)
    if (startHour === 12) {
      resolvedStartMer = 'PM'
    } else if (startHour <= endHour) {
      resolvedStartMer = 'PM'
    } else {
      resolvedStartMer = 'AM'
    }
  } else if (!resolvedStartMer && resolvedEndMer?.toUpperCase() === 'AM') {
    resolvedStartMer = 'AM'
  }

  const startParsed = to24HourTime(startRaw, resolvedStartMer)
  const endParsed = to24HourTime(endRaw, resolvedEndMer)

  if (!startParsed || !endParsed) return null
  if (endParsed.minutes <= startParsed.minutes) return null

  const durationHours = Math.round(((endParsed.minutes - startParsed.minutes) / 60) * 10) / 10

  return {
    startTime: startParsed.time24,
    endTime: endParsed.time24,
    durationHours
  }
}

/**
 * Parses a natural proctor shift text string, e.g.:
 * "Mon 2:00–5:00 PM (3.0h), Wed 9:00–11:30 AM (2.5h), Fri 9:00–11:30 AM (2.5h)"
 * or multi-line lines.
 */
export function parseProctorShiftString(input: string): ParsedShiftSlot[] {
  if (!input || !input.trim()) return []

  // Split by commas or newlines or semicolons, but avoid splitting inside parentheses
  const segments = input
    .replace(/\([^)]*\)/g, '') // Strip duration labels like (3.0h)
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)

  const slots: ParsedShiftSlot[] = []

  for (const seg of segments) {
    // Find day keyword at beginning of segment
    const dayMatch = seg.match(
      /^\s*(Mon(?:day)?|Tue(?:s(?:day)?)?|Wed(?:nesday)?|Thu(?:r(?:s(?:day)?)?)?|Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?)\b/i
    )
    if (!dayMatch) continue

    const dayKey = dayMatch[1].toLowerCase()
    const dayInfo = DAY_MAP[dayKey]
    if (!dayInfo) continue

    const timePortion = seg.substring(dayMatch[0].length).trim()
    const parsedRange = parseTimeRange(timePortion)
    if (!parsedRange) continue

    slots.push({
      dayOfWeek: dayInfo.dayOfWeek,
      dayName: dayInfo.dayName,
      startTime: parsedRange.startTime,
      endTime: parsedRange.endTime,
      durationHours: parsedRange.durationHours
    })
  }

  // Sort by dayOfWeek (Monday = 1 through Sunday = 0)
  return slots.sort((a, b) => {
    const aOrder = a.dayOfWeek === 0 ? 7 : a.dayOfWeek
    const bOrder = b.dayOfWeek === 0 ? 7 : b.dayOfWeek
    if (aOrder !== bOrder) return aOrder - bOrder
    return a.startTime.localeCompare(b.startTime)
  })
}

/**
 * Calculates the sum of durations in hours for an array of shift slots.
 */
export function calculateWeeklyShiftHours(
  shifts: Array<{ durationHours?: number; startTime: string; endTime: string }>
): number {
  const total = shifts.reduce((sum, s) => {
    if (typeof s.durationHours === 'number') {
      return sum + s.durationHours
    }
    const [sh, sm] = s.startTime.split(':').map(Number)
    const [eh, em] = s.endTime.split(':').map(Number)
    const dur = (eh * 60 + em - (sh * 60 + sm)) / 60
    return sum + (dur > 0 ? dur : 0)
  }, 0)
  return Math.round(total * 10) / 10
}

/**
 * Formats a 24-hour "HH:mm" time string into a 12-hour string (e.g. "14:00" -> "2:00 PM").
 */
export function formatTimeStr12h(timeStr: string): string {
  if (!timeStr) return ''
  const [hStr, mStr] = timeStr.split(':')
  const h = parseInt(hStr, 10)
  const m = parseInt(mStr || '0', 10)
  if (isNaN(h) || isNaN(m)) return timeStr
  const ampm = h >= 12 ? 'PM' : 'AM'
  const displayH = h % 12 === 0 ? 12 : h % 12
  return `${displayH}:${m.toString().padStart(2, '0')} ${ampm}`
}

/**
 * Formats duration between two 24-hour times as string (e.g. "14:00", "17:00" -> "3.0h").
 */
export function formatShiftDuration(startTime: string, endTime: string): string {
  if (!startTime || !endTime) return ''
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return ''
  const dur = (eh * 60 + em - (sh * 60 + sm)) / 60
  if (dur <= 0) return ''
  return `${dur % 1 === 0 ? dur.toFixed(1) : (Math.round(dur * 10) / 10).toString()}h`
}

/**
 * Formats a shift date into a human-friendly UTC string (e.g. "Wed, Sep 16, 2026").
 */
export function formatShiftDate(dateVal: string | Date): string {
  if (!dateVal) return ''
  const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  })
}

export interface ParsedNoticeItem {
  studentIdentifier: string
  notice: string
}

export interface CsvTableData {
  headers: string[]
  rows: string[][]
}

const IDENTIFIER_HIGH_PRIORITY_REGEX =
  /(email|net.?ids?|student.?ids?|sis.?user.?ids?|sis.?login.?ids?|usernames?|login.?ids?|user.?ids?)/i

const IDENTIFIER_FALLBACK_REGEX = /(users?|students?)/i

const STUDENT_COL_REGEX =
  /(email|net.?ids?|student.?ids?|sis.?user.?ids?|sis.?login.?ids?|usernames?|login.?ids?|user.?ids?|users?|students?)/i

const NOTICE_COL_REGEX =
  /(interview.?questions?|staff.?notices?|notices?|comments?|feedbacks?|notes?|messages?|remarks?|reviews?|flags?|descriptions?|issues?|questions?)/i

const SENTINEL_NOTICES = new Set([
  '',
  'n/a',
  'na',
  'none',
  '-',
  '--',
  '---',
  'null',
  'undefined',
  'nil',
  'no'
])

/**
 * Splits a single CSV/TSV line respecting double and single quotes.
 */
export function parseCsvLine(text: string): string[] {
  const result: string[] = []
  let cur = ''
  let inQuotes = false
  let quoteChar = ''
  const isTab = text.includes('\t')

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (!inQuotes && (char === '"' || char === '\'')) {
      inQuotes = true
      quoteChar = char
    } else if (inQuotes && char === quoteChar) {
      inQuotes = false
      quoteChar = ''
    } else if ((char === ',' || (isTab && char === '\t')) && !inQuotes) {
      result.push(cur.trim().replace(/^["']|["']$/g, ''))
      cur = ''
    } else {
      cur += char
    }
  }
  result.push(cur.trim().replace(/^["']|["']$/g, ''))
  return result
}

/**
 * Checks whether a row of cells represents a column header row rather than student data.
 */
export function isHeaderRow(cells: string[]): boolean {
  if (!cells || cells.length === 0) return false
  const first = cells[0].toLowerCase().trim()
  if (first.includes('@')) return false
  if (/^\d{5,}$/.test(first)) return false

  return STUDENT_COL_REGEX.test(first) || cells.some((c) => NOTICE_COL_REGEX.test(c.trim()))
}

/**
 * Parses raw CSV or TSV tabular text into structured headers and rows.
 */
export function parseCsvTable(rawText: string | null | undefined): CsvTableData {
  if (!rawText || typeof rawText !== 'string') {
    return { headers: [], rows: [] }
  }

  const lines = rawText.trim().split(/\r?\n/)
  const nonEmptyLines = lines.map((l) => l.trim()).filter(Boolean)

  if (nonEmptyLines.length === 0) {
    return { headers: [], rows: [] }
  }

  const firstLineCells = parseCsvLine(nonEmptyLines[0])
  const hasHeaders = isHeaderRow(firstLineCells)

  if (hasHeaders) {
    const headers = firstLineCells
    const rows: string[][] = []
    for (let i = 1; i < nonEmptyLines.length; i++) {
      const row = parseCsvLine(nonEmptyLines[i])
      rows.push(row)
    }
    return { headers, rows }
  }

  // Synthesize default column names if no header line was provided
  const headers = firstLineCells.map((_, i) =>
    i === 0 ? 'Student' : i === 1 ? 'Staff Notice' : `Column ${i + 1}`
  )
  const rows: string[][] = []
  for (let i = 0; i < nonEmptyLines.length; i++) {
    const row = parseCsvLine(nonEmptyLines[i])
    rows.push(row)
  }

  return { headers, rows }
}

/**
 * Detects the best 0-based column index for student identification (email, netid, student id).
 * Prioritizes direct system identifiers (Email, NetID, Student ID) over generic Name columns.
 */
export function detectStudentIdentifierColumn(headers: string[]): number {
  if (!headers || headers.length === 0) return 0

  // First pass: look for high-priority identifiers (Email, Student ID, NetID, SIS User ID)
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i].trim()
    if (IDENTIFIER_HIGH_PRIORITY_REGEX.test(header)) {
      return i
    }
  }

  // Second pass: look for user/student generic columns
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i].trim()
    if (IDENTIFIER_FALLBACK_REGEX.test(header)) {
      return i
    }
  }

  return 0
}

/**
 * Detects the best 0-based column index for the staff notice / guidance message.
 */
export function detectNoticeColumn(headers: string[]): number {
  if (!headers || headers.length === 0) return 0

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i].trim()
    if (NOTICE_COL_REGEX.test(header)) {
      return i
    }
  }

  // If no pattern matched, default to the second column if available, else first
  return headers.length > 1 ? 1 : 0
}

/**
 * Extracts notice items from a parsed CSV table given the chosen student and notice column indices.
 * Filters out empty student identifiers, empty notices, and sentinel values ("N/A", "None", "-").
 */
export function extractNoticesFromTable(
  table: CsvTableData,
  studentColIdx: number,
  noticeColIdx: number
): ParsedNoticeItem[] {
  const result: ParsedNoticeItem[] = []

  for (const row of table.rows) {
    if (isHeaderRow(row)) continue

    const studentIdentifier = (row[studentColIdx] || '').trim().replace(/^["']|["']$/g, '')
    const notice = (row[noticeColIdx] || '').trim().replace(/^["']|["']$/g, '')

    if (!studentIdentifier || !notice) continue
    if (SENTINEL_NOTICES.has(notice.toLowerCase())) continue

    result.push({ studentIdentifier, notice })
  }

  return result
}

/**
 * Parses user input in CSV, TSV, or JSON format into structured notice items.
 */
export function parseNoticesInput(rawText: string | null | undefined): ParsedNoticeItem[] {
  if (!rawText || typeof rawText !== 'string') {
    return []
  }

  const trimmed = rawText.trim()
  if (!trimmed) {
    return []
  }

  // Attempt JSON parsing if text looks like JSON object or array
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsedJson = JSON.parse(trimmed)

      // Format 1: Array of objects
      if (Array.isArray(parsedJson)) {
        const items: ParsedNoticeItem[] = []
        for (const entry of parsedJson) {
          if (!entry || typeof entry !== 'object') continue
          const studentIdentifier = String(
            entry.studentIdentifier ||
              entry.email ||
              entry.studentId ||
              entry.netId ||
              entry.id ||
              ''
          ).trim()
          const notice = String(
            entry.notice || entry.message || entry.staffNotice || entry.comment || entry.text || ''
          ).trim()
          if (studentIdentifier && notice) {
            items.push({ studentIdentifier, notice })
          }
        }
        if (items.length > 0) return items
      }

      // Format 2: Key-value map (object)
      if (parsedJson && typeof parsedJson === 'object' && !Array.isArray(parsedJson)) {
        const items: ParsedNoticeItem[] = []
        for (const [key, val] of Object.entries(parsedJson)) {
          const studentIdentifier = String(key).trim()
          const notice =
            typeof val === 'string'
              ? val.trim()
              : typeof val === 'object' && val !== null
                ? String(
                    (val as any).notice || (val as any).message || (val as any).staffNotice || ''
                  ).trim()
                : String(val || '').trim()

          if (studentIdentifier && notice) {
            items.push({ studentIdentifier, notice })
          }
        }
        if (items.length > 0) return items
      }
    } catch {
      // If JSON parsing fails, fall through to delimited text parsing
    }
  }

  // Tabular parsing using table extraction with auto-detected columns
  const table = parseCsvTable(trimmed)
  if (table.headers.length >= 2) {
    const studentIdx = detectStudentIdentifierColumn(table.headers)
    let noticeIdx = detectNoticeColumn(table.headers)
    if (noticeIdx === studentIdx) {
      noticeIdx = studentIdx === 0 ? 1 : 0
    }
    const extracted = extractNoticesFromTable(table, studentIdx, noticeIdx)
    if (extracted.length > 0) return extracted
  }

  // Fallback line-by-line parsing if no table structure
  const lines = trimmed.split(/\r?\n/)
  const result: ParsedNoticeItem[] = []

  for (const line of lines) {
    const trimmedLine = line.trim()
    if (!trimmedLine) continue

    const isTab = trimmedLine.includes('\t')
    const parts = isTab ? trimmedLine.split('\t') : parseCsvLine(trimmedLine)

    if (parts.length >= 2) {
      const studentIdentifier = parts[0].trim().replace(/^["']|["']$/g, '')
      const notice = parts
        .slice(1)
        .join(isTab ? '\t' : ',')
        .trim()
        .replace(/^["']|["']$/g, '')

      if (STUDENT_COL_REGEX.test(studentIdentifier) && NOTICE_COL_REGEX.test(notice)) {
        continue
      }

      if (studentIdentifier && notice && !SENTINEL_NOTICES.has(notice.toLowerCase())) {
        result.push({ studentIdentifier, notice })
      }
    }
  }

  return result
}

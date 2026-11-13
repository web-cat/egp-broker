export interface ParsedNoticeItem {
  studentIdentifier: string
  notice: string
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

  // Delimited parsing (CSV / TSV)
  const lines = trimmed.split(/\r?\n/)
  const result: ParsedNoticeItem[] = []

  const headerKeywords = new Set([
    'studentidentifier',
    'student_identifier',
    'student id',
    'studentid',
    'email',
    'user',
    'username',
    'netid'
  ])

  for (const line of lines) {
    const trimmedLine = line.trim()
    if (!trimmedLine) continue

    // Detect delimiter: tab or comma
    const isTab = trimmedLine.includes('\t')
    let parts: string[] = []

    if (isTab) {
      parts = trimmedLine.split('\t')
    } else {
      // Split by comma with basic quote handling
      parts = parseCsvLine(trimmedLine)
    }

    if (parts.length >= 2) {
      const studentIdentifier = parts[0].trim().replace(/^["']|["']$/g, '')
      const notice = parts
        .slice(1)
        .join(isTab ? '\t' : ',')
        .trim()
        .replace(/^["']|["']$/g, '')

      // Check if this row is a header row
      if (
        headerKeywords.has(studentIdentifier.toLowerCase()) &&
        /notice|comment|message/i.test(notice)
      ) {
        continue
      }

      if (studentIdentifier && notice) {
        result.push({ studentIdentifier, notice })
      }
    }
  }

  return result
}

/**
 * Splits a single CSV line respecting double quotes.
 */
function parseCsvLine(text: string): string[] {
  const result: string[] = []
  let cur = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (char === '"' || char === '\'') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(cur.trim())
      cur = ''
    } else {
      cur += char
    }
  }
  result.push(cur.trim())
  return result
}

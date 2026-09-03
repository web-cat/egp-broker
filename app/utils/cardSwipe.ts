/**
 * Card Swipe & Barcode Input Parser
 *
 * Hardware magnetic stripe readers and barcode scanners typically act as USB keyboard wedges
 * that emit the card's track data followed by Enter.
 *
 * Standard Formats:
 * - Track 2 (most university student IDs): Starts with ';', ends with '?', data separated by '='
 *   Example: ";906000001=2512101?" -> "906000001"
 * - Track 1: Starts with '%B' or '%', ends with '?', data separated by '^'
 *   Example: "%B906000001^DOE/JANE^2512101?" -> "906000001"
 * - Clean ID / Manual Entry: "906000001" -> "906000001"
 */
export function parseCardSwipe(rawInput: string): string {
  if (!rawInput) return ''

  let text = rawInput.trim()

  // Remove surrounding carriage returns / line feeds / quotes
  text = text.replace(/[\r\n"']/g, '').trim()

  // Track 2: starts with semicolon
  if (text.startsWith(';')) {
    // Strip leading semicolon
    text = text.slice(1)
    // Strip trailing '?' if present
    if (text.endsWith('?')) {
      text = text.slice(0, -1)
    }
    // Take account number before '='
    const eqIdx = text.indexOf('=')
    if (eqIdx !== -1) {
      return text.slice(0, eqIdx).trim()
    }
    return text.trim()
  }

  // Track 1: starts with '%B' or '%'
  if (text.startsWith('%')) {
    let t1 = text.slice(1)
    if (t1.startsWith('B') || t1.startsWith('b')) {
      t1 = t1.slice(1)
    }
    // Strip trailing '?' if present
    if (t1.endsWith('?')) {
      t1 = t1.slice(0, -1)
    }
    // Take account number before first '^'
    const caretIdx = t1.indexOf('^')
    if (caretIdx !== -1) {
      return t1.slice(0, caretIdx).trim()
    }
    return t1.trim()
  }

  // Barcode or manual entry with standard sentinels
  // E.g. "+906000001?" or similar
  const cleaned = text.replace(/^[^a-zA-Z0-9]+/, '').replace(/[^a-zA-Z0-9]+$/, '')
  return cleaned || text
}

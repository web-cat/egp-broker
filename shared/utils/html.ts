/**
 * List of HTML tag names permitted in staff notices.
 * Covers standard text formatting, lists, code snippets, blockquotes, and safe links.
 */
const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'strike',
  'del',
  'span',
  'div',
  'ul',
  'ol',
  'li',
  'code',
  'pre',
  'blockquote',
  'hr',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'a',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6'
])

/**
 * Strips dangerous HTML elements, malicious attributes, and script injection vectors
 * from an HTML fragment before rendering via v-html.
 *
 * Preserves safe text formatting, lists, tables, and hyperlinks.
 */
export function sanitizeStaffNoticeHtml(rawHtml: string | null | undefined): string {
  if (!rawHtml || typeof rawHtml !== 'string') {
    return ''
  }

  let sanitized = rawHtml.trim()
  if (!sanitized) {
    return ''
  }

  // 1. Remove HTML comments
  sanitized = sanitized.replace(/<!--[\s\S]*?-->/g, '')

  // 2. Remove entire <script>...</script> blocks
  sanitized = sanitized.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')

  // 3. Remove entire <style>...</style> blocks
  sanitized = sanitized.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')

  // 4. Remove entire <svg>...</svg> blocks
  sanitized = sanitized.replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, '')

  // 5. Remove entire <math>...</math> blocks
  sanitized = sanitized.replace(/<math\b[^>]*>[\s\S]*?<\/math>/gi, '')

  // 6. Unwrap unsafe links (javascript:, vbscript:, data:, or without href) preserving inner text
  sanitized = sanitized.replace(
    /<a\b[^>]*(?:href\s*=\s*(?:'[^']*javascript:[^']*'|"[^"]*javascript:[^"]*"|javascript:[^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi,
    '$1'
  )
  sanitized = sanitized.replace(
    /<a\b[^>]*(?:href\s*=\s*(?:'[^']*vbscript:[^']*'|"[^"]*vbscript:[^"]*"|vbscript:[^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi,
    '$1'
  )
  sanitized = sanitized.replace(
    /<a\b[^>]*(?:href\s*=\s*(?:'[^']*data:[^']*'|"[^"]*data:[^"]*"|data:[^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi,
    '$1'
  )

  // 7. Parse and filter individual tags
  sanitized = sanitized.replace(/<\/?([a-z0-9_-]+)([^>]*)>/gi, (match, tagName, attrs) => {
    const lowerTag = tagName.toLowerCase()

    if (!ALLOWED_TAGS.has(lowerTag)) {
      return ''
    }

    // For closing tags, return clean tag
    if (match.startsWith('</')) {
      return `</${lowerTag}>`
    }

    // Clean attributes
    let cleanAttrs = ''
    if (attrs) {
      // Remove all inline event handlers (on*)
      let safeAttrs = attrs.replace(/\bon\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '')

      // Remove javascript: and vbscript: URIs
      safeAttrs = safeAttrs.replace(
        /(?:href|src)\s*=\s*(?:'[^']*javascript:[^']*'|"[^"]*javascript:[^"]*"|javascript:[^\s>]+)/gi,
        ''
      )
      safeAttrs = safeAttrs.replace(
        /(?:href|src)\s*=\s*(?:'[^']*vbscript:[^']*'|"[^"]*vbscript:[^"]*"|vbscript:[^\s>]+)/gi,
        ''
      )
      safeAttrs = safeAttrs.replace(
        /(?:href|src)\s*=\s*(?:'[^']*data:[^']*'|"[^"]*data:[^"]*"|data:[^\s>]+)/gi,
        ''
      )

      // For <a> tags, ensure safe rel and target
      if (lowerTag === 'a') {
        const hrefMatch = safeAttrs.match(/href\s*=\s*(?:'([^']*)'|"([^"]*)"|([^\s>]+))/i)
        const href = hrefMatch ? hrefMatch[1] || hrefMatch[2] || hrefMatch[3] : null

        if (
          href &&
          (href.startsWith('http://') ||
            href.startsWith('https://') ||
            href.startsWith('/') ||
            href.startsWith('#'))
        ) {
          cleanAttrs = ` href="${href}" target="_blank" rel="noopener noreferrer"`
        } else {
          return '' // Drop anchor tags with unsafe or missing href
        }
      } else {
        // Allow safe class attribute if present
        const classMatch = safeAttrs.match(/class\s*=\s*(?:'([^']*)'|"([^"]*)")/i)
        if (classMatch) {
          const className = (classMatch[1] || classMatch[2]).replace(/[^a-zA-Z0-9_\-\s]/g, '')
          cleanAttrs += ` class="${className}"`
        }
      }
    }

    const isSelfClosing = match.endsWith('/>')
    return `<${lowerTag}${cleanAttrs}${isSelfClosing ? ' />' : '>'}`
  })

  return sanitized
}

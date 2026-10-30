import { describe, it, expect } from 'vitest'
import { sanitizeStaffNoticeHtml } from '@@/shared/utils/html'

describe('sanitizeStaffNoticeHtml Utility', () => {
  it('returns empty string for null, undefined, or empty input', () => {
    expect(sanitizeStaffNoticeHtml(null)).toBe('')
    expect(sanitizeStaffNoticeHtml(undefined)).toBe('')
    expect(sanitizeStaffNoticeHtml('')).toBe('')
    expect(sanitizeStaffNoticeHtml('   ')).toBe('')
  })

  it('preserves standard safe text formatting and lists', () => {
    const input =
      '<p><strong>Inspection Needed:</strong> Student code has <em>cycle issues</em>.</p>'
    expect(sanitizeStaffNoticeHtml(input)).toBe(input)

    const list = '<ul><li>Issue A</li><li>Issue B</li></ul>'
    expect(sanitizeStaffNoticeHtml(list)).toBe(list)

    const code = '<pre><code>const a = 1;</code></pre>'
    expect(sanitizeStaffNoticeHtml(code)).toBe(code)
  })

  it('strips script tags and contents completely', () => {
    const input = '<p>Normal text</p><script>alert("xss")</script>'
    expect(sanitizeStaffNoticeHtml(input)).toBe('<p>Normal text</p>')

    const multilineScript = `<p>Test</p><script type="text/javascript">
      window.location = "http://evil.com";
    </script>`
    expect(sanitizeStaffNoticeHtml(multilineScript)).toBe('<p>Test</p>')
  })

  it('strips iframes, objects, embeds, and forms', () => {
    const input =
      '<p>Intro</p><iframe src="https://evil.com"></iframe><form action="/login"><input type="text"/></form>'
    expect(sanitizeStaffNoticeHtml(input)).toBe('<p>Intro</p>')
  })

  it('strips inline event handlers (onerror, onload, onclick)', () => {
    const input = '<img src="x" onerror="alert(1)"/><span onclick="doBad()">Click me</span>'
    // img is not in allowed tags so it gets stripped; span is allowed but onclick is removed
    expect(sanitizeStaffNoticeHtml(input)).toBe('<span>Click me</span>')
  })

  it('neutralizes javascript: URIs in hyperlinks while preserving link text', () => {
    const badLink = '<a href="javascript:alert(1)">Click</a>'
    expect(sanitizeStaffNoticeHtml(badLink)).toBe('Click')

    const goodLink = '<a href="https://example.com/spec">Spec</a>'
    expect(sanitizeStaffNoticeHtml(goodLink)).toBe(
      '<a href="https://example.com/spec" target="_blank" rel="noopener noreferrer">Spec</a>'
    )
  })

  it('strips style, svg, and math blocks completely', () => {
    const input =
      '<style>body { display: none; }</style><svg><circle cx="50" cy="50" r="40"/></svg><p>Clean</p>'
    expect(sanitizeStaffNoticeHtml(input)).toBe('<p>Clean</p>')
  })

  it('strips HTML comments', () => {
    const input = '<!-- Secret comment --><p>Visible content</p>'
    expect(sanitizeStaffNoticeHtml(input)).toBe('<p>Visible content</p>')
  })

  it('preserves safe class attributes on allowed elements', () => {
    const input = '<span class="font-bold text-amber-600">Warning message</span>'
    expect(sanitizeStaffNoticeHtml(input)).toBe(
      '<span class="font-bold text-amber-600">Warning message</span>'
    )
  })
})

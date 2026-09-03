import { describe, it, expect } from 'vitest'
import { parseCardSwipe } from '../../../../app/utils/cardSwipe'

describe('parseCardSwipe Utility', () => {
  it('returns empty string for empty input', () => {
    expect(parseCardSwipe('')).toBe('')
    expect(parseCardSwipe('   ')).toBe('')
  })

  it('returns clean student ID as-is with trimming', () => {
    expect(parseCardSwipe('906000001')).toBe('906000001')
    expect(parseCardSwipe('  906000002  \n')).toBe('906000002')
  })

  it('parses standard Track 2 magnetic stripe data', () => {
    // Standard Track 2 format: ;[account]=[expiration][service_code][discretionary_data]?
    const track2 = ';906000001=28121010000?'
    expect(parseCardSwipe(track2)).toBe('906000001')

    const track2WithNewline = ';906000002=2610123?\r\n'
    expect(parseCardSwipe(track2WithNewline)).toBe('906000002')
  })

  it('parses Track 1 magnetic stripe data', () => {
    // Standard Track 1 format: %[FormatCode][account]^[name]^[expiration][discretionary]?
    const track1 = '%B906000003^DOE/JOHN^28121010000?'
    expect(parseCardSwipe(track1)).toBe('906000003')

    const track1Alt = '%906000004^SMITH/JANE^2610?'
    expect(parseCardSwipe(track1Alt)).toBe('906000004')
  })

  it('handles barcode scanner inputs with non-alphanumeric borders', () => {
    expect(parseCardSwipe('*906000005*')).toBe('906000005')
    expect(parseCardSwipe('+906000006+')).toBe('906000006')
  })
})

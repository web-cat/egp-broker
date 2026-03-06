import { describe, it, expect } from 'vitest'
import {
  parseCasXmlResponse,
  buildCasServiceUrl,
  buildCasLoginUrl
} from '@@/server/services/cas.service'

describe('CAS Service', () => {
  describe('parseCasXmlResponse', () => {
    it('parses a valid CAS 2.0 success response', () => {
      const xml = `<cas:serviceResponse xmlns:cas="http://www.yale.edu/tp/cas">
        <cas:authenticationSuccess>
          <cas:user>jdoe</cas:user>
        </cas:authenticationSuccess>
      </cas:serviceResponse>`

      const result = parseCasXmlResponse(xml)

      expect(result.username).toBe('jdoe')
      expect(result.attributes).toEqual({})
    })

    it('parses a valid CAS 3.0 success response with attributes', () => {
      const xml = `<cas:serviceResponse xmlns:cas="http://www.yale.edu/tp/cas">
        <cas:authenticationSuccess>
          <cas:user>jdoe</cas:user>
          <cas:attributes>
            <cas:email>jdoe@example.edu</cas:email>
            <cas:firstName>John</cas:firstName>
            <cas:lastName>Doe</cas:lastName>
          </cas:attributes>
        </cas:authenticationSuccess>
      </cas:serviceResponse>`

      const result = parseCasXmlResponse(xml)

      expect(result.username).toBe('jdoe')
      expect(result.attributes).toEqual({
        email: 'jdoe@example.edu',
        firstName: 'John',
        lastName: 'Doe'
      })
    })

    it('throws on authentication failure response', () => {
      const xml = `<cas:serviceResponse xmlns:cas="http://www.yale.edu/tp/cas">
        <cas:authenticationFailure code="INVALID_TICKET">
          Ticket ST-12345 not recognized
        </cas:authenticationFailure>
      </cas:serviceResponse>`

      expect(() => parseCasXmlResponse(xml)).toThrow()
    })

    it('throws on missing user in success response', () => {
      const xml = `<cas:serviceResponse xmlns:cas="http://www.yale.edu/tp/cas">
        <cas:authenticationSuccess>
        </cas:authenticationSuccess>
      </cas:serviceResponse>`

      expect(() => parseCasXmlResponse(xml)).toThrow()
    })

    it('handles empty attributes block gracefully', () => {
      const xml = `<cas:serviceResponse xmlns:cas="http://www.yale.edu/tp/cas">
        <cas:authenticationSuccess>
          <cas:user>jdoe</cas:user>
          <cas:attributes></cas:attributes>
        </cas:authenticationSuccess>
      </cas:serviceResponse>`

      const result = parseCasXmlResponse(xml)

      expect(result.username).toBe('jdoe')
      expect(result.attributes).toEqual({})
    })

    it('trims whitespace from username and attribute values', () => {
      const xml = `<cas:serviceResponse xmlns:cas="http://www.yale.edu/tp/cas">
        <cas:authenticationSuccess>
          <cas:user>  jdoe  </cas:user>
          <cas:attributes>
            <cas:email>  jdoe@example.edu  </cas:email>
          </cas:attributes>
        </cas:authenticationSuccess>
      </cas:serviceResponse>`

      const result = parseCasXmlResponse(xml)

      expect(result.username).toBe('jdoe')
      expect(result.attributes.email).toBe('jdoe@example.edu')
    })
  })

  describe('buildCasServiceUrl', () => {
    it('builds the correct service callback URL', () => {
      const url = buildCasServiceUrl('http://localhost:3000', 'server-123')
      expect(url).toBe('http://localhost:3000/api/cas/callback?serverId=server-123')
    })

    it('encodes special characters in server ID', () => {
      const url = buildCasServiceUrl('http://localhost:3000', 'server 123')
      expect(url).toBe('http://localhost:3000/api/cas/callback?serverId=server%20123')
    })
  })

  describe('buildCasLoginUrl', () => {
    it('builds the correct CAS login redirect URL', () => {
      const url = buildCasLoginUrl(
        'https://login.example.edu/cas',
        'http://localhost:3000/api/cas/callback?serverId=abc'
      )
      expect(url).toBe(
        'https://login.example.edu/cas/login?service=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fcas%2Fcallback%3FserverId%3Dabc'
      )
    })
  })
})

import prisma from '@@/lib/prisma'
import { XMLParser, XMLBuilder } from 'fast-xml-parser'
import crypto from 'crypto'

export default defineEventHandler(async (event) => {
  const bodyText = await readRawBody(event)
  if (!bodyText) throw createError({ statusCode: 400, statusMessage: 'Empty Body' })

  // 1. Parse the XML request
  const parser = new XMLParser()
  const xmlObj = parser.parse(bodyText)
  
  // Navigate the LTI POX XML structure to find the score and sourcedId
  const requestHeader = xmlObj?.imsx_POXEnvelopeRequest?.imsx_POXHeader?.imsx_POXRequestHeaderInfo
  const requestBody = xmlObj?.imsx_POXEnvelopeRequest?.imsx_POXBody?.replaceResultRequest
  
  const sourcedId = requestBody?.resultRecord?.sourcedGUID?.sourcedId
  const score = requestBody?.resultRecord?.result?.resultScore?.textString

  if (!sourcedId || score === undefined) {
    return createLtiResponse('failure', 'Missing required grade data')
  }

  // 2. Lookup the Assignment/User mapping
  // We used assignment.id as the sourcedId in the launch
  const assignment = await prisma.assignment.findUnique({
    where: { id: sourcedId },
    include: { tool: true }
  })

  if (!assignment) {
    return createLtiResponse('failure', 'Assignment not found')
  }

  /**
   * 3. OAUTH VERIFICATION (Crucial)
   * In a production environment, you would use the 'oauth-sign' library 
   * to verify the signature of the incoming header against assignment.tool.sharedSecret
   */

  console.log(`Received grade ${score} for Assignment ${sourcedId}`)

  // 4. Forward to Canvas
  // This is where you would make an outgoing POST to Canvas's actual
  // outcome service URL, which you should have stored during the initial 1.3/1.1 handshake
  
  return createLtiResponse('success', 'Grade updated successfully')
})

// Helper to generate the XML response the LTI tool expects
function createLtiResponse(status: 'success' | 'failure', message: string) {
  const builder = new XMLBuilder({ format: true })
  const response = {
    imsx_POXEnvelopeResponse: {
      '@_xmlns': 'http://www.imsglobal.org/services/ltiv1p1/xsd/imsoms_v1p0',
      imsx_POXHeader: {
        imsx_POXResponseHeaderInfo: {
          imsx_version: 'V1.0',
          imsx_messageIdentifier: Date.now(),
          imsx_statusInfo: {
            imsx_codeMajor: status,
            imsx_severity: 'status',
            imsx_description: message,
            imsx_messageRefIdentifier: '99999'
          }
        }
      },
      imsx_POXBody: {
        replaceResultResponse: {}
      }
    }
  }
  return builder.build(response)
}
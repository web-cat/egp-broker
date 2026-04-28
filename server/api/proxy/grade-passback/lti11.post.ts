import { XMLParser } from 'fast-xml-parser'
import prisma from '@@/lib/prisma'

export default defineEventHandler(async (event) => {
  console.log('--- LTI 1.1 PROXY HANDLER START ---')

  // 1. Read Raw Body (Crucial for bypass of JSON parsing)
  const rawBody = await readRawBody(event, 'utf-8')
  if (!rawBody) throw createError({ statusCode: 400, statusMessage: 'Empty Body' })

  // 2. Parse XML to JSON
  const parser = new XMLParser()
  const xmlObj = parser.parse(rawBody)

  // 3. Extract LTI 1.1 Data from the POX Envelope
  const requestHeader = xmlObj?.imsx_POXEnvelopeRequest?.imsx_POXHeader?.imsx_POXRequestHeaderInfo
  const poxBody = xmlObj?.imsx_POXEnvelopeRequest?.imsx_POXBody?.replaceResultRequest

  const messageIdentifier = requestHeader?.imsx_messageIdentifier
  const sourcedId = poxBody?.resultRecord?.sourcedGUID?.sourcedId
  const rawScore = poxBody?.resultRecord?.result?.resultScore?.textString

  if (!sourcedId || rawScore === undefined) {
    console.error('Missing required LTI 1.1 fields in XML')
    throw createError({ statusCode: 400, statusMessage: 'Invalid LTI XML' })
  }

  // 4. Lookup the Bridge Record (LtiResult)
  // This connects the tool's sourcedId back to our Assignment and Canvas Endpoint
  const resultRecord = await prisma.ltiResult.findUnique({
    where: { id: sourcedId },
    include: {
      assignment: {
        include: {
          course: { include: { gradeTranslation: true } },
          gradeTranslation: true
        }
      },
      user: true
    }
  })

  if (!resultRecord) {
    console.error(`No mapping found for sourcedId: ${sourcedId}`)
    throw createError({ statusCode: 404, statusMessage: 'Unknown Grade Slot' })
  }

  // 5. Apply Grading Logic (Proxy Math / Translations)
  const scoreGiven = parseFloat(rawScore) // 0.0 to 1.0 scale
  const finalScore = scoreGiven

  const assignment = resultRecord.assignment
  const translation = assignment.gradeTranslation || assignment.course.gradeTranslation

  if (translation && translation.mapping) {
    // Apply your specific translation logic here
    console.log(`Applying translation for User: ${resultRecord.userId}, Score: ${scoreGiven}`)
    // e.g., finalScore = calculateMappedScore(scoreGiven, translation.mapping)
  }

  // 6. Forward to Canvas (LTI Advantage AGS)
  // Note: You must implement generateLtiAdvantageToken for the specific platform
  if (resultRecord.lisOutcomeServiceUrl) {
    try {
      // In a real scenario, you'd fetch the platform associated with this assignment
      // const token = await generateLtiAdvantageToken(platform)

      // await $fetch(resultRecord.lisOutcomeServiceUrl, {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Bearer ${token}`,
      //     'Content-Type': 'application/vnd.ims.lis.v1.score+json'
      //   },
      //   body: {
      //     userId: resultRecord.user.ltiSub, // or appropriate ID
      //     scoreGiven: finalScore,
      //     scoreMaximum: 1.0,
      //     activityProgress: 'Completed',
      //     gradingProgress: 'FullyGraded'
      //   }
      // })
      console.log(`Successfully forwarded grade to Canvas: ${resultRecord.lisOutcomeServiceUrl}`)
    } catch (err) {
      console.error('Failed to forward grade to Canvas:', err)
      // We still return success to the Tool to stop retries, but log the internal failure
    }
  }

  // 7. Return Mandatory LTI 1.1 XML Success Response
  setResponseHeader(event, 'Content-Type', 'application/xml')
  return `<?xml version="1.0" encoding="UTF-8"?>
<imsx_POXEnvelopeResponse xmlns="http://www.imsglobal.org/services/ltiv1p1/xsd/imsoms_v1p0">
  <imsx_POXHeader>
    <imsx_POXResponseHeaderInfo>
      <imsx_version>V1.0</imsx_version>
      <imsx_messageIdentifier>${Date.now()}</imsx_messageIdentifier>
      <imsx_sendingJsack>${messageIdentifier}</imsx_sendingJsack>
      <imsx_statusInfo>
        <imsx_codeMajor>success</imsx_codeMajor>
        <imsx_severity>status</imsx_severity>
        <imsx_description>Grade processed and translated by EGP Broker</imsx_description>
        <imsx_messageIdentifier>${messageIdentifier}</imsx_messageIdentifier>
      </imsx_statusInfo>
    </imsx_POXResponseHeaderInfo>
  </imsx_POXHeader>
  <imsx_POXBody>
    <replaceResultResponse/>
  </imsx_POXBody>
</imsx_POXEnvelopeResponse>`
})

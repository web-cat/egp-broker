export default defineEventHandler(async (event) => {
  console.log('--- OLD GRADE PASSBACK REACHED ---')
})

// import { XMLParser } from 'fast-xml-parser'
// import prisma from '@@/lib/prisma'

// export default defineEventHandler(async (event) => {
//   console.log('--- OLD LTI 1.1 PROXY HANDLER START ---')

//   // 1. Read Raw Body as string (prevents JSON parsing errors)
//   const rawBody = await readRawBody(event, 'utf-8')
//   if (!rawBody) throw createError({ statusCode: 400, statusMessage: 'Empty Body' })

//   // 2. Parse XML to JSON object
//   const parser = new XMLParser()
//   const xmlObj = parser.parse(rawBody)

//   // 3. Extract LTI 1.1 Data
//   const requestHeader = xmlObj?.imsx_POXEnvelopeRequest?.imsx_POXHeader?.imsx_POXRequestHeaderInfo
//   const poxBody = xmlObj?.imsx_POXEnvelopeRequest?.imsx_POXBody?.replaceResultRequest

//   const messageIdentifier = requestHeader?.imsx_messageIdentifier
//   const sourcedId = poxBody?.resultRecord?.sourcedGUID?.sourcedId
//   const rawScore = poxBody?.resultRecord?.result?.resultScore?.textString

//   if (!sourcedId || rawScore === undefined) {
//     throw createError({ statusCode: 400, statusMessage: 'Invalid LTI XML' })
//   }

//   // 4. Custom Logic (Prisma & Translations)
//   const scoreGiven = parseFloat(rawScore) // LTI 1.1 is usually 0.0 to 1.0
//   const query = getQuery(event)
//   const assignmentId = query.assignmentId as string

//   // Fetch assignment to find translation rules
//   const assignment = await prisma.assignment.findUnique({
//     where: { id: assignmentId },
//     include: { course: { include: { gradeTranslation: true } }, gradeTranslation: true }
//   })

//   let finalScore = scoreGiven
//   const translation = assignment?.gradeTranslation || assignment?.course?.gradeTranslation

//   if (translation && translation.mapping) {
//     // apply your mapping logic here...
//     console.log('Applying translation for score:', scoreGiven)
//   }

//   // 5. Forwarding (Conceptual)
//   // NOTE: To forward LTI 1.1, you'd need to OAuth sign a new POST to the LMS.
//   // For now, we assume the processing logic happens here.

//   // 6. Return XML Response (Mandatory for LTI 1.1 success)
//   setResponseHeader(event, 'Content-Type', 'application/xml')
//   return `<?xml version="1.0" encoding="UTF-8"?>
// <imsx_POXEnvelopeResponse xmlns="http://www.imsglobal.org/services/ltiv1p1/xsd/imsoms_v1p0">
//   <imsx_POXHeader>
//     <imsx_POXResponseHeaderInfo>
//       <imsx_version>V1.0</imsx_version>
//       <imsx_messageIdentifier>${Date.now()}</imsx_messageIdentifier>
//       <imsx_sendingJsack>${messageIdentifier}</imsx_sendingJsack>
//       <imsx_statusInfo>
//         <imsx_codeMajor>success</imsx_codeMajor>
//         <imsx_severity>status</imsx_severity>
//         <imsx_description>Grade processed by Proxy</imsx_description>
//         <imsx_messageIdentifier>${messageIdentifier}</imsx_messageIdentifier>
//       </imsx_statusInfo>
//     </imsx_POXResponseHeaderInfo>
//   </imsx_POXHeader>
//   <imsx_POXBody><replaceResultResponse/></imsx_POXBody>
// </imsx_POXEnvelopeResponse>`
// })

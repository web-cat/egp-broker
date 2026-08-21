// import { XMLParser } from 'fast-xml-parser'
// import { SignJWT, importPKCS8 } from 'jose'
// import prisma from '@@/server/utils/db'

// export default defineEventHandler(async (event) => {
//   console.log('--- GRADE PASSBACK REACHED ---')

//   const rawBody = await readRawBody(event, 'utf-8')
//   const parser = new XMLParser()
//   const xmlObj = parser.parse(rawBody)

//   const sourcedId =
//     xmlObj?.imsx_POXEnvelopeRequest?.imsx_POXBody?.replaceResultRequest?.resultRecord?.sourcedGUID
//       ?.sourcedId
//   const rawScore =
//     xmlObj?.imsx_POXEnvelopeRequest?.imsx_POXBody?.replaceResultRequest?.resultRecord?.result
//       ?.resultScore?.textString

//   const ltiResult = await prisma.ltiResult.findUnique({
//     where: { id: sourcedId },
//     include: {
//       platform: true,
//       assignment: {
//         include: { gradeTranslation: true }
//       }
//     }
//   })

//   if (!ltiResult) throw createError({ statusCode: 404, statusMessage: 'Result not found' })

//   // 2. Apply EGP Logic using your utility
//   console.log("Grade Received: ", rawScore)
//   const translatedScore = applyGradeTranslation(
//     parseFloat(rawScore),
//     ltiResult.assignment?.gradeTranslation?.mapping
//   )
//   const maxScore = ltiResult.assignment?.gradeTranslation?.maxScore
//   console.log("Translated Score: ", translatedScore)
//   console.log("Max Score: ", maxScore)

//   // 3. Prepare Tool Credentials (from ENV)
//   const config = useRuntimeConfig(event)
//   const privateKeyPem = config.ltiPrivateKey
//   const toolKid = config.ltiKeyId

//   const { platform } = ltiResult
//   const lineItemUrl = ltiResult.lisOutcomeServiceUrl

//   if (platform && lineItemUrl && privateKeyPem) {
//     try {
//       // Import your tool's private key
//       const privateKey = await importPKCS8(privateKeyPem, 'RS256')

//       // Sign the JWT for Canvas
//       const signedJwt = await new SignJWT({})
//         .setProtectedHeader({ alg: 'RS256', kid: toolKid })
//         .setIssuer(platform.clientId)
//         .setSubject(platform.clientId)
//         .setAudience(platform.tokenEndpoint)
//         .setExpirationTime('5m')
//         .setIssuedAt()
//         .setJti(crypto.randomUUID())
//         .sign(privateKey)

//       // Get Access Token
//       const tokenResponse: any = await $fetch(platform.tokenEndpoint, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
//         body: new URLSearchParams({
//           grant_type: 'client_credentials',
//           client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
//           client_assertion: signedJwt,
//           scope: 'https://purl.imsglobal.org/spec/lti-ags/scope/score'
//         })
//       })

//       // 4. Post Score to Canvas
//       await $fetch(`${ltiResult.lisOutcomeServiceUrl}/scores`, {
//         method: 'POST',
//         headers: {
//           Authorization: `Bearer ${tokenResponse.access_token}`,
//           'Content-Type': 'application/vnd.ims.lis.v1.score+json' // Strict LTI Content-Type
//         },
//         body: {
//           userId: ltiResult.ltiSub,
//           scoreGiven: translatedScore,
//           //lti 1.3 specific fields
//           scoreMaximum: maxScore,
//           activityProgress: 'Completed',
//           gradingProgress: 'FullyGraded',
//           timestamp: new Date().toISOString()
//           //comment: "Grade managed by EGP-Broker."
//         }
//       })
//     } catch (err) {
//       console.error('Canvas Passback Error:', err)
//     }
//   } else {
//     throw createError({ statusCode: 404, statusMessage: 'Grade Passback Information Missing' })
//   }

//   console.log('Grade sent to Canvas')

//   // 5. Return XML Success to the external tool
//   setResponseHeader(event, 'Content-Type', 'application/xml')
//   return `<?xml version="1.0" encoding="UTF-8"?>
//     <imsx_POXEnvelopeResponse xmlns="http://www.imsglobal.org/services/ltiv1p1/xsd/imsoms_v1p0">
//       <imsx_POXHeader>
//         <imsx_POXResponseHeaderInfo>
//           <imsx_version>V1.0</imsx_version>
//           <imsx_statusInfo><imsx_codeMajor>success</imsx_codeMajor></imsx_statusInfo>
//         </imsx_POXResponseHeaderInfo>
//       </imsx_POXHeader>
//       <imsx_POXBody><replaceResultResponse/></imsx_POXBody>
//     </imsx_POXEnvelopeResponse>`
// })

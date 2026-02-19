// server/api/proxy/grade-passback.post.ts
import prisma from '@@/lib/prisma'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const body = await readBody(event) // This is the LIS Score JSON from the tool
  const assignmentId = query.assignmentId as string

  // 1. Fetch assignment and its global tool/platform policy
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { 
      course: { include: { deployment: { include: { platform: true } } } } 
    }
  })

  if (!assignment?.canvasAgsEndpoint) {
    throw createError({ statusCode: 404, statusMessage: 'Original Canvas endpoint not found' })
  }

  // 2. Apply the Grading Logic (Proxy Math)
  const platform = assignment.course.deployment.platform
  let finalScore = body.scoreGiven

  if (platform.modifierType === 'percent_multiplier') {
    finalScore = body.scoreGiven * (platform.modifierValue || 1)
  } else if (platform.modifierType === 'flat_bonus') {
    finalScore = body.scoreGiven + (platform.modifierValue || 0)
  }

  // Ensure we don't exceed the maximum possible score
  finalScore = Math.min(finalScore, body.scoreMaximum)

  // 3. Forward to Canvas using an LTI Advantage Token
  // Note: You must implement generateLtiAdvantageToken to sign a JWT for Canvas
  const token = await generateLtiAdvantageToken(platform)

  return await $fetch(assignment.canvasAgsEndpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/vnd.ims.lis.v1.score+json'
    },
    body: {
      ...body,
      scoreGiven: finalScore,
      comment: `${body.comment || ''} (Adjusted by EGP Broker)`.trim()
    }
  })
})
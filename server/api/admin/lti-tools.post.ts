// server/api/admin/lti-tools.post.ts
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  
  return await prisma.ltiPlatform.upsert({
    where: { issuer: body.issuer },
    update: {
      name: body.name,
      clientId: body.clientId,
      modifierType: body.modifierType,
      modifierValue: parseFloat(body.modifierValue)
    },
    create: {
      name: body.name,
      issuer: body.issuer,
      clientId: body.clientId,
      jwksEndpoint: body.jwksEndpoint,
      oidcAuthEndpoint: body.oidcAuthEndpoint,
      modifierType: body.modifierType,
      modifierValue: parseFloat(body.modifierValue)
    }
  })
})
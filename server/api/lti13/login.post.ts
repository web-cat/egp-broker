import { defineEventHandler, readValidatedBody } from 'h3'
import { LtiLoginSchema } from '@@/shared/schemas/auth.schema'

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, LtiLoginSchema.parse)

  return await initiateOidcRedirect(event, {
    iss: body.iss,
    loginHint: body.login_hint,
    targetLinkUri: body.target_link_uri,
    ltiMessageHint: body.lti_message_hint,
    clientId: body.client_id
  })
})

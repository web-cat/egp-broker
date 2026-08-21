import { defineEventHandler, getValidatedQuery } from 'h3'
import { LtiLoginSchema } from '@@/shared/schemas/auth.schema'

export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, LtiLoginSchema.parse)

  return await initiateOidcRedirect(event, {
    iss: query.iss,
    loginHint: query.login_hint,
    targetLinkUri: query.target_link_uri,
    ltiMessageHint: query.lti_message_hint,
    clientId: query.client_id
  })
})

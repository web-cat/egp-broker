export default defineEventHandler(async (event) => {
  const body = await readBody(event) //

  return await initiateOidcRedirect(event, {
    iss: body.iss as string, //
    loginHint: body.login_hint as string, //
    targetLinkUri: body.target_link_uri as string, //
    ltiMessageHint: body.lti_message_hint as string, //
    clientId: body.client_id as string //
  })
})
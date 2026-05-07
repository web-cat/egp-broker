export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  console.log('RAW QUERY PARAMS:', query)

  return await initiateOidcRedirect(event, {
    iss: query.iss as string,
    loginHint: query.login_hint as string,
    targetLinkUri: query.target_link_uri as string,
    ltiMessageHint: query.lti_message_hint as string
  })
})

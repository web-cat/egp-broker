import { defineEventHandler, getQuery } from 'h3'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const openidConfiguration = query.openid_configuration as string
  const registrationToken = query.registration_token as string

  if (openidConfiguration && registrationToken) {
    // Some platforms might use GET for the initial redirection.
    // We redirect to our POST handler or handle it here.
    // However, Nitro handles POST differently.
    // For simplicity, we'll just show a message if it's a GET without parameters,
    // or we can try to trigger the registration logic.
    // Actually, Canvas usually performs a POST to the registration endpoint.
  }

  return {
    message: 'LTI 1.3 Dynamic Registration Endpoint',
    instructions: 'This endpoint is used by LTI platforms to automatically configure the tool.'
  }
})

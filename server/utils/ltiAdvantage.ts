//import jwt from 'jsonwebtoken'

export const generateLtiAdvantageToken = async (platform: any) => {
  const payload = {
    iss: platform.clientId, // Your Client ID
    sub: platform.clientId,
    aud: platform.authTokenEndpoint, // e.g., https://canvas.instructure.com/login/oauth2/token
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60,
    jti: Math.random().toString(36).substring(7)
  }

  // Sign with your private key (stored in ENV or DB)
  //const token = jwt.sign(payload, process.env.LTI_PRIVATE_KEY!, { algorithm: 'RS256' })

  // Exchange this JWT for a Bearer Access Token from Canvas
  const response = await $fetch(platform.authTokenEndpoint, {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      //client_assertion: token,
      scope: 'https://purl.imsglobal.org/spec/lti-ags/scope/score'
    })
  })

  //return response.access_token
}

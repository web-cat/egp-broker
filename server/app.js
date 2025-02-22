require('dotenv').config()
const path = require('path')
const routes = require('./src/routes')

const lti = require('ltijs').Provider


// Setup
lti.setup(process.env.LTI_KEY,
  {
    url: 'mongodb://' + process.env.DB_HOST + '/' + process.env.DB_NAME_LTI + '?authSource=admin', // connection to mongodb
    connection: { user: process.env.DB_USER, pass: process.env.DB_PASS }
  }, {
  staticPath: path.join(__dirname, './public'), // Path to static files
  cookies: {
    secure: true, // Set secure to true if the testing platform is in a different domain and https is being used
    sameSite: 'None' // Set sameSite to 'None' if the testing platform is in a different domain and https is being used
  },
  devMode: false, // Set DevMode to true if the testing platform is in a different domain and https is not being used
  // dynReg: {
  //   url: 'https://one-sunbeam-distinctly.ngrok-free.app', // Tool Provider URL. Required field.
  //   name: 'lti-test', // Tool Provider name. Required field.
  //   logo: '', // Tool Provider logo URL.
  //   description: 'Tool Description', // Tool Provider description.
  //   redirectUris: ['https://one-sunbeam-distinctly.ngrok-free.app', 'https://one-sunbeam-distinctly.ngrok-free.app/keys'], // Additional redirection URLs. The main URL is added by default.
  //   customParameters: { 
  //     "scopes": [
  //       "https://purl.imsglobal.org/spec/lti-ags/scope/lineitem",
  //       "https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly",
  //       "https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly",
  //       "https://purl.imsglobal.org/spec/lti-ags/scope/score",
  //       "https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly",
  //       "https://canvas.instructure.com/lti/public_jwk/scope/update",
  //       "https://canvas.instructure.com/lti/account_lookup/scope/show",
  //       "https://canvas.instructure.com/lti-ags/progress/scope/show",
  //       "https://canvas.instructure.com/lti/page_content/show"
  //   ],
  //   "extensions": [
  //       {
  //           "platform": "canvas.instructure.com",
  //           "settings": {
  //               "platform": "canvas.instructure.com",
  //               "placements": [
  //                   {
  //                       "placement": "course_navigation",
  //                       "message_type": "LtiResourceLinkRequest",
  //                       "target_link_uri": "https://one-sunbeam-distinctly.ngrok-free.app"
  //                   }
  //               ]
  //           },
  //           "privacy_level": "public"
  //       }
  //   ],
  //   "public_jwk_url": "https://one-sunbeam-distinctly.ngrok-free.app/keys",
  //   "target_link_uri": "https://one-sunbeam-distinctly.ngrok-free.app",
  //   "oidc_initiation_url": "https://one-sunbeam-distinctly.ngrok-free.app/login"
  //   }, // Custom parameters.
  //   autoActivate: true // Whether or not dynamically registered Platforms should be automatically activated. Defaults to false.
  // }
})

// When receiving successful LTI launch redirects to app
lti.onConnect(async (token, req, res) => {
  console.log('token:', token)
  console.log('context:', res.locals.context)
  return res.sendFile(path.join(__dirname, './public/index.html'))
})

// When receiving deep linking request redirects to deep screen
lti.onDeepLinking(async (token, req, res) => {
  return lti.redirect(res, '/deeplink', { newResource: true })
})

// Setting up routes
lti.app.use(routes)

lti.whitelist('/api/student', '/api/instructor', '/api/course/lti_course_2/stats')

// Setup function
const setup = async () => {
  await lti.deploy({ port: process.env.PORT })

  /**
   * Register platform
   */
  await lti.registerPlatform({
    url: process.env.CANVAS_URL, // or url : 'https://canvas.exampledomain.com' (depends on config form Canvas instance) if iss is changed in config/security.yml file! It must be the same as the iss
    name: process.env.CANVAS_NAME, // domain name from canvas instance
    clientId: process.env.CANVAS_CLIENT_ID, // clientid from the lti plugin which you get inside canvas after installing the plugin
    authenticationEndpoint: process.env.CANVAS_AUTH_ENDPOINT,
    accesstokenEndpoint: process.env.CANVAS_ACCESS_TOKEN_ENDPOINT,
    authConfig: { method: 'JWK_SET', key: process.env.CANVAS_JWK_URL }
  })
}

setup()

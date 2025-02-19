// Express + Next JS server combination - server.js
const express = require("express");
const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

const server = express();

server.get("/api/myapi", (req, res) => {
  res.json({ msg: "This is a response returned by your express application using Express.js server" });
});

server.get("*", (req, res) => {
  return handle(req, res);
});

app.prepare().then(() => {
  // Start listening to the Express.js Server
  server.listen(3000, (err) => {
    if (err) throw err;
    console.log("Express Server running on http://localhost:3000");
  });
});



// require('dotenv').config()
// const path = require('path')
// const lti = require('ltijs').Provider


// // Setup
// lti.setup(process.env.LTI_KEY,
//   {
//     url: 'mongodb://' + process.env.DB_HOST + '/' + process.env.DB_NAME + '?authSource=admin', // connection to mongodb
//     connection: { user: process.env.DB_USER, pass: process.env.DB_PASS }
//   }, {
//   staticPath: path.join(__dirname, './public'), // Path to static files
//   cookies: {
//     secure: true, // Set secure to true if the testing platform is in a different domain and https is being used
//     sameSite: 'None' // Set sameSite to 'None' if the testing platform is in a different domain and https is being used
//   },
//   devMode: false // Set DevMode to true if the testing platform is in a different domain and https is not being used
// })

// // When receiving successful LTI launch redirects to app
// lti.onConnect(async (token, req, res) => {
//   // Store user data in session
//   const idToken = res.locals.token;
//   const userData = {
//       name: idToken.name,
//       email: idToken.email,
//       canvasUserId: idToken.sub,  // Unique Canvas user ID
//       courseId: idToken["https://purl.imsglobal.org/spec/lti/claim/context"],  // Course ID
//       roles: idToken["https://purl.imsglobal.org/spec/lti/claim/roles"],  // User roles
//   };

//   // Store in session or database
//   // req.session.user = userData;


//   const result  = await lti.Grade.getLineItems(res.locals.token)
//   console.log('**************************');
//   console.log('line Item:', result);

//   const idtoken = res.locals.token // IdToken
//   // const response = await lti.Grade.getScores(idtoken, idtoken.platformContext.endpoint.lineitem, { userId: idtoken.user })
//   // console.log('**************************');
//   // console.log('grades:', response);

//   return res.sendFile(path.join(__dirname, './public/index.html'))
// })

// // When receiving deep linking request redirects to deep screen
// lti.onDeepLinking(async (token, req, res) => {
//   return lti.redirect(res, '/deeplink', { newResource: true })
// })

// // Setting up routes
// lti.app.use(routes)

// // Setup function
// const setup = async () => {
//   await lti.deploy({ port: process.env.PORT })

//   /**
//    * Register platform
//    */
//   await lti.registerPlatform({
//     url: process.env.CANVAS_URL, // or url : 'https://canvas.exampledomain.com' (depends on config form Canvas instance) if iss is changed in config/security.yml file! It must be the same as the iss
//     name: process.env.CANVAS_NAME, // domain name from canvas instance
//     clientId: process.env.CANVAS_CLIENT_ID, // clientid from the lti plugin which you get inside canvas after installing the plugin
//     authenticationEndpoint: process.env.CANVAS_AUTH_ENDPOINT,
//     accesstokenEndpoint: process.env.CANVAS_ACCESS_TOKEN_ENDPOINT,
//     authConfig: { method: 'JWK_SET', key: process.env.CANVAS_JWK_URL }
//   })
// }

// setup()

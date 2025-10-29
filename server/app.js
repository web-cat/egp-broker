require("dotenv").config();
const path = require("path");
const routes = require("./src/routes");
const { getRole } = require("./src/controllers/ltiController");
const {
  getOrAddInstructor,
} = require("./src/controllers/instructorController");
const { getOrAddStudent } = require("./src/controllers/studnetControllers");
const { getCourse } = require("./src/controllers/courseControllers");
const {
  getOrAddEnrollment,
} = require("./src/controllers/enrollmentControllers");

const lti = require("ltijs").Provider;
const session = require('express-session');
const passport = require('./src/config/passport');

// Setup
lti.setup(
  process.env.LTI_KEY,
  {
    url:
      "mongodb://" +
      process.env.DB_HOST +
      "/" +
      process.env.DB_NAME_LTI +
      "?authSource=admin", // connection to mongodb
    connection: { user: process.env.DB_USER, pass: process.env.DB_PASS },
  },
  {
    staticPath: path.join(__dirname, "./public"), // Path to static files
    cookies: {
      secure: true, // Set secure to true if the testing platform is in a different domain and https is being used
      sameSite: "None", // Set sameSite to 'None' if the testing platform is in a different domain and https is being used
    },
    devMode: true, // Set DevMode to true if the testing platform is in a different domain and https is not being used
  }
);

// When receiving successful LTI launch redirects to app
lti.onConnect(async (token, req, res) => {
  context = res.locals.context;
  console.log("token:", token);
  console.log("context:", context);
  console.log("Course ID from LTI context:", context.custom.canvas_course_id);
  console.log("User ID from LTI context:", context.custom.canvas_user_id);

  const role = getRole(context.roles);
  const course = await getCourse(context.custom.canvas_course_id);

  if (role == "Instructor") {
    const instructor = await getOrAddInstructor(
      context.custom.canvas_user_id,
      token.userInfo.given_name,
      token.userInfo.family_name,
      token.userInfo.email
    );

    if (course == null) {
      return res.sendFile(path.join(__dirname, "./public/register.html"));
    }
  } else if (role == "Learner") {
    const student = await getOrAddStudent(
      context.custom.canvas_user_id,
      token.userInfo.given_name,
      token.userInfo.family_name,
      token.userInfo.email
    );

    if (course == null) {
      return res.sendFile(path.join(__dirname, "./public/notset.html"));
    }

    // enroll student in course
    console.log("Enrolling student:", context.custom.canvas_user_id, "in course:", context.custom.canvas_course_id);
    studentEnrollment = await getOrAddEnrollment(
      context.custom.canvas_user_id,
      context.custom.canvas_course_id
    );
    console.log("Enrollment result:", studentEnrollment ? "SUCCESS" : "FAILED");
  } else {
    return res.sendFile(path.join(__dirname, "./public/notset.html"));
  }

  return res.sendFile(path.join(__dirname, "./public/index.html"));
});

// When receiving deep linking request redirects to deep screen
lti.onDeepLinking(async (token, req, res) => {
  return lti.redirect(res, "/deeplink", { newResource: true });
});

// lti.onDynamicRegistration(async (req, res, next) => {
//   try {
//     console.log("Dynamic Registration request received.");
//     console.log("req:", req);

//     // Default Canvas openid_configuration if missing
//     const openidConfig =
//       req.query.openid_configuration ||
//       "https://canvas.instructure.com/api/lti/security/openid-configuration";
//     const registrationToken = req.query.registration_token;

//     if (!openidConfig) {
//       return res.status(400).send({
//         status: 400,
//         error: "Bad Request",
//         details: { message: 'Missing parameter: "openid_configuration".' },
//       });
//     }

//     const message = await lti.DynamicRegistration.register(
//       openidConfig,
//       registrationToken
//     );
//     res.setHeader("Content-type", "text/html");
//     res.send(message);
//   } catch (err) {
//     if (err.message === "PLATFORM_ALREADY_REGISTERED") {
//       return res.status(403).send({
//         status: 403,
//         error: "Forbidden",
//         details: { message: "Platform already registered." },
//       });
//     }
//     return res.status(500).send({
//       status: 500,
//       error: "Internal Server Error",
//       details: { message: err.message },
//     });
//   }
// });

// Add session middleware
lti.app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Initialize passport
lti.app.use(passport.initialize());
lti.app.use(passport.session());

lti.app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, './public/index.html'));
});
// Setting up routes
lti.app.use(routes);

// Setting up routes
lti.app.use(routes);

lti.whitelist(
  // Whitelist lti_key_config files from lti auth
  '/lti/lti_key_config_prod.json', '/lti/lti_key_config_dev.json',
  // Whitelist tool routes from lti auth
  '/api/tool/student_passes', '/api/tool/redeem_pass',
    '/auth/signup', '/auth/login', '/auth/session-info', '/dashboard'
);

// Setup function
const setup = async () => {
  await lti.deploy({ port: process.env.PORT });

  // Register platform
  await lti.registerPlatform({
    url: process.env.CANVAS_URL, // or url : 'https://canvas.exampledomain.com' (depends on config form Canvas instance) if iss is changed in config/security.yml file! It must be the same as the iss
    name: process.env.CANVAS_NAME, // domain name from canvas instance
    clientId: process.env.CANVAS_CLIENT_ID, // clientid from the lti plugin which you get inside canvas after installing the plugin
    authenticationEndpoint: process.env.CANVAS_AUTH_ENDPOINT,
    accesstokenEndpoint: process.env.CANVAS_ACCESS_TOKEN_ENDPOINT,
    authConfig: { method: "JWK_SET", key: process.env.CANVAS_JWK_URL },
  });
};

setup();

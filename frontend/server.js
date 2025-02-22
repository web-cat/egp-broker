require("dotenv").config();
const express = require("express");
const next = require("next");
const path = require("path");
const lti = require("ltijs").Provider;
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

// ✅ Setup LTI.js Provider
lti.setup(
  process.env.LTI_KEY,
  {
    url: `mongodb://${process.env.DB_HOST}/${process.env.DB_NAME}?authSource=admin`,
    connection: { user: process.env.DB_USER, pass: process.env.DB_PASS },
  },
  //   { appRoute: '/lti'},
  {
    staticPath: path.join(__dirname, "./public"),
    cookies: {
      secure: true,
      sameSite: "None",
    },
    devMode: false,
  }
);

// ✅ Handle LTI Launch
lti.onConnect(async (token, req, res) => {
  try {
    const idToken = res.locals.token;

    // 🔒 Generate a JWT for session management
    const authToken = jwt.sign(idToken, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    // ✅ Store JWT in a Secure Cookie
    res.cookie("auth", authToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // Only set to true in production
      sameSite: "None", // Crucial for cross-site cookie handling
      path: "/", // Ensure the cookie is accessible globally
    });

    // Log cookie setting (for debugging)
    console.log("Cookie Set:", res.getHeader("Set-Cookie"));

    console.log("🔹 LTI Launch Successful:", idToken);

    // ✅ Redirect to Next.js Dashboard
    return lti.redirect(res, "/dashboard");
  } catch (error) {
    console.error("❌ LTI Launch Error:", error);
    return res.status(500).send("LTI Launch Failed");
  }
});

// ✅ Handle Deep Linking
lti.onDeepLinking(async (token, req, res) => {
  return lti.redirect(res, "/deeplink", { newResource: true });
});

// ✅ API Endpoint Example
lti.app.get("/api/myapi", (req, res) => {
  res.json({ msg: "This is a response from your Express server" });
});

// ✅ Verify JWT Session for Protected Routes
lti.app.get("/api/auth", (req, res) => {
  const { auth } = req.cookies;
  if (!auth) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const decoded = jwt.verify(auth, process.env.JWT_SECRET);
    return res.json({ user: decoded });
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
});

lti.app.get("/info", async (req, res) => {
  const token = res.locals.token;
  const context = res.locals.context;

  console.log("🔹 User Info:", token);

  const info = {};
  if (token.userInfo) {
    if (token.userInfo.name) info.name = token.userInfo.name;
    if (token.userInfo.email) info.email = token.userInfo.email;
  }

  if (context.roles) info.roles = context.roles;
  if (context.context) info.context = context.context;

  return res.send(info);
});

// ✅ Next.js Request Handler
lti.app.all("/dashboard", (req, res) => {
  return handle(req, res);
});

// ✅ Deploy LTI and Start Server
const setup = async () => {
  await app.prepare();
  await lti.deploy(); // Attach LTI to Express Server

  // ✅ Register Platform
  await lti.registerPlatform({
    url: process.env.CANVAS_URL,
    name: process.env.CANVAS_NAME,
    clientId: process.env.CANVAS_CLIENT_ID,
    authenticationEndpoint: process.env.CANVAS_AUTH_ENDPOINT,
    accesstokenEndpoint: process.env.CANVAS_ACCESS_TOKEN_ENDPOINT,
    authConfig: { method: "JWK_SET", key: process.env.CANVAS_JWK_URL },
  });
};

setup();

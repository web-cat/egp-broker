const lti = require('ltijs').Provider;
const path = require('path');
const config = require('../config/config');

lti.setup(config.lti.key, {
  url: config.mongo.uri,
  connection: { user: config.db.user, pass: config.db.pass }
}, {
  staticPath: path.join(__dirname, '../public'),
  cookies: { secure: false, sameSite: '' },
  devMode: true
});

lti.onConnect(async (token, req, res) => {
  return res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

lti.onDeepLinking(async (token, req, res) => {
  return lti.redirect(res, '/deeplink', { newResource: true });
});

const registerPlatform = async () => {
  let resgistration = await lti.registerPlatform({
    url: 'https://canvas.instructure.com', // Replace with your Canvas instance URL
    name: 'Canvas',
    clientId: config.lti.clientId, // Replace with your Client ID
    authenticationEndpoint: 'https://canvas.instructure.com/api/lti/authorize_redirect',
    accesstokenEndpoint: 'https://canvas.instructure.com/login/oauth2/token',
    authConfig: {
      method: 'JWK_SET',
      key: 'https://canvas.instructure.com/api/lti/security/jwks'
    }
  });

  return resgistration;
};

module.exports = { lti, registerPlatform };

const bcrypt = require('bcryptjs');
const { User, Client, Token } = require('./models');

module.exports = {
  getAccessToken: async function(bearerToken) {
    console.log('Getting access token:', bearerToken);
    const token = await Token.findOne({ accessToken: bearerToken });
    if (!token) {
      console.log('Access token not found');
      return null;
    }
    console.log('Access token found:', token);
    const client = await Client.findOne({ clientId: token.clientId });
    if (!client) {
      console.log('Client not found');
      return null;
    }
    console.log('Client found:', client);
    const user = await User.findById(token.userId);
    if (!user) {
      console.log('User not found');
      return null;
    }
    console.log('User found:', user);
    return {
      accessToken: token.accessToken,
      accessTokenExpiresAt: token.accessTokenExpiresAt,
      client: client.toObject(),
      user: user.toObject()
    };
  },

  getClient: async function(clientId, clientSecret) {
    console.log('Getting client:', clientId, clientSecret);
    const client = await Client.findOne({ clientId, clientSecret });
    if (client) {
      console.log('Client found:', client);
    } else {
      console.log('Client not found');
    }
    return client ? client.toObject() : null;
  },

  saveToken: async function(token, client, user) {
    console.log('Saving token:', token);
    const accessToken = await Token.create({
      accessToken: token.accessToken,
      accessTokenExpiresAt: token.accessTokenExpiresAt,
      refreshToken: token.refreshToken,
      refreshTokenExpiresAt: token.refreshTokenExpiresAt,
      scope: token.scope,
      clientId: client.clientId,
      userId: user._id // Ensure user ID is stored correctly
    });
    console.log('Token saved:', accessToken);
    
    return {
      accessToken: accessToken.accessToken,
      accessTokenExpiresAt: accessToken.accessTokenExpiresAt,
      refreshToken: accessToken.refreshToken,
      refreshTokenExpiresAt: accessToken.refreshTokenExpiresAt,
      client: { id: client.clientId },
      user: { id: user._id }
    };
  },

  getUser: async function(username, password) {
    console.log('Getting user:', username);
    const user = await User.findOne({ email: username });
    if (!user) {
      console.log('User not found');
      return null;
    }
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      console.log('Invalid password');
      return null;
    }
    console.log('User authenticated:', user);
    return user.toObject();
  }
};

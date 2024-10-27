const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const bcrypt = require('bcryptjs');
const { default: axios } = require('axios');

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(require('../config/firebase-config.json')),
});

// Function to generate random password
function generateRandomPassword(length = 12) {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let password = "";
  for (let i = 0, n = charset.length; i < length; ++i) {
      password += charset.charAt(Math.floor(Math.random() * n));
  }
  return password;
}

async function exchangeCodeForTokens(code) {
  const tokenUrl = 'https://oauth2.googleapis.com/token';
  const clientId = '100242208777601786922'; // Replace with your Google Client ID
  const clientSecret = 'YOUR_GOOGLE_CLIENT_SECRET'; // Replace with your Google Client Secret
  const redirectUri = 'YOUR_REDIRECT_URI'; // Must match the one used in your frontend

  const response = await axios.post(tokenUrl, {
    code: code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  return response.data; // Contains access_token, id_token, refresh_token, etc.
}
// Route to handle session validation and user login/signup
router.post('/session', async (req, res) => {
  try {

    const { code } = req.body; // Get authorization code from the frontend

    if (!code) {
      return res.status(400).json({ msg: 'Authorization code is required' });
    }

    // Exchange authorization code for tokens
    const tokens = await exchangeCodeForTokens(code);
    console.log(tokens); //
   const idToken = tokens.id_token; // Get the ID token from the response


    // Verify Firebase ID Token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { uid, email, name } = decodedToken;
    
    if (!email) {
      return res.status(400).json({ msg: 'No email associated with the Google account' });
    }

    // Check if the user exists in your app's database
    let existingUser = await User.findOne({ email });

    if (existingUser) {
      // User exists, generate a token for them
      const payload = {
        user: {
          id: existingUser._id,
        },
      };
      const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

      // Calculate expiration time
      const expiresAt = new Date(Date.now() + 3600000); // 1 hour from now

      // Save the token and expiration time in the user's session array
      existingUser.sessions.push({ token, expiresAt });
      await existingUser.save();

      // Check if the user is active
      if (!existingUser.active) {
        return res.status(200).json({ msg: 'User is inactive', active: false });
      }

      // Respond with the token
      return res.status(200).json({ token, message: "Your session is valid for the next 1 hour" });
    } else {
      // User does not exist in your app's database, create a new one
      const firstName = name.split(' ')[0] || '';
      const lastName = name.split(' ')[1] || '';
      const username = `jodloo_${firstName.toLowerCase()}${lastName.toLowerCase()}`.replace(/\s+/g, '');
      const password = generateRandomPassword();

      // Create the new user
      let newUser = new User({
        fullName: name,
        email,
        username,
        password
      });

      // Hash the password
      const salt = await bcrypt.genSalt(10);
      newUser.password = await bcrypt.hash(password, salt);

      // Save the new user
      await newUser.save();

      // Generate token for the new user
      const payload = {
        user: {
          id: newUser._id,
        },
      };
      const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

      // Calculate expiration time
      const expiresAt = new Date(Date.now() + 3600000); // 1 hour from now

      // Save the token and expiration time in the user's session array
      newUser.sessions.push({ token, expiresAt });
      await newUser.save();

      // Respond with the token
      return res.status(200).json({ token, message: "Your session is valid for the next 1 hour" });
    }

  } catch (error) {
    console.error('Error during authentication:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;

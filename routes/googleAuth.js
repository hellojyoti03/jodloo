const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const router = express.Router();

// Replace with your actual values
const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const redirectUri = process.env.GOOGLE_REDIRECT_URI;

const oAuth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);

router.get('/auth', (req, res) => {
    // The scopes you need access to
    const scopes = [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
    ];

    // Generate the url that will be used for the consent dialog
    const authorizeUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'consent', // Forces the consent screen to be displayed every time
    });

    // Send the Google OAuth URL to the client
    res.status(200).json({ authUrl: authorizeUrl });
});

router.get('/callback', async (req, res) => {
    const code = req.query.code;

    try {
        // Exchange authorization code for access token
        const { tokens } = await oAuth2Client.getToken(code);
        oAuth2Client.setCredentials(tokens);

        // You can send the tokens or a success message back to the frontend
        res.status(200).send('<html><body><script>window.close();</script></body></html>');
    } catch (error) {
        console.error('Error exchanging code for token:', error);
        res.status(500).json({ msg: 'Authentication failed' });
    }
});
module.exports = router;

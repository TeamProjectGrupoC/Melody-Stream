const { onRequest } = require("firebase-functions/v2/https");
const axios = require("axios");
const cors = require("cors")({ origin: true });

exports.getSpotifyToken = onRequest((req, res) => {
  cors(req, res, async () => {
    const code = req.query.code;
    if (!code) {
      return res.status(400).json({ error: "Missing authorization code" });
    }

    const functions = require("firebase-functions");

    const clientId = functions.config().spotify.client_id;
    const clientSecret = functions.config().spotify.client_secret;
    const redirectUri = functions.config().spotify.redirect_uri;
    
    try {
      const response = await axios.post(
        "https://accounts.spotify.com/api/token",
        new URLSearchParams({
          grant_type: "authorization_code",
          code: code,
          redirect_uri: redirectUri,
          client_id: clientId,
          client_secret: clientSecret,
        }).toString(),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );

      res.set("Access-Control-Allow-Origin", "*");
      res.json(response.data);
    } catch (error) {
      console.error("Spotify API error:", error.response?.data || error.message);
      res.status(500).json({ error: error.response?.data || error.message });
    }
  });
});

const { onDocumentWritten } = require("firebase-functions/v2/database");
const admin = require("firebase-admin");

admin.initializeApp();

exports.checkSpotifyPremium = functions.https.onRequest(async (req, res) => {
    const accessToken = req.query.accessToken || req.body.accessToken;

    if (!accessToken) {
        return res.status(400).json({ error: "Access token missing" });
    }

    try {
        const response = await fetch("https://api.spotify.com/v1/me", {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        const data = await response.json();

        res.json({ premium: data.product === "premium" });
    } catch (err) {
        console.error("Error checking premium:", err);
        res.status(500).json({ error: "Failed to check premium" });
    }
});
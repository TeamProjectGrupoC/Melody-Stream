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

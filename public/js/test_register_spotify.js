// --- IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

// --- FIREBASE CONFIG ---
const firebaseConfig = {
  apiKey: "AIzaSyCCWExxM4ACcvnidBWMfBQ_CJk7KimIkns",
  authDomain: "melodystream123.firebaseapp.com",
  databaseURL: "https://melodystream123-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "melodystream123",
  storageBucket: "melodystream123.firebasestorage.app",
  messagingSenderId: "640160988809",
  appId: "1:640160988809:web:d0995d302123ccf0431058",
  measurementId: "G-J97KEDLYMB"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Spotify config
const clientId = "bec926b86f644a3f976bddd2364f69d8"; 
const redirectUri = "https://melodystream123.web.app/test_spotify.html";
const scopes = "user-read-private user-read-email streaming user-read-playback-state user-modify-playback-state";

// Elements
const spotifyBtn = document.getElementById("spotifyLogin");
const msgDiv = document.getElementById("spotifyMsg"); // Add a <div id="spotifyMsg"></div> in HTML
const titleSpotify = document.getElementById("title_spotify");

async function updateSpotifyButton() {
  const savedToken = localStorage.getItem("spotify_access_token");
  
  if (!spotifyBtn) return;

  if (savedToken) {
    // Validar token
    const res = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${savedToken}` },
    });

    if (res.ok) {
      spotifyBtn.textContent = "Continue with Spotify";
      spotifyBtn.disabled = false;
      spotifyBtn.style.opacity = "1";
      spotifyBtn.style.cursor = "pointer";
      titleSpotify.textContent = "Welcome back! Continue with your Spotify account.";
      return;
    } else {
      // Token inválido → borrar
      localStorage.removeItem("spotify_access_token");

      spotifyBtn.textContent = "Login with Spotify";
      spotifyBtn.disabled = false;
      spotifyBtn.style.opacity = "1";
      spotifyBtn.style.cursor = "pointer";
      titleSpotify.textContent = "Login with Spotify";
    }
  }
}


// Detect Firebase login state
onAuthStateChanged(auth, (user) => {
  if (!user) {
    // User NOT logged in → disable Spotify button
    spotifyBtn.disabled = true;
    spotifyBtn.style.opacity = "0.5";
    spotifyBtn.style.cursor = "not-allowed";

    if (msgDiv) msgDiv.textContent = "You must be logged in to connect your Spotify account.";
    return;
  }
  if (msgDiv) msgDiv.textContent = ""; // clear message
  // User logged in → revisar token
  updateSpotifyButton();
});

// Button event
spotifyBtn.addEventListener("click", () => {
  if (spotifyBtn.disabled) return; // Safety check

  const authUrl = 
    `https://accounts.spotify.com/authorize?client_id=${clientId}` +
    `&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(scopes)}`;

  window.location.href = authUrl;
});

// Navigation
document.getElementById("musicLibrary")?.addEventListener("click", function() {
  window.location.href = "musiclibrary.html";
});

document.getElementById('volverhome')?.addEventListener('click', function() {
  window.location.href = "index.html"; 
});

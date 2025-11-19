/***********************
 *  PARAMS + TOKEN
 ***********************/
const params = new URLSearchParams(window.location.search);
const code = params.get("code");

let accessToken = null;
let isPremium = false;
let deviceId = null; // For Web Playback SDK (premium)
let userName = null;
let userEmail = null;

/***********************
 *  1. OBTENER TOKEN
 ***********************/
async function getToken() {
  if (!code) {
    document.getElementById("trackInfo").innerHTML =
      "<p>Code not found. Try logging in again.</p>";
    return;
  }
  console.log("pasa1");
  try {
    const res = await fetch(
      `https://us-central1-melodystream123.cloudfunctions.net/getSpotifyToken?code=${code}`
    );
    const data = await res.json();

    if (!data.access_token) {
      document.getElementById("trackInfo").innerHTML =
        "<p>Error getting token.</p>";
      return;
    }

    accessToken = data.access_token;

    // Check user type (premium or not)
    await getUserProfile();

    displayUserStatus();
    // If premium : initialize Web Playback SDK
    if (isPremium) loadWebPlaybackSDK();
  } catch (err) {
    console.error(err);
    document.getElementById("trackInfo").innerHTML =
      "<p>Error getting the token.</p>";
  }
}

/***********************
 *  2. GET INFO OF THE USER
 ***********************/

async function getUserProfile() {
  try {
    const res = await fetch("https://api.spotify.com/v1/me", { // El mismo endpoint que antes usabas para /me
      headers: { Authorization: "Bearer " + accessToken },
    });

    const data = await res.json();
    
    // Almacenar los datos que necesitamos
    isPremium = data.product === "premium";
    userName = data.display_name;
    userEmail = data.email; 

  } catch (err) {
    console.error("Error checking user profile", err);
  }
}

/***********************
 *  2. CHECK THE STATUS OF THE USER
 ***********************/
/*async function checkUserProduct() {
  try {
    const res = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: "Bearer " + accessToken },
    });

    const data = await res.json();
    isPremium = data.product === "premium";
  } catch (err) {
    console.error("Error checking user product", err);
  }
}

/***********************
 *  3. WEB PLAYBACK SDK (premium)
 ***********************/
function loadWebPlaybackSDK() {
  const script = document.createElement("script");
  script.src = "https://sdk.scdn.co/spotify-player.js";
  document.body.appendChild(script);

  window.onSpotifyWebPlaybackSDKReady = () => {
    const player = new Spotify.Player({
      name: "MelodyStream Player",
      getOAuthToken: (cb) => cb(accessToken),
      volume: 0.8,
    });

    // Obtener device_id
    player.addListener("ready", ({ device_id }) => {
      console.log("Device ready:", device_id);
      deviceId = device_id;
    });

    player.connect();
  };
}

/***********************
 *  4. SEARCH 5 SONGS
 ***********************/
async function searchTrack() {
  const query = document.getElementById("searchInput").value.trim();
  if (!query) return alert("Type a song name");
  if (!accessToken) return alert("Token not available.");

  try {
    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(
        query
      )}&type=track&limit=5`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const data = await res.json();
    const tracks = data.tracks?.items;

    if (!tracks || tracks.length === 0) {
      document.getElementById("trackInfo").innerHTML = "<p>No songs found.</p>";
      return;
    }

    // Render the list
    document.getElementById("trackInfo").innerHTML = tracks
      .map(
        (track, i) => `
      <div style="border:1px solid #ccc; padding:10px; margin:10px;">
        <h3>${track.name}</h3>
        <p>${track.artists[0].name}</p>
        <img src="${track.album.images[0].url}" width="120">
        <br><br>
        <button onclick="playTrack('${track.uri}', '${track.preview_url}')">
          ▶ Play
        </button>
      </div>
    `
      )
      .join("");
  } catch (err) {
    console.error(err);
    document.getElementById("trackInfo").innerHTML =
      "<p>Error searching for songs.</p>";
  }
}

/***********************
 *  5. Reproduce song
 ***********************/
async function playTrack(uri, previewUrl) {
  if (!isPremium) {
    // USERS NOT PREMIUM : use preview_url
    if (!previewUrl) {
      alert("No preview available.");
      return;
    }

    const audio = new Audio(previewUrl);
    audio.play();
    return;
  }

  // PREMIUM : COMPLETE PLAYBACK 
  if (!deviceId) {
    alert("Player not ready yet. Try again.");
    return;
  }

  try {
    await fetch(
      `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uris: [uri],
        }),
      }
    );

    console.log("Playing full track on Premium device.");
  } catch (err) {
    console.error("Error playing track", err);
  }
}

/***********************
 * SHOW STATUS
 ***********************/
function displayUserStatus() {
  const statusDiv = document.getElementById("userStatus");
  let message = "";
  let color = "";
  
  // Usamos el email si está disponible, si no, el nombre
  const userIdentifier = userEmail || userName || "Usuario Desconocido";

  if (isPremium) {
    message = `✅ Conectado como: **${userIdentifier}**. Eres Spotify Premium: Reproducción completa activada.`;
    color = "#4CAF50"; 
  } else {
    message = `❌ Conectado como: **${userIdentifier}**. Eres Spotify Free: Solo disponible la previsualización (30s).`;
    color = "#FF9800"; 
  }

  statusDiv.innerHTML = message;
  statusDiv.style.backgroundColor = color;
  statusDiv.style.color = "white";
  statusDiv.style.padding = "10px"; // Aseguramos el padding
}

/***********************
 *  EVENTS
 ***********************/
document.getElementById("searchBtn").addEventListener("click", searchTrack);

// Start getting token
console.log("funciona1");
getToken();
console.log("funciona1");


// Exponer funciones al scope global
window.playTrack = playTrack;
window.searchTrack = searchTrack;

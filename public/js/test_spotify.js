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
          <img src="${track.album.images[0].url}" alt="Album Art" style="width: 100px; height: 100px;">
          <h2>${i + 1}. ${track.name}</h2>
          <p>Artista: ${track.artists.map((artist) => artist.name).join(", ")}</p>
          <p>Álbum: ${track.album.name}</p>
          
          ${isPremium ? 
            // Si es Premium, se muestra el botón.
            `<button onclick="playTrack('${track.uri}')">
              ▶ Reproducir Canción Completa
            </button>`
            : 
            // Si no es Premium, no se muestra nada de reproducción (ni preview, ni error).
            ''
          }
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
async function playTrack(uri) {
  // Si no es Premium, simplemente salimos de la función sin hacer nada.
  if (!isPremium) {
    console.warn("Intento de reproducción bloqueado. Se requiere cuenta Premium.");
    alert("Para reproducir la canción completa, necesitas una cuenta Spotify Premium y que tu aplicación esté autorizada.");
    return;
  }

  // PREMIUM : COMPLETE PLAYBACK 
  if (!deviceId) {
    alert("El reproductor web aún no está listo. Inténtalo de nuevo en unos segundos.");
    return;
  }

  try {
    // Usando el endpoint /v1/me/player/play
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
    console.error("Error playing full track:", err);
  }
}

/***********************
 * SHOW STATUS
 ***********************/
function displayUserStatus() {
  const statusDiv = document.getElementById("userStatus");
  let message = "";
  let color = "";
  
  const userIdentifier = userEmail || userName || "Usuario Desconocido";

  if (isPremium) {
    message = `✅ Conectado como: **${userIdentifier}**. Eres Spotify Premium: Reproducción de canción completa activada.`;
    color = "#4CAF50"; 
  } else {
    // Mensaje para usuarios Free, sin mencionar previews
    message = `❌ Conectado como: **${userIdentifier}**. Eres Spotify Free: La reproducción de música no está disponible.`;
    color = "#FF9800"; 
  }

  statusDiv.innerHTML = message;
  statusDiv.style.backgroundColor = color;
  statusDiv.style.color = "white";
  statusDiv.style.padding = "10px";
}
/***********************
 *  EVENTS
 ***********************/
document.getElementById("searchBtn").addEventListener("click", searchTrack);

// Start getting token
getToken();


// Exponer funciones al scope global
window.playTrack = playTrack;
window.searchTrack = searchTrack;

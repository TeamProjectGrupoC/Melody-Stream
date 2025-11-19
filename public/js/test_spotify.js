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
 *  1. OBTAIN TOKEN
 ***********************/
async function getToken() {
  if (!code) {
    document.getElementById("trackInfo").innerHTML =
      "<p>Code not found. Try logging in again.</p>";
    return;
  }

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
    const res = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: "Bearer " + accessToken },
    });

    const data = await res.json();
    
    // Storage data
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
  window.onSpotifyWebPlaybackSDKReady = () => {
    // Referencias a los nuevos elementos de la barra
    const playerBar = document.getElementById('playerBar');
    const currentTrackDisplay = document.getElementById('currentTrackDisplay');
    const togglePlayPause = document.getElementById('togglePlayPause');
    const progressBar = document.getElementById('progressBar');
    const currentTimeSpan = document.getElementById('currentTime');
    const trackDurationSpan = document.getElementById('trackDuration');

    const player = new Spotify.Player({
      name: "Melody Stream Player",
      getOAuthToken: (cb) => {
        cb(accessToken);
      },
      volume: 0.5,
    });

    // Error handling
    player.on("initialization_error", ({ message }) => {
      console.error(message);
    });
    player.on("authentication_error", ({ message }) => {
      console.error(message);
    });
    player.on("account_error", ({ message }) => {
      console.error(message);
    });
    player.on("playback_error", ({ message }) => {
      console.error(message);
    });

    // Player State Changed: Actualiza la barra de reproducción
    player.on('player_state_changed', state => {
      if (!state) {
        playerBar.style.display = 'none'; // Oculta si no hay estado
        return;
      }

      playerBar.style.display = 'block'; // Muestra la barra

      // Control Play/Pause
      togglePlayPause.innerHTML = state.paused ? '&#9658;' : '&#10074;&#10074;';

      // Actualizar información de la canción
      const currentTrack = state.track_window.current_track;
      currentTrackDisplay.textContent = `${currentTrack.name} – ${currentTrack.artists.map(a => a.name).join(', ')}`;
      
      // Actualizar barra de progreso y tiempos
      const position = state.position;
      const duration = state.duration;

      currentTimeSpan.textContent = formatTime(position);
      trackDurationSpan.textContent = formatTime(duration);
      progressBar.max = duration; // El máximo es la duración total en milisegundos
      progressBar.value = position; // El valor actual es la posición

      // Si la reproducción termina, restablecer la barra
      if (state.position === 0 && !state.paused && !state.loading && state.restrictions.disallow_resuming_playback) {
          playerBar.style.display = 'none';
      }
    });

    // Ready
    player.on("ready", ({ device_id }) => {
      console.log("Ready with Device ID", device_id);
      deviceId = device_id;
      // Una vez listo, forzamos la transferencia de reproducción
      transferPlayback(deviceId); 
    });

    // Not Ready
    player.on("not_ready", ({ device_id }) => {
      console.log("Device ID has gone offline", device_id);
      deviceId = null;
      playerBar.style.display = 'none'; // Oculta si el dispositivo se desconecta
    });

    // Listeners para los controles de la barra (NUEVO)
    togglePlayPause.addEventListener('click', () => {
        player.togglePlay();
    });
    
    // Funcionalidad de Seek (avanzar/retroceder en la barra)
    progressBar.addEventListener('change', () => {
        player.seek(Number(progressBar.value));
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
      )}&type=track&limit=10`,
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
        <div style="padding:10px; margin:10px;">
          <img src="${track.album.images[0].url}" alt="Album Art" style="width: 100px; height: 100px;">
          <h2>${i + 1}. ${track.name}</h2>
          <p>Artista: ${track.artists.map((artist) => artist.name).join(", ")}</p>
          <p>Álbum: ${track.album.name}</p>
          
          ${isPremium ? 
            // If it is premium, show the button
            `<button onclick="playTrack('${track.uri}')">
              ▶ Reproducir Canción Completa
            </button>`
            : 
            // If not, do not show nothing
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
  // Not premium -> return
  if (!isPremium) {
    console.warn("Requires Premium");
    alert("You have to be premium and be authorized.");
    return;
  }

  // PREMIUM : COMPLETE PLAYBACK 
  if (!deviceId) {
    alert("Try again later. The device is not ready yet.");
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
  
  const userIdentifier = userEmail || userName || "Unknown User";

  if (isPremium) {
    message = `✅ Connected as **${userIdentifier}**. You are Spotify Premium: you can listen to the songs`;
    color = "#4CAF50"; 
  } else {
    // Mensaje para usuarios Free, sin mencionar previews
    message = `❌ Connected as **${userIdentifier}**. You are Spotify Free: you can only read information`;
    color = "#FF9800"; 
  }

  statusDiv.innerHTML = message;
  statusDiv.style.backgroundColor = color;
  statusDiv.style.color = "white";
  statusDiv.style.padding = "10px";
}

/***********************
 * HELPER: Time Format
 ***********************/
function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
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

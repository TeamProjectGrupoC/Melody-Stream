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
let lastDuration = 0;

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
  const script = document.createElement("script");
  script.src = "https://sdk.scdn.co/spotify-player.js";
  document.body.appendChild(script);

  window.onSpotifyWebPlaybackSDKReady = () => {
    const player = new Spotify.Player({
      name: "MelodyStream Player",
      getOAuthToken: (cb) => cb(accessToken),
      volume: 0.8,
    });

    // When ready
    player.addListener("ready", ({ device_id }) => {
      console.log("Device ready:", device_id);
      deviceId = device_id;
      document.getElementById("playerBar").style.display = "block";
    });

    // MAIN STATE LISTENER → update progress bar
    player.addListener("player_state_changed", (state) => {
      if (!state) return;

      lastDuration = state.duration;
      const position = state.position;

      document.getElementById("progressBar").value = (position / lastDuration) * 100;
      document.getElementById("currentTime").textContent = formatTime(position);
      document.getElementById("totalTime").textContent = formatTime(lastDuration);

      const track = state.track_window.current_track;
      document.getElementById("currentTrack").textContent =
        `${track.name} - ${track.artists[0].name}`;
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

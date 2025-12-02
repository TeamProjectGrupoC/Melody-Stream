// --- IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js";
import { getDatabase, ref, onValue, set, get } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-database.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";

// --- FIREBASE CONFIGURATION ---
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

// --- FIREBASE CONFIG ---
const app = initializeApp(firebaseConfig);
const auth = getAuth();
const database = getDatabase();

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

// /***********************
//  * 0. TO VALIDATE TOKEN
//  ***********************/
async function validateToken(token) {
  try {
    const res = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: "Bearer " + token },
    });

    return res.ok; // true si el token funciona
  } catch {
    return false;
  }
}

// /***********************
//  * 1. OBTAIN TOKEN
//  ***********************/
async function getToken() {
  const savedToken = localStorage.getItem("spotify_access_token");

  // 1. ¿Hay token guardado?
  if (savedToken) {
    console.log("Token encontrado en localStorage. Validando...");

    // 2. Validarlo llamando a Spotify
    if (await validateToken(savedToken)) {
      console.log("Token válido. Usándolo.");
      accessToken = savedToken;

      await getUserProfile();
      displayUserStatus();
      if (isPremium) loadWebPlaybackSDK();

      return; 
    }

    // 3. Token inválido → borrar
    console.warn("Token guardado inválido. Borrando...");
    localStorage.removeItem("spotify_access_token");
  }

  // 4. Si no hay token guardado → necesitas ?code=
  if (!code) {
    document.getElementById("trackInfo").innerHTML =
      "<p>Code not found. Try logging in again.</p>";
    return;
  }

  // 5. Código original para obtener token de la Cloud Function
  try {
    const res = await fetch(
      `https://us-central1-melodystream123.cloudfunctions.net/getSpotifyToken?code=${code}`
    );

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`HTTP Error ${res.status} al obtener el token:`, errorText);
      throw new Error(`Server error`);
    }

    const data = await res.json();
    accessToken = data.access_token;

    localStorage.setItem("spotify_access_token", accessToken);

    await getUserProfile();
    displayUserStatus();
    if (isPremium) loadWebPlaybackSDK();

  } catch (err) {
    console.error("Error getting the token", err);
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
    window.spotifyPlayer = new Spotify.Player({
      name: "MelodyStream Player",
      getOAuthToken: (cb) => cb(accessToken),
      volume: 0.8,
    });

    // When ready
    spotifyPlayer.addListener("ready", ({ device_id }) => {
      console.log("Device ready:", device_id);
      deviceId = device_id;
      document.getElementById("playerBar").style.display = "block";
    });

    // MAIN STATE LISTENER → update progress bar
    spotifyPlayer.addListener("player_state_changed", (state) => {
      if (!state) return;
      lastDuration = state.duration;
      const track = state.track_window.current_track;
      document.getElementById("currentTrack").textContent =
        `${track.name} - ${track.artists[0].name}`;
    });

    spotifyPlayer.connect();
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
    const trackList = await Promise.all(
      tracks.map(async (track, i) => {
        //Verify favorite song
        let fav = false;

        if (auth.currentUser) {
          fav = await isFavorite(track.id, auth.currentUser.uid);
        }

        return `
          <div style="padding:10px; margin:10px;">
            <img src="${track.album.images[0].url}" alt="Album Art" style="width: 100px; height: 100px;">
            <h2>${i + 1}. ${track.name}</h2>
            <p>Artista: ${track.artists.map((artist) => artist.name).join(", ")}</p>
            <p>Álbum: ${track.album.name}</p>
            
            ${isPremium ? 
              `<button onclick="playTrack('${track.uri}')">
                ▶ Reproduce
              </button>`
              : ''
            }

            <!-- Botón de favorito -->
            <button class="fav-btn ${fav ? "is-fav" : "not-fav"}" data-id="${track.id}">
              <i class="${fav ? "bi bi-heart-fill" : "bi bi-heart"}"></i>
            </button>
          </div>
        `;
      })
	);
    
	document.getElementById("trackInfo").innerHTML = trackList.join("");

  attachFavoriteButtons();
  } 
  catch (err) {
    console.error(err);
    document.getElementById("trackInfo").innerHTML =
      "<p>Error searching for songs.</p>";
  }
}

// Save the song data to the "canciones" node in Firebase
async function saveSongToDatabase(track) {
  const db = getDatabase();
  const songRef = ref(db, `canciones/${track.id}`);
  
  await set(songRef, {
    title: track.name,
    artist: track.artists.map((artist) => artist.name).join(", "),
    album: track.album.name,
    albumImageUrl: track.album.images[0].url,
    previewUrl: track.preview_url,
  });
  console.log(`Song ${track.preview_url} saved to database.`);
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
    document.getElementById("playPauseBtn").textContent = "||";
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


function playPauseSong() {
    const button = document.getElementById("playPauseBtn");

    // Verificar si existe el Web Playback SDK
    if (!window.spotifyPlayer) {
        console.warn("El reproductor todavía no está listo.");
        return;
    }

    window.spotifyPlayer.getCurrentState().then(state => {
        if (!state) {
            console.warn("No hay canción reproduciéndose.");
            return;
        }

        if (state.paused) {
            // Si está pausado → Reanudar
            window.spotifyPlayer.resume();
            button.textContent = "||";  // Cambiar icono a pause
        } else {
            // Si está sonando → Pausar
            window.spotifyPlayer.pause();
            button.textContent = "▶";  // Cambiar icono a play
        }
    });
}

/***********************
 * ADD FAVORITE SONG
 ***********************/
async function addToFavorite(songId){

    const user = auth.currentUser;
    if (!user) {
		alert("You must log in to add songs to your favorites");
		return;
    }

    const favSongRef = ref(database, `users/${user.uid}/favoritos/${songId}`);
    await set(favSongRef, true);

    alert("Song added to your favorites");
}

async function isFavorite(songId, userId){
    return new Promise((resolve) => {
        const favRef = ref(database, `users/${userId}/favoritos/${songId}`);
        onValue(favRef, (snapshot) => {
            resolve(snapshot.exists());
        }, { onlyOnce: true });
    });
}

function attachFavoriteButtons() {
	const buttons = document.querySelectorAll(".fav-btn");

	buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      toggleFavorite(id, btn);
		});
	});
}

async function toggleFavorite(songId, button) {
	const user = auth.currentUser; 

	if (!user) {
		alert("You must log in to add songs to your favorites");
		return;
	}

	const favRef = ref(database, `users/${user.uid}/favoritos/${songId}`);
	const nowFavorite = button.classList.contains("not-fav");

	if (nowFavorite) {
		// Agregar a favoritos
		await set(favRef, true);
		button.innerHTML = '<i class="bi bi-heart-fill"></i>';
		button.classList.remove("not-fav");
		button.classList.add("is-fav");
    addToFavorite(songId);

    const songRef = ref(database, `canciones/${songId}`);
    const snapshot = await get(songRef);

    if (!snapshot.exists()) {
      // Fetch song details from Spotify and save it
      const track = await getTrackById(songId); 
      await saveSongToDatabase(track);
    }
	} 
  else {
		// Quitar de favoritos
		await set(favRef, null);
		button.innerHTML = '<i class="bi bi-heart"></i>';
		button.classList.remove("is-fav");
		button.classList.add("not-fav");

    alert("This song has been removed from favorites")
	}
}

async function getTrackById(songId) {
  const res = await fetch(`https://api.spotify.com/v1/tracks/${songId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const track = await res.json();
  return track;
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
 * Seek
 ***********************/
function seekToPosition() {
  if (!window.spotifyPlayer || !lastDuration || !isPremium) return;

  const progressBar = document.getElementById("progressBar");
  const percentage = progressBar.value / 100;

  const newPositionMs = Math.round(lastDuration * percentage);

  window.spotifyPlayer.seek(newPositionMs).then(() => {
    console.log(`Buscando nueva posición: ${formatTime(newPositionMs)}`);
  });
}

/***********************
 * UPDATE PROGRESS BAR (Web Playback SDK)
 ***********************/
setInterval(() => {
    if (!window.spotifyPlayer || !isPremium) return;

    window.spotifyPlayer.getCurrentState().then(state => {
        if (!state || !state.duration) return;

        // Actualizar barra de progreso
        const progressPercent = (state.position / state.duration) * 100;
        document.getElementById("progressBar").value = progressPercent;

        // Actualizar tiempo actual y total (si existen)
        const currentTimeEl = document.getElementById("currentTime");
        const totalTimeEl = document.getElementById("totalTime");

        if (currentTimeEl) currentTimeEl.textContent = formatTime(state.position);
        if (totalTimeEl) totalTimeEl.textContent = formatTime(state.duration);
    });
}, 500);


/***********************
 *  EVENTS
 ***********************/
document.getElementById("searchBtn").addEventListener("click", searchTrack);
document.getElementById("playPauseBtn").addEventListener("click", playPauseSong);
document.getElementById("progressBar").addEventListener("change", seekToPosition);



// Start getting token
getToken();


// Exponer funciones al scope global
window.playTrack = playTrack;
window.searchTrack = searchTrack;

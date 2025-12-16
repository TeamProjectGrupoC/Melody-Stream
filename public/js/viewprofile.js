// --- IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js";
import { getDatabase, ref, onValue, get, set, push, update } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-database.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";

// --- CONFIG ---
const firebaseConfig = {
  apiKey: "AIzaSyCCWExxM4ACcvnidBWMfBQ_CJk7KimIkns",
  authDomain: "melodystream123.firebaseapp.com",
  databaseURL: "https://melodystream123-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "melodystream123",
  storageBucket: "melodystream123.appspot.com",
  messagingSenderId: "640160988809",
  appId: "1:640160988809:web:d0995d302123ccf0431058",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// --- SPOTIFY PLAYER VARIABLES (Same logic as chats.js/profile.js) ---
let playerReady = false;
let isPlaying = false;
let token = localStorage.getItem("spotify_access_token");
let isPremium = localStorage.getItem("spotify_is_premium") === "1";
let deviceId = null;
let currentPlayingUri = null;
let currentActivePlayButton = null;

// 1. Validate Spotify Token (Endpoint 2)
async function isSpotifyTokenValid(token) {
    if (!token) return false;
    try {
        const res = await fetch("https://api.spotify.com/v1/me", {
            headers: { "Authorization": "Bearer " + token }
        });
        return res.status === 200;
    } catch (e) {
        //console.warn("Token validation failed", e);
        return false;
    }
}

// 2. Initialize Spotify Web Playback SDK
function initSpotifyPlaybackSDK() {
    if (document.getElementById('spotify-player-script')) return;

    const script = document.createElement("script");
    script.id = "spotify-player-script";
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true; 
    document.body.appendChild(script);

    window.onSpotifyWebPlaybackSDKReady = () => {
        window.spotifyPlayer = new Spotify.Player({
            name: "MelodyStream ViewProfile Player",
            getOAuthToken: (cb) => cb(token),
            volume: 0.8
        });

        window.spotifyPlayer.addListener("ready", ({ device_id }) => {
            //console.log("Device ready:", device_id);
            deviceId = device_id;
            playerReady = true;
        });

        window.spotifyPlayer.addListener("not_ready", ({ device_id }) => {
            //console.log("Device ID has gone offline", device_id);
            playerReady = false;
        });

        window.spotifyPlayer.connect();
    };
}

// 3. Auto-start SDK
(async () => {
    if (token && isPremium && await isSpotifyTokenValid(token)) {
        //console.log("Spotify token OK — Loading Web Playback SDK...");
        initSpotifyPlaybackSDK();
    } else {
        //console.log("Spotify not available — premium or token invalid.");
    }
})();

// 4. Main Function: Play Track (Endpoints 3 & 4)
async function playTrack(uri, playButton) {
    if (!playerReady || !deviceId) {
        //console.warn("Spotify player not ready yet.");
        return;
    }

    // A) If clicking on a DIFFERENT song -> Pause previous (Endpoint 3)
    if (currentPlayingUri && currentPlayingUri !== uri) {
        await fetch(
            `https://api.spotify.com/v1/me/player/pause?device_id=${deviceId}`, 
            { method: "PUT", headers: { Authorization: `Bearer ${token}` } }
        );
        isPlaying = false;
        
        if (currentActivePlayButton) {
            currentActivePlayButton.textContent = "▶ Play";
        }
    }

    // B) If clicking on the SAME song while playing -> Pause (Endpoint 3)
    if (currentPlayingUri === uri && isPlaying) {
        await fetch(
            `https://api.spotify.com/v1/me/player/pause?device_id=${deviceId}`, 
            { method: "PUT", headers: { Authorization: `Bearer ${token}` } }
        );
        isPlaying = false;
        playButton.textContent = "▶ Play";
        return;
    }

    // C) Start playback (Endpoint 4)
    await fetch(
        `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, 
        {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ uris: [uri] })
        }
    );

    //console.log("Playing:", uri);
    currentPlayingUri = uri;
    isPlaying = true;
    playButton.textContent = "⏹ Stop";
    currentActivePlayButton = playButton;
}

// --- Get profile UID from URL ---
const params = new URLSearchParams(window.location.search);
const profileUID = params.get("uid");

// DOM elements for follow button and follower count
const followBtn = document.createElement("button");
followBtn.id = "followBtn";
followBtn.style.marginTop = "10px";
document.querySelector(".profile-info").appendChild(followBtn);

const followersCountP = document.createElement("p");
followersCountP.id = "followersCount";
document.querySelector(".profile-info").appendChild(followersCountP);

let currentUserUID = null;
let hasRequested = false;
let isMaster = false; 

// Message if no profile UID provided
if (!profileUID) {
  document.getElementById("msg").textContent = "No profile selected.";
}

// ----------------------------------------------------
//  Wait for user authentication
// ----------------------------------------------------
onAuthStateChanged(auth, (user) => {
  if (!user) {
    document.getElementById("msg").textContent = "You must be logged in to view this profile.";
    followBtn.style.display = "none";
    followersCountP.style.display = "none";
    return;
  }

  currentUserUID = user.uid;

  // Detect master account
  if (user.email === "teamprojectgrupoc@gmail.com") {
    isMaster = true;
  }

  loadProfile();
});

// ----------------------------------------------------
//  Load profile information
// ----------------------------------------------------
function loadProfile() {
  const img = document.getElementById("profileImg");
  const msg = document.getElementById("msg");
  const nameBig = document.getElementById("profileName");

  const userRef = ref(db, "users/" + profileUID);

  onValue(userRef, (snap) => {
    const data = snap.val();
    
    if (!data) {
      msg.textContent = "User not found.";
      followBtn.style.display = "none";
      followersCountP.style.display = "none";
      return;
    }

    msg.textContent = ``;
    nameBig.textContent = data.username || data.name || data.email || "Unknown User";
    img.src = data.urlFotoPerfil || "images/logos/silueta.png";

    loadFollowers(); 
  });

  loadPodcasts(profileUID); 
}

// ----------------------------------------------------
//  Load followers info AND Handle Content Privacy
// ----------------------------------------------------
async function loadFollowers() {
  // 1. Button Visibility
  if (currentUserUID === profileUID) {
    followBtn.style.display = "none";
  } else {
    followBtn.style.display = "inline-block";
  }

  // 2. Get Followers Data
  const followersRef = ref(db, `users/${profileUID}/followers`);
  const followersSnap = await get(followersRef);
  const followers = followersSnap.exists() ? followersSnap.val() : {};
  followersCountP.textContent = `Followers: ${Object.keys(followers).length}`;

  // 3. Determine if current user has access
  const isMe = currentUserUID === profileUID;
  const isFollowing = followers.hasOwnProperty(currentUserUID);

  // --- PRIVACY CHECK ---
  if (isMe || isFollowing || isMaster) {
    // ACCESS GRANTED
    loadFavoriteSongs(profileUID);
    loadFavoriteArtists(profileUID);
  } else {
    // ACCESS DENIED
    renderLockedState("viewUserSongs", "Favorite Songs");
    renderLockedState("viewUserArtists", "Favorite Artists");
  }

  // 4. Update Button State (Visuals)
  followBtn.className = ""; // Reset classes
  followBtn.disabled = false; // Ensure button is enabled on load

  if (isFollowing) {
    hasRequested = false;
    followBtn.textContent = "Following";
    followBtn.classList.add("state-following");
  } else {
    // Check pending request status in DB
    const requestsRef = ref(db, `users/${profileUID}/followRequests/${currentUserUID}`);
    const requestSnap = await get(requestsRef);
    hasRequested = requestSnap.exists();
    
    if (hasRequested) {
        followBtn.textContent = "Request Sent";
        followBtn.classList.add("state-pending");
    } else {
        followBtn.textContent = "Follow";
    }
  }
}

// Helper function to render the "Locked" message centered
function renderLockedState(elementId, contentName) {
    const container = document.getElementById(elementId);
    if (container) {
        container.innerHTML = `
            <div class="locked-content">
                <h3>🔒</h3>
                <p>Follow this user to see their ${contentName}.</p>
            </div>
        `;
    }
}

// ----------------------------------------------------
//  Follow button click handler 
// ----------------------------------------------------
followBtn.addEventListener("click", async () => {
  if (!currentUserUID || currentUserUID === profileUID) return;

  // Prevent ANY action if request is pending
  if (hasRequested && followBtn.textContent === "Request Sent") {
    //console.log("Request already sent. Please wait for approval.");
    return;
  }

  // Disable button immediately to prevent spam/double click
  followBtn.disabled = true;

  const followersRef = ref(db, `users/${profileUID}/followers/${currentUserUID}`);
  const requestRef = ref(db, `users/${profileUID}/followRequests/${currentUserUID}`);

  try {
    if (followBtn.textContent === "Follow") {
      
      // Double safety check: verify if request already exists in DB
      const checkSnap = await get(requestRef);
      if (checkSnap.exists() || hasRequested) {
        followBtn.textContent = "Request Sent";
        followBtn.className = "state-pending";
        hasRequested = true;
        return;
      }

      // Send follow request to DB
      await set(requestRef, true);
      hasRequested = true;

      // Update UI
      followBtn.textContent = "Request Sent";
      followBtn.className = "state-pending";

      //  Send chat notification
      const chatId = currentUserUID < profileUID ? `${currentUserUID}_${profileUID}` : `${profileUID}_${currentUserUID}`;
      const messagesRef = ref(db, `chats/${chatId}/messages`);
      const newMessageKey = push(messagesRef).key;      const timestamp = Date.now();
      const message = {
        sender: currentUserUID,
        text: "📩 Sent a follow request",
        timestamp
      };

      // 1. Add message to chat
      await update(ref(db, `chats/${chatId}`), {
          [`messages/${newMessageKey}`]: message,
          createdAt: timestamp,
          users: {
              [currentUserUID]: true,
              [profileUID]: true
          }
      });
      
      const lastMessage = { ...message };

      // 2. sender-> isRead: true
      await update(ref(db, `userChats/${currentUserUID}/${chatId}`), { 
          lastMessage,
          isRead: true 
      });

      // 3.receiver -> isRead: false 
      await update(ref(db, `userChats/${profileUID}/${chatId}`), { 
          lastMessage,
          isRead: false 
      });
    }

    else if (followBtn.textContent === "Following") {
      // Unfollow user
      await set(followersRef, null);

      followBtn.textContent = "Follow";
      followBtn.className = "";
    }

    // Refresh followers count
    loadFollowers();

  } catch (err) {
    //console.error("Error handling follow/unfollow:", err);
  } finally {
    // Re-enable button after operation completes
    followBtn.disabled = false;
  }
});

// ----------------------------------------------------
//  Load favorite songs (UPDATED WITH SPOTIFY PLAYER)
// ----------------------------------------------------
async function loadFavoriteSongs(uid) {
  const container = document.getElementById("viewUserSongs");
  container.innerHTML = "<p>Loading favorite songs...</p>";

  // Check token validity once
  const tokenValid = token && await isSpotifyTokenValid(token);

  try {
    const favRef = ref(db, `users/${uid}/favoritos`);
    const favSnap = await get(favRef);

    if (!favSnap.exists()) {
      container.innerHTML = "<p class='empty-msg'>No favorite songs.</p>";
      return;
    }

    const favorites = favSnap.val();
    container.innerHTML = ""; // Clear loading message

    for (const songId in favorites) {
      const songRef = ref(db, `canciones/${songId}`);
      const songSnap = await get(songRef);
      if (!songSnap.exists()) continue;

      const s = songSnap.val();
      
      // Construct URI
      const songUri = s.uri || `spotify:track:${s.id || songId}`;

      // Create Element
      const div = document.createElement("div");
      div.className = "card-item";

      div.innerHTML = `
        ${s.albumImageUrl ? `<img src="${s.albumImageUrl}" alt="Cover">` : ""}
        <div class="card-item-title">${s.title || "Untitled"}</div>
        <p>${s.artist || ""}</p>
        <div class="player-controls-area"></div>
      `;

      // --- PLAYER BUTTON LOGIC ---
      const controlsArea = div.querySelector(".player-controls-area");

      if (!tokenValid) {
          const reconnectBtn = document.createElement("button");
          reconnectBtn.textContent = "Connect Spotify";
          reconnectBtn.className = "main-button"; 
          reconnectBtn.style.fontSize = "10px";
          reconnectBtn.style.marginTop = "5px";
          reconnectBtn.addEventListener("click", () => {
              window.location.href = "test_register_spotify.html"; 
          });
          controlsArea.appendChild(reconnectBtn);
      } 
      else if (!isPremium) {
          const info = document.createElement("p");
          info.textContent = "Premium only";
          info.style.fontStyle = "italic";
          info.style.fontSize = "10px";
          info.style.color = "#888";
          controlsArea.appendChild(info);
      } 
      else {
          const playBtn = document.createElement("button");
          playBtn.textContent = "▶ Play";
          playBtn.className = "main-button"; 
          playBtn.style.marginTop = "5px";
          playBtn.style.fontSize = "12px";
          
          playBtn.addEventListener("click", () => {
              playTrack(songUri, playBtn);
          });
          controlsArea.appendChild(playBtn);
      }

      container.appendChild(div);
    }

    if (container.innerHTML === "") {
        container.innerHTML = "<p class='empty-msg'>No favorite songs found.</p>";
    }

  } catch (err) {
    //console.error("Error loading favorite songs:", err);
    container.innerHTML = "<p class='empty-msg'>Error loading songs.</p>";
  }
}

// ----------------------------------------------------
//  Load favorite artists
// ----------------------------------------------------
async function loadFavoriteArtists(uid) {
  const container = document.getElementById("viewUserArtists");
  container.innerHTML = "<p>Loading favorite artists...</p>";

  try {
    const favRef = ref(db, `users/${uid}/favourite_artists`);
    const favSnap = await get(favRef);

    if (!favSnap.exists()) {
      container.innerHTML = "<p class='empty-msg'>No favorite artists.</p>";
      return;
    }

    const artistsObj = favSnap.val();
    let html = "";

    for (const artistId in artistsObj) {
      // Use ID to fetch from global artists node
      const artistRef = ref(db, `artistas/${artistId}`);
      const artistSnap = await get(artistRef);

      if (artistSnap.exists()) {
        const a = artistSnap.val();

        html += `
          <div class="card-item">
            ${a.image ? `<img src="${a.image}" alt="Artist image">` : '<img src="images/logos/silueta.png" alt="Artist image">'}
            <div class="card-item-title">${a.name || "Unknown Artist"}</div>
            <p><strong>Followers:</strong> ${a.followers?.toLocaleString() || 0}</p>
            <p><strong>Genres:</strong> ${Array.isArray(a.genres) ? a.genres.join(", ") : a.genres || "—"}</p>
          </div>
        `;
      }
    }

    if (html === "") {
        container.innerHTML = "<p class='empty-msg'>No artist details found.</p>";
    } else {
        container.innerHTML = html;
    }

  } catch (err) {
    //console.error("Error loading favorite artists:", err);
    container.innerHTML = "<p class='empty-msg'>Error loading artists.</p>";
  }
}

// ----------------------------------------------------
// 🎙 Load uploaded podcasts
// ----------------------------------------------------
async function loadPodcasts(uid) {
  const container = document.getElementById("viewUserPodcasts");
  container.innerHTML = "Loading podcasts...";

  const podcastsRef = ref(db, "podcasts");
  const snap = await get(podcastsRef);

  if (!snap.exists()) {
    container.innerHTML = "<p class='empty-msg'>No podcasts found.</p>";
    return;
  }

  const podcasts = snap.val();
  let html = "";

  for (const pid in podcasts) {
    const p = podcasts[pid];
    if (p.idcreador === uid) {
      html += `
        <div class="card-item">
          ${p.iconURL ? `<img src="${p.iconURL}" alt="cover">` : `<img src="images/logos/silueta.png" alt="default">`}
          <div class="card-item-title">${p.nombre || "Untitled"}</div>
          <p>${p.descripcion || ""}</p>
          ${p.audioURL ? `<audio controls src="${p.audioURL}"></audio>` : ""}
        </div>
      `;
    }
  }

  container.innerHTML = html || "<p class='empty-msg'>No podcasts uploaded.</p>";
}
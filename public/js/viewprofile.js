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
    nameBig.textContent = data.username || "—";
    img.src = data.urlFotoPerfil || "images/logos/silueta.png";

    loadFollowers(); 
  });

  loadPodcasts(profileUID); 
}

// ----------------------------------------------------
// 🧍 Load followers info AND Handle Content Privacy
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
// 🔘 Follow button click handler (Anti-Spam + No cancel request)
// ----------------------------------------------------
followBtn.addEventListener("click", async () => {
  if (!currentUserUID || currentUserUID === profileUID) return;

  // Prevent ANY action if request is pending
  if (hasRequested && followBtn.textContent === "Request Sent") {
    console.log("Request already sent. Please wait for approval.");
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

      // 🔔 Send chat notification
      const chatId = currentUserUID < profileUID ? `${currentUserUID}_${profileUID}` : `${profileUID}_${currentUserUID}`;
      const messagesRef = ref(db, `chats/${chatId}/messages`);
      const timestamp = Date.now();
      const message = {
        sender: currentUserUID,
        text: "📩 Sent a follow request",
        timestamp
      };

      const newMessageKey = push(messagesRef).key;
      await set(ref(db, `chats/${chatId}/messages/${newMessageKey}`), message);
      
      const lastMessage = { ...message };
      await update(ref(db, `userChats/${currentUserUID}/${chatId}`), { lastMessage });
      await update(ref(db, `userChats/${profileUID}/${chatId}`), { lastMessage });
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
    console.error("Error handling follow/unfollow:", err);
  } finally {
    // Re-enable button after operation completes
    followBtn.disabled = false;
  }
});

// ----------------------------------------------------
// 🎵 Load favorite songs
// ----------------------------------------------------
async function loadFavoriteSongs(uid) {
  const container = document.getElementById("viewUserSongs");
  container.innerHTML = "<p>Loading favorite songs...</p>";

  try {
    const favRef = ref(db, `users/${uid}/favoritos`);
    const favSnap = await get(favRef);

    if (!favSnap.exists()) {
      container.innerHTML = "<p class='empty-msg'>No favorite songs.</p>";
      return;
    }

    const favorites = favSnap.val();
    let html = "";

    for (const songId in favorites) {
      const songRef = ref(db, `canciones/${songId}`);
      const songSnap = await get(songRef);
      if (!songSnap.exists()) continue;

      const s = songSnap.val();

      html += `
        <div class="card-item">
          ${s.albumImageUrl ? `<img src="${s.albumImageUrl}" alt="Cover">` : ""}
          <div class="card-item-title">${s.title || "Untitled"}</div>
          <p>${s.artist || ""}</p>
          ${s.previewUrl ? `<audio controls src="${s.previewUrl}"></audio>` : "<p>No preview available</p>"}
        </div>
      `;
    }

    container.innerHTML = html || "<p class='empty-msg'>No favorite songs found.</p>";

  } catch (err) {
    console.error("Error loading favorite songs:", err);
    container.innerHTML = "<p class='empty-msg'>Error loading songs.</p>";
  }
}

// ----------------------------------------------------
// 🎤 Load favorite artists
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
      const a = artistsObj[artistId];

      html += `
        <div class="card-item">
          ${a.image ? `<img src="${a.image}" alt="Artist image">` : ""}
          <div class="card-item-title">${a.name || "Unknown Artist"}</div>
          <p><strong>Followers:</strong> ${a.followers?.toLocaleString() || 0}</p>
          <p><strong>Genres:</strong> ${Array.isArray(a.genres) ? a.genres.join(", ") : a.genres || "—"}</p>
        </div>
      `;
    }

    container.innerHTML = html;

  } catch (err) {
    console.error("Error loading favorite artists:", err);
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
// --- IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js";
import { getDatabase, ref, onValue, get } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-database.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";

// --- CONFIG ---
const firebaseConfig = {
  apiKey: "AIzaSyCCWExxM4ACcvnidBWMfBQ_CJk7KimIkns",
  authDomain: "melodystream123.firebaseapp.com",
  databaseURL: "https://melodystream123-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "melodystream123",
  storageBucket: "melodystream123.firebasestorage.app",
  messagingSenderId: "640160988809",
  appId: "1:640160988809:web:d0995d302123ccf0431058",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// --- UID URL ---
const params = new URLSearchParams(window.location.search);
const profileUID = params.get("uid");

// Mensaje inicial si no hay UID
if (!profileUID) {
  document.getElementById("msg").textContent = "No profile selected.";
}

// ----------------------------------------------------
// 🔥 Esperar a que el usuario esté autenticado
// ----------------------------------------------------
onAuthStateChanged(auth, (user) => {
  if (!user) {
    document.getElementById("msg").textContent = "You must be logged in to view this profile.";
    return;
  }

  loadProfile();
});

// ----------------------------------------------------
// 🧍 Load Profile
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
      return;
    }

    msg.textContent = ``;

    // Nombre grande arriba
    nameBig.textContent = data.username || "—";

    // Foto de perfil
    if (data.urlFotoPerfil) {
      img.src = data.urlFotoPerfil;
    } else {
      img.src = "images/logos/silueta.png";
    }
  });

  loadFavoriteSongs(profileUID);
  loadFavoriteArtists(profileUID);
  loadPodcasts(profileUID);

}

// ----------------------------------------------------
// 🎵 Load Favorite Songs
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

          ${
            s.previewUrl
              ? `<audio controls src="${s.previewUrl}"></audio>`
              : "<p>No preview available</p>"
          }
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
// 🎤 Load Favorite Artists
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

          <p><strong>Followers:</strong> ${
            a.followers?.toLocaleString() || 0
          }</p>

          <p><strong>Genres:</strong> ${
            Array.isArray(a.genres)
              ? a.genres.join(", ")
              : a.genres || "—"
          }</p>
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
// 🎙 Load Podcasts
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

          ${p.iconURL
            ? `<img src="${p.iconURL}" alt="cover">`
            : `<img src="images/logos/silueta.png" alt="default">`
          }

          <div class="card-item-title">${p.nombre || "Untitled"}</div>

          <p>${p.descripcion || ""}</p>

          ${p.audioURL ? `<audio controls src="${p.audioURL}"></audio>` : ""}
        </div>
      `;
    }
  }

  container.innerHTML =
    html || "<p class='empty-msg'>No podcasts uploaded.</p>";
}

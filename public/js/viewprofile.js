// --- IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js";
import { getDatabase, ref, onValue, get } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-database.js";

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

// --- UID URL ---
const params = new URLSearchParams(window.location.search);
const profileUID = params.get("uid");

if (!profileUID) {
  document.getElementById("msg").textContent = "No profile selected.";
}

// --- Load Profile ---
function loadProfile() {
  const img = document.getElementById("profileImg");
  const msg = document.getElementById("msg");

  const nameBig = document.getElementById("profileName");
  const userSmall = document.getElementById("username");
  const favSong = document.getElementById("favSong");

  const userRef = ref(db, "publicProfiles/" + profileUID);

  onValue(userRef, (snap) => {
    const data = snap.val();

    if (!data) {
      msg.textContent = "User not found.";
      return;
    }

    msg.textContent = ``;

    // Nombre grande arriba
    nameBig.textContent = data.username || "—";

    // Campos pequeños
    favSong.textContent = data.favorite_song || "—";

    // Foto
    if (data.urlFotoPerfil) {
      img.src = data.urlFotoPerfil;
    } else {
      img.src = "images/logos/silueta.png";
    }
  });

  loadPodcasts(profileUID);
}

// --- Load Podcasts ---
async function loadPodcasts(uid) {
  const container = document.getElementById("viewUserPodcasts");
  container.innerHTML = "Loading podcasts...";

  const podcastsRef = ref(db, "podcasts");
  const snap = await get(podcastsRef);

  if (!snap.exists()) {
    container.innerHTML = "<p>No podcasts found.</p>";
    return;
  }

  const podcasts = snap.val();
  let html = "";

  for (const pid in podcasts) {
    const p = podcasts[pid];

    if (p.idcreador === uid) {
      html += `
        <div class="podcast-item">
          <div class="podcast-title">${p.nombre || "Untitled"}</div>

          ${
            p.iconURL
              ? `<img class="podcast-cover" src="${p.iconURL}" alt="cover">`
              : `<img class="podcast-cover" src="images/logos/silueta.png">`
          }

          <p>${p.descripcion || ""}</p>

          ${
            p.audioURL
              ? `<audio controls src="${p.audioURL}"></audio>`
              : ""
          }
        </div>
      `;
    }
  }

  container.innerHTML = html || "<p>No podcasts uploaded.</p>";
}

document.addEventListener("DOMContentLoaded", loadProfile);
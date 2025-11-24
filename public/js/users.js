// --- IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
//import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getDatabase, ref, push, set, get } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
//import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";

// Firebase configuration
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
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// --- HTML ELEMENTS ---
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const resultsContainer = document.getElementById("searchResults");

searchBtn.addEventListener("click", searchUsers);

// --------------------------------------------------
// 🔥 1. Mostrar automáticamente 10 usuarios
// --------------------------------------------------
loadInitialUsers();

async function loadInitialUsers() {
  resultsContainer.innerHTML = "Loading users...";

  try {
    const usersRef = ref(db, "publicProfiles");
    const snapshot = await get(usersRef);

    if (!snapshot.exists()) {
      resultsContainer.innerHTML = "<p>No users found.</p>";
      return;
    }

    const usersObj = snapshot.val();

    // Array manteniendo UID
    const users = Object.entries(usersObj)
      .slice(0, 10)
      .map(([uid, data]) => ({ uid, ...data }));

    displayUsers(users);

  } catch (err) {
    console.error("Error loading users:", err);
    resultsContainer.innerHTML = "<p>Error loading users.</p>";
  }
}

// --------------------------------------------------
// 🔍 2. Buscar usuarios
// --------------------------------------------------
async function searchUsers() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  resultsContainer.innerHTML = "Searching...";

  if (!searchTerm) {
    resultsContainer.innerHTML = "<p>Enter a username to search.</p>";
    return;
  }

  try {
    const usersRef = ref(db, "publicProfiles");
    const snapshot = await get(usersRef);

    if (!snapshot.exists()) {
      resultsContainer.innerHTML = "<p>No users found.</p>";
      return;
    }

    const usersObj = snapshot.val();

    const matched = Object.entries(usersObj)
      .filter(([uid, user]) =>
        user.username?.toLowerCase().includes(searchTerm)
      )
      .map(([uid, data]) => ({ uid, ...data }));

    if (matched.length === 0) {
      resultsContainer.innerHTML = "<p>No users match your search.</p>";
      return;
    }

    displayUsers(matched);

  } catch (err) {
    console.error("Error searching users:", err);
    resultsContainer.innerHTML = "<p>Error searching users.</p>";
  }
}

// --------------------------------------------------
// 🎨 3. Mostrar usuarios + redirigir a viewprofile.html
// --------------------------------------------------
function displayUsers(list) {
  resultsContainer.innerHTML = "";

  list.forEach(user => {
    const div = document.createElement("div");
    div.className = "search-user";
    div.style.cursor = "pointer";

    // 👉 Al hacer clic, abrir el perfil de otro usuario
    div.addEventListener("click", () => {
      window.location.href = `viewprofile.html?uid=${user.uid}`;
    });

    const img = document.createElement("img");
    img.src = user.urlFotoPerfil || "images/logos/silueta.png";
    img.alt = user.username;
    img.width = 100;
    img.height = 100;

    const name = document.createElement("p");
    name.textContent = user.username || "Unknown";

    div.appendChild(img);
    div.appendChild(name);

    resultsContainer.appendChild(div);
  });
}
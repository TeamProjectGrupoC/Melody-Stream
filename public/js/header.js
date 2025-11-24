// --- IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

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
const auth = getAuth(app);
const db = getDatabase(app);

// Elementos del header
const headerPic = document.getElementById("headerUserPic");
const loginProfileLink = document.getElementById("loginProfileLink");

// Si el HTML no tiene header (por ejemplo login.html), salimos
if (!headerPic || !loginProfileLink) {
  console.warn("Header no presente en esta página.");
}

// Cambios dinámicos
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // No logueado
    if (headerPic) headerPic.src = "images/logos/silueta.png";
    if (loginProfileLink) {
      loginProfileLink.textContent = "LOG IN";
      loginProfileLink.href = "login.html";
    }
    return;
  }

  // Usuario logueado → cambiar a "MY PROFILE"
  if (loginProfileLink) {
    loginProfileLink.textContent = "MY PROFILE";
    loginProfileLink.href = "profile.html";
  }

  try {
    // Cargar foto del usuario
    const userRef = ref(db, `users/${user.uid}`);
    const snap = await get(userRef);

    if (snap.exists()) {
      const data = snap.val();
      headerPic.src = data.urlFotoPerfil || "images/logos/silueta.png";
    } else {
      headerPic.src = "images/logos/silueta.png";
    }

  } catch (error) {
    console.error("Error loading header data:", error);
    headerPic.src = "images/logos/silueta.png";
  }
});

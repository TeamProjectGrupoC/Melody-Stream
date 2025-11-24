// migra.js - Script para migrar usuarios a perfiles públicos en Firebase
// --- IMPORTS ---

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getDatabase, ref, push, set, get } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";

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
const auth = getAuth(app);

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    console.error("⚠️ Debes estar logueado para migrar usuarios.");
    return;
  }

  console.log(`Usuario autenticado: ${user.email}. Iniciando migración...`);

  try {
    const usersRef = ref(db, "users");
    const snapshot = await get(usersRef);

    if (!snapshot.exists()) {
      console.log("No se encontraron usuarios.");
      return;
    }

    const users = snapshot.val();
    let count = 0;

    for (const uid in users) {
      const userData = users[uid];

      // Solo copiamos los campos públicos
      const publicData = {
        username: userData.username || null,
        urlFotoPerfil: userData.urlFotoPerfil || null,
        favorite_songs: userData.favorite_songs || null
      };

      await set(ref(db, `publicProfiles/${uid}`), publicData);
      console.log(`✅ Migrated user ${uid}`);
      count++;
    }

    console.log(`🎉 Migración completada: ${count} usuarios.`);

  } catch (err) {
    console.error("❌ Migration failed:", err);
  }
});
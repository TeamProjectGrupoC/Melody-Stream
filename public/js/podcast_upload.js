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
const storage = getStorage(app);

const nameInput = document.getElementById('podcastName');
const descInput = document.getElementById('podcastDesc');
const iconInput = document.getElementById('podcastIcon');
const fileInput = document.getElementById('podcastFile');
const uploadBtn = document.getElementById('uploadBtn');
const msg = document.getElementById('msg');
const formContainer = document.getElementById('formContainer');
const loginBtn = document.getElementById('loginBtn');

// NUEVO: elementos para carpeta (si los tienes en el HTML)
const folderInput = document.getElementById('podcastFolder');
const folderIconInput = document.getElementById('folderIcon');

let currentUser = null;

// Detect active session
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    msg.textContent = `✅ Logged in as ${user.email}`;
    formContainer.style.display = 'block';
    loginBtn.style.display = 'none';
  } else {
    currentUser = null;
    msg.textContent = "⚠️ You must be logged in to upload a podcast.";
    formContainer.style.display = 'none';
    loginBtn.style.display = 'inline-block';
  }
});

// NUEVA FUNCIÓN: asegurar carpeta (buscar por nombre o crearla)
async function ensureFolder(folderName, folderIconFile) {
  if (!folderName) return { folderId: null, folderIconURL: null };
  try {
    // Buscar carpeta existente (case-insensitive)
    const foldersRef = ref(db, 'folders');
    const foldersSnap = await get(foldersRef);
    if (foldersSnap.exists()) {
      const folders = foldersSnap.val();
      for (const fid in folders) {
        if (String(folders[fid].name).toLowerCase() === folderName.toLowerCase()) {
          return { folderId: fid, folderIconURL: folders[fid].iconURL || null };
        }
      }
    }

    // Crear nueva carpeta
    const newFolderRef = push(ref(db, 'folders'));
    const folderId = newFolderRef.key;
    let uploadedIconURL = null;

    if (folderIconFile) {
      const folderIconPath = `podcastsFolders/${folderId}/icon.jpg`;
      const folderIconRef = storageRef(storage, folderIconPath);
      await uploadBytes(folderIconRef, folderIconFile);
      uploadedIconURL = await getDownloadURL(folderIconRef);
    }

    await set(newFolderRef, {
      name: folderName,
      iconURL: uploadedIconURL || null,
      createdBy: currentUser ? currentUser.uid : null,
      createdAt: Date.now()
    });

    return { folderId, folderIconURL: uploadedIconURL };
  } catch (e) {
    console.warn('ensureFolder error, continuing sin carpeta:', e);
    return { folderId: null, folderIconURL: null };
  }
}

// Save podcast
uploadBtn.addEventListener('click', async () => {
  if (!currentUser) {
    msg.textContent = "❌ Error: You are not logged in.";
    return;
  }

  const nombre = nameInput.value.trim();
  const descripcion = descInput.value.trim();
  const iconFile = iconInput.files[0];
  const audioFile = fileInput.files[0];

  if (!nombre || !descripcion || !iconFile || !audioFile) {
    msg.textContent = "All fields are required.";
    return;
  }

  try {
    // obtener folder si el input existe y tiene valor
    let folderId = null;
    if (folderInput && folderInput.value && folderInput.value.trim()) {
      const folderName = folderInput.value.trim();
      const folderFile = folderIconInput?.files?.[0];
      const res = await ensureFolder(folderName, folderFile);
      folderId = res.folderId;
    }

    // Generate a unique ID for the podcast using push()
    const podcastsRef = ref(db, 'podcasts');
    const newPodcastRef = push(podcastsRef); // This generates a unique ID
    const podcastId = newPodcastRef.key;

    // Upload the podcast icon
    const iconPath = `podcasts/${podcastId}/icon.jpg`;
    const iconRef = storageRef(storage, iconPath);
    await uploadBytes(iconRef, iconFile);
    const iconURL = await getDownloadURL(iconRef);

    // Upload the podcast audio
    const audioPath = `podcasts/${podcastId}/audio.mp3`;
    const audioRef = storageRef(storage, audioPath);
    await uploadBytes(audioRef, audioFile);
    const audioURL = await getDownloadURL(audioRef);

    let uploaderName = currentUser.displayName || currentUser.email || currentUser.uid;
    try {
      const userRef = ref(db, `users/${currentUser.uid}`);
      const userSnap = await get(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.val();
        uploaderName = userData.username || userData.displayName || currentUser.displayName || currentUser.email || currentUser.uid;
      }
    } catch (e) {
      console.warn('No se pudo leer users/{uid} para uploaderName, usando fallback', e);
    }

    await set(newPodcastRef, {
      nombre: nombre,
      descripcion: descripcion,
      iconURL: iconURL,
      audioURL: audioURL,
      idcreador: currentUser.uid,
      uploaderName: uploaderName,
      folderId: folderId || null,
      createdAt: Date.now()
    });

    msg.textContent = "✅ Podcast saved successfully!";
    nameInput.value = '';
    descInput.value = '';
    iconInput.value = '';
    fileInput.value = '';
  } catch (err) {
    console.error(err);
    msg.textContent = `❌ Error saving podcast: ${err.message}`;
  }
});

// Botones de navegación
loginBtn.addEventListener('click', () => window.location.href = 'login.html');

// Nuevo botón para ir a la pestaña de ver podcasts
const viewPodcastsBtn = document.getElementById('viewPodcastsBtn');
viewPodcastsBtn.addEventListener('click', () => {
  window.location.href = 'podcast.html'; // Redirige a la página de ver podcasts
});
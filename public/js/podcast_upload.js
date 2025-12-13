import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getDatabase, ref, push, set, get, update } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";

// Firebase configuration (single source)
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

// Reuse existing app if present
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const storage = getStorage(app);

// DOM elements (may be null until DOM ready)
let nameInput, descInput, iconInput, fileInput, uploadBtn, msg, formContainer, loginBtn;
let folderInput, folderIconInput, folderSelect, hiddenFolderInput, viewPodcastsBtn;

let currentUser = null;

function bindDomElements() {
  nameInput = document.getElementById('podcastName');
  descInput = document.getElementById('podcastDesc');
  iconInput = document.getElementById('podcastIcon');
  fileInput = document.getElementById('podcastFile');
  uploadBtn = document.getElementById('uploadBtn');
  msg = document.getElementById('msg');
  formContainer = document.getElementById('formContainer');
  loginBtn = document.getElementById('loginBtn');

  // carpeta: puede ser un select (folderSelect) o input libre (podcastFolder)
  folderInput = document.getElementById('podcastFolder'); // optional name-based input
  folderIconInput = document.getElementById('folderIcon'); // optional
  folderSelect = document.getElementById('folderSelect'); // preferred select
  hiddenFolderInput = document.getElementById('podcastFolderId'); // hidden id field
  viewPodcastsBtn = document.getElementById('viewPodcastsBtn');
}

// Poblar select de carpetas (si existe). Si uid pasado, filtra solo carpetas del usuario (como en profile.js).
// Excepto cuenta master que ve todas.
async function populateFolderSelect(uid = null) {
  if (!folderSelect) return;
  folderSelect.innerHTML = '<option value="">-- No folder --</option>';
  try {
    const snap = await get(ref(db, 'folders'));
    if (!snap.exists()) return;
    const folders = snap.val();
    
    // Detectar si es master (misma cuenta que tiene header dorado)
    const isMaster = currentUser && currentUser.email && currentUser.email.toLowerCase() === "teamprojectgrupoc@gmail.com";
    
    for (const fid in folders) {
      if (!Object.prototype.hasOwnProperty.call(folders, fid)) continue;
      const f = folders[fid];
      // Si NO es master, filtrar solo carpetas del usuario
      if (!isMaster && uid && f.createdBy && String(f.createdBy) !== String(uid)) continue;
      const opt = document.createElement('option');
      opt.value = fid;
      opt.textContent = f.name || `(folder ${fid})`;
      folderSelect.appendChild(opt);
    }
  } catch (err) {
    console.error('Error loading folders for select:', err);
  }

  // sincronizar hidden input con la selección
  if (hiddenFolderInput) {
    folderSelect.addEventListener('change', () => {
      hiddenFolderInput.value = folderSelect.value || '';
    });
  } else {
    // si no hay hidden input, mantener dataset
    folderSelect.addEventListener('change', () => {});
  }
}

// Asegurar carpeta por nombre (copia de la lógica existente: buscar o crear)
async function ensureFolder(folderName, folderIconFile) {
  if (!folderName) return { folderId: null, folderIconURL: null };
  try {
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

    const newFolderRef = push(ref(db, 'folders'));
    const folderId = newFolderRef.key;
    let uploadedIconURL = null;
    if (folderIconFile) {
      const folderIconPath = `podcastsFolders/${folderId}/icon.jpg`;
      const fRef = storageRef(storage, folderIconPath);
      await uploadBytes(fRef, folderIconFile);
      uploadedIconURL = await getDownloadURL(fRef);
    }

    await set(newFolderRef, {
      name: folderName,
      iconURL: uploadedIconURL || null,
      createdBy: currentUser ? currentUser.uid : null,
      createdAt: Date.now()
    });

    return { folderId, folderIconURL: uploadedIconURL };
  } catch (e) {
    console.warn('ensureFolder error:', e);
    return { folderId: null, folderIconURL: null };
  }
}

// Handler de subida: usa el folder seleccionado (select) si existe, si no lee folderInput (nombre)
async function handleUpload() {
  if (!currentUser) {
    if (msg) msg.textContent = "❌ Error: You are not logged in.";
    return;
  }

  const nombre = nameInput?.value?.trim();
  const descripcion = descInput?.value?.trim();
  const iconFile = iconInput?.files?.[0];
  const audioFile = fileInput?.files?.[0];

  if (!nombre || !descripcion || !iconFile || !audioFile) {
    if (msg) msg.textContent = "All fields are required.";
    return;
  }

  try {
    // obtener folderId: prioridad select -> hidden -> input nombre (crear si necesario)
    let folderId = null;
    if (folderSelect && folderSelect.value) {
      folderId = folderSelect.value || null;
    } else if (hiddenFolderInput && hiddenFolderInput.value) {
      folderId = hiddenFolderInput.value || null;
    } else if (folderInput && folderInput.value.trim()) {
      const folderName = folderInput.value.trim();
      const folderFile = folderIconInput?.files?.[0];
      const res = await ensureFolder(folderName, folderFile);
      folderId = res.folderId;
    }

    // crear entry del podcast
    const podcastsRef = ref(db, 'podcasts');
    const newPodcastRef = push(podcastsRef);
    const podcastId = newPodcastRef.key;

    // subir icon
    const iconPath = `podcasts/${podcastId}/icon.jpg`;
    const iconRef = storageRef(storage, iconPath);
    await uploadBytes(iconRef, iconFile);
    const iconURL = await getDownloadURL(iconRef);

    // subir audio
    const audioPath = `podcasts/${podcastId}/audio.mp3`;
    const audioRef = storageRef(storage, audioPath);
    await uploadBytes(audioRef, audioFile);
    const audioURL = await getDownloadURL(audioRef);

    // obtener uploaderName
    let uploaderName = currentUser.displayName || currentUser.email || currentUser.uid;
    try {
      const userRef = ref(db, `users/${currentUser.uid}`);
      const userSnap = await get(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.val();
        uploaderName = userData.username || userData.displayName || uploaderName;
      }
    } catch (e) {
      console.warn('No se pudo leer users/{uid} para uploaderName', e);
    }

    await set(newPodcastRef, {
      nombre,
      descripcion,
      iconURL,
      audioURL,
      idcreador: currentUser.uid,
      uploaderName,
      folderId: folderId || null,
      createdAt: Date.now()
    });

    if (msg) msg.textContent = "✅ Podcast saved successfully!";
    if (nameInput) nameInput.value = '';
    if (descInput) descInput.value = '';
    if (iconInput) iconInput.value = '';
    if (fileInput) fileInput.value = '';
    // actualizar select disponible por si se creó carpeta nueva
    await populateFolderSelect(currentUser.uid);
  } catch (err) {
    console.error(err);
    if (msg) msg.textContent = `❌ Error saving podcast: ${err.message || err}`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  bindDomElements();

  // listeners
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    // Poblar carpetas filtradas por usuario (o todas si es master)
    populateFolderSelect(user ? user.uid : null).catch(e => console.error(e));

    if (msg && formContainer && loginBtn) {
      if (user) {
        msg.textContent = `✅ Logged in as ${user.email}`;
        if (formContainer) formContainer.style.display = 'block';
        if (loginBtn) loginBtn.style.display = 'none';
      } else {
        msg.textContent = "⚠️ You must be logged in to upload a podcast.";
        if (formContainer) formContainer.style.display = 'none';
        if (loginBtn) loginBtn.style.display = 'inline-block';
      }
    }
  });

  if (uploadBtn) uploadBtn.addEventListener('click', (e) => { e.preventDefault(); handleUpload(); });
  if (loginBtn) loginBtn.addEventListener('click', () => window.location.href = 'login.html');
  if (viewPodcastsBtn) viewPodcastsBtn.addEventListener('click', () => window.location.href = 'podcast.html');
});
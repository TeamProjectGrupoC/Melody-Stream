import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  push,
  set,
  get
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCCWExxM4ACcvnidBWMfBQ_CJk7KimIkns",
  authDomain: "melodystream123.firebaseapp.com",
  databaseURL:
    "https://melodystream123-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "melodystream123",
  storageBucket: "melodystream123.firebasestorage.app",
  messagingSenderId: "640160988809",
  appId: "1:640160988809:web:d0995d302123ccf0431058",
  measurementId: "G-J97KEDLYMB"
};

if (!getApps().length) initializeApp(firebaseConfig);
const auth = getAuth();
const db = getDatabase();
const storage = getStorage();

const folderNameInput = document.getElementById("folderName");
const folderIconInput = document.getElementById("folderIcon");
const saveBtn = document.getElementById("saveFolderBtn");
const cancelBtn = document.getElementById("cancelFolderBtn");
const msg = document.getElementById("folderMsg");

if (!saveBtn || !folderNameInput || !msg) {
  console.warn("folder_upload.js: faltan elementos DOM (folderName/saveFolderBtn/folderMsg)");
}

// control de sesión
let currentUser = null;
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (saveBtn) saveBtn.disabled = !user;
  if (!user && msg) msg.textContent = "You must be logged in to create a folder.";
  if (user && msg) msg.textContent = "";
});

// cancelar
if (cancelBtn) cancelBtn.addEventListener("click", () => window.location.href = "podcast.html");

// helper: crea carpeta (o error)
async function createFolder(name, iconFile) {
  if (!name) throw new Error("Folder name required");
  // comprobar existencia por nombre (case-insensitive)
  const foldersRef = ref(db, "folders");
  const snap = await get(foldersRef);
  if (snap.exists()) {
    const folders = snap.val();
    for (const fid in folders) {
      if (String(folders[fid].name).toLowerCase() === name.toLowerCase()) {
        throw new Error("A folder with that name already exists.");
      }
    }
  }

  const newFolderRef = push(ref(db, "folders"));
  const folderId = newFolderRef.key;
  let iconURL = null;

  if (iconFile) {
    // sube el icono en Storage bajo la carpeta "folders/{folderId}/icon.jpg"
    const iconPath = `folders/${folderId}/icon.jpg`;
    const iconRef = storageRef(storage, iconPath);
    await uploadBytes(iconRef, iconFile);
    iconURL = await getDownloadURL(iconRef);
  }

  await set(newFolderRef, {
    name,
    iconURL: iconURL || null,
    createdBy: currentUser ? currentUser.uid : null,
    createdAt: Date.now()
  });

  return { folderId, iconURL };
}

// handler del botón
if (saveBtn) {
  saveBtn.addEventListener("click", async () => {
    msg.textContent = "Creating folder...";
    try {
      if (!currentUser) {
        msg.textContent = "You must be logged in.";
        return window.location.href = "login.html";
      }
      const name = folderNameInput.value.trim();
      const iconFile = folderIconInput?.files?.[0] || null;
      const res = await createFolder(name, iconFile);
      msg.textContent = "Folder created.";
      console.log("Folder created:", res);
      setTimeout(() => window.location.href = "podcast.html", 700);
    } catch (err) {
      console.error("create folder error:", err);
      // mostrar mensaje detallado para depuración
      msg.textContent = "Error creating folder: " + (err.message || err.toString());
    }
  });
}
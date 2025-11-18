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
  measurementId: "G-J97KEDLYMB",
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

let currentUser = null;

// require login to create folder
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (!user) {
    msg.textContent = "You must be logged in to create a folder.";
    if (saveBtn) saveBtn.disabled = true;
  } else {
    msg.textContent = "";
    if (saveBtn) saveBtn.disabled = false;
  }
});

if (cancelBtn) {
  cancelBtn.addEventListener("click", () => {
    window.location.href = "podcast.html";
  });
}

if (saveBtn) {
  saveBtn.addEventListener("click", async () => {
    if (!currentUser) {
      window.location.href = "login.html";
      return;
    }

    const name = folderNameInput.value.trim();
    if (!name) {
      msg.textContent = "Folder name is required.";
      return;
    }

    try {
      // check existing folder by name (case-insensitive)
      const foldersRef = ref(db, "folders");
      const foldersSnap = await get(foldersRef);
      if (foldersSnap.exists()) {
        const folders = foldersSnap.val();
        for (const fid in folders) {
          if (String(folders[fid].name).toLowerCase() === name.toLowerCase()) {
            msg.textContent = "A folder with that name already exists.";
            return;
          }
        }
      }

      const newFolderRef = push(ref(db, "folders"));
      const folderId = newFolderRef.key;
      let iconURL = null;

      const iconFile = folderIconInput?.files?.[0];
      if (iconFile) {
        const iconPath = `podcastsFolders/${folderId}/icon.jpg`;
        const iconRef = storageRef(storage, iconPath);
        await uploadBytes(iconRef, iconFile);
        iconURL = await getDownloadURL(iconRef);
      }

      await set(newFolderRef, {
        name,
        iconURL: iconURL || null,
        createdBy: currentUser.uid,
        createdAt: Date.now()
      });

      msg.textContent = "Folder created.";
      // go back to podcasts list
      setTimeout(() => (window.location.href = "podcast.html"), 700);
    } catch (err) {
      console.error(err);
      msg.textContent = "Error creating folder.";
    }
  });
}
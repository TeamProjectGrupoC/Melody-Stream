// Firabase App initialization
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";

// Firebase authentication functions
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

// Firebase Realtime Database functions
import { getDatabase, ref, push, set, get } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

// Firebase Storage functions
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";

// Firebase configuration
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

if (!getApps().length) initializeApp(firebaseConfig); // Initialize Firebase if not already initialized
const auth = getAuth();
const db = getDatabase();
const storage = getStorage();

const folderNameInput = document.getElementById("folderName");
const folderIconInput = document.getElementById("folderIcon");
const saveBtn = document.getElementById("saveFolderBtn");
const cancelBtn = document.getElementById("cancelFolderBtn");
const msg = document.getElementById("folderMsg");

let currentUser = null;

// To verify if user is logged in
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  // If user is not logged in and the save button exists, disable it
  if (saveBtn) saveBtn.disabled = !user;
  // Show message if not logged in
  if (!user && msg) msg.textContent = "You must be logged in to create a folder.";
});

// Cancel button moves back to podcast page
if (cancelBtn) cancelBtn.addEventListener("click", () => window.location.href = "podcast.html");

// Function to create a new folder
async function createFolder(name, iconFile) {
  if (!name) throw new Error("Folder name required");
  // Check for duplicate folder names
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

  // If icon file provided, upload to Storage
  if (iconFile) {
    // Upload the icon to Storage under the folder "folders/{folderId}/icon.jpg"
    const iconPath = `folders/${folderId}/icon.jpg`;
    const iconRef = storageRef(storage, iconPath);
    await uploadBytes(iconRef, iconFile);
    iconURL = await getDownloadURL(iconRef);
  }

  // Save folder metadata to Realtime Database
  await set(newFolderRef, {
    name,
    iconURL: iconURL || null,
    createdBy: currentUser ? currentUser.uid : null,
    createdAt: Date.now()
  });

  return { folderId, iconURL };
}

// Save button handler to create folder
if (saveBtn) {
  saveBtn.addEventListener("click", async () => {
    msg.textContent = "Creating folder...";
    try {
      // User must be logged in
      if (!currentUser) {
        msg.textContent = "You must be logged in.";
        return window.location.href = "login.html";
      }
      const name = folderNameInput.value.trim();
      const iconFile = folderIconInput?.files?.[0] || null;
      const res = await createFolder(name, iconFile);
      msg.textContent = "Folder created.";
      console.log("Folder created:", res);
      // Redirect back to podcast page after a short delay
      setTimeout(() => window.location.href = "podcast.html", 700);
    } 
    catch (err) {
      console.error("create folder error:", err);
      msg.textContent = "Error creating folder: " + (err.message || err.toString());
    }
  });
}
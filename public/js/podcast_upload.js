/**
 * ============================================================================
 * PODCAST UPLOAD CONTROLLER
 * ============================================================================
 * This module handles the process of uploading new podcasts to the platform.
 * It manages file uploads to Firebase Storage (Audio & Icons) and saves metadata 
 * to the Realtime Database, linked to specific user-created folders.
 *
 * * KEY FUNCTIONALITIES:
 *
 * 1. Initialization & Auth:
 * - Initializes Firebase services.
 * - Listens for authentication state (`onAuthStateChanged`).
 * - Security: Hides the upload form if the user is not logged in.
 *
 * 2. populateFolderSelect(uid) [Async]:
 * - Fetches available folders from `/folders` in the Realtime DB.
 * - Filtering Logic: 
 * > "Master User" (Admin) sees ALL folders.
 * > Regular Users see ONLY folders created by themselves (`createdBy === uid`).
 * - Dynamically populates the `<select>` dropdown.
 *
 * 3. handleUpload() [Async]:
 * - Validation: Checks that all fields (Name, Description, Icon, Audio) are filled.
 * - Storage Uploads:
 * > Uploads Icon -> `podcasts/{podcastId}/icon.jpg`
 * > Uploads Audio -> `podcasts/{podcastId}/audio.mp3`
 * - Database Record: 
 * > Creates a new entry in `/podcasts` with metadata (URLs, uploader ID, folder ID).
 * - UX: Displays success/error messages and clears the form upon success.
 * ============================================================================
 */
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
  databaseURL: "https://melodystream123-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "melodystream123",
  storageBucket: "melodystream123.firebasestorage.app",
  messagingSenderId: "640160988809",
  appId: "1:640160988809:web:d0995d302123ccf0431058",
  measurementId: "G-J97KEDLYMB"
};

// Initialize Firebase if not already initialized
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const storage = getStorage(app);

// DOM elements 
let nameInput, descInput, iconInput, fileInput, uploadBtn, msg, formContainer, loginBtn;
let folderSelect, viewPodcastsBtn;

let currentUser = null;

// Bind DOM elements
function bindDomElements() {
  nameInput = document.getElementById('podcastName');
  descInput = document.getElementById('podcastDesc');
  iconInput = document.getElementById('podcastIcon');
  fileInput = document.getElementById('podcastFile');
  uploadBtn = document.getElementById('uploadBtn');
  msg = document.getElementById('msg');
  formContainer = document.getElementById('formContainer');
  loginBtn = document.getElementById('loginBtn');
  folderSelect = document.getElementById('folderSelect');
  viewPodcastsBtn = document.getElementById('viewPodcastsBtn');
}

// Populate folder select options
async function populateFolderSelect(uid = null) {
  if (!folderSelect) return;
  // Default option
  folderSelect.innerHTML = '<option value="">-- No folder --</option>';
  try {
    const snap = await get(ref(db, 'folders'));
    if (!snap.exists()) return;
    const folders = snap.val();
    
    // If user is master, show all folders
    const isMaster = currentUser && currentUser.email && currentUser.email.toLowerCase() === "teamprojectgrupoc@gmail.com";
    
    for (const fid in folders) {
      const f = folders[fid];
      // If not master, filter only user's folders
      if (!isMaster && uid && f.createdBy && String(f.createdBy) !== String(uid)) continue;
      const opt = document.createElement('option');
      opt.value = fid;
      opt.textContent = f.name || `(folder ${fid})`;
      folderSelect.appendChild(opt);
    }
  } catch (err) {
    //console.error('Error loading folders for select:', err);
  }
}

// Handle podcast upload
async function handleUpload() {
  if (!currentUser) {
    if (msg) msg.textContent = "❌ Error: You are not logged in.";
    return;
  }

  const nombre = nameInput?.value?.trim(); // Podcast name
  const descripcion = descInput?.value?.trim(); // Podcast description
  const iconFile = iconInput?.files?.[0];
  const audioFile = fileInput?.files?.[0];

  if (!nombre || !descripcion || !iconFile || !audioFile) {
    if (msg) msg.textContent = "All fields are required.";
    return;
  }

  try {
    // Obtain selected folder ID
    const folderId = folderSelect?.value || null;

    // Create podcast entry in Realtime Database
    const podcastsRef = ref(db, 'podcasts');
    const newPodcastRef = push(podcastsRef);
    const podcastId = newPodcastRef.key;

    // Upload icon to Storage
    const iconPath = `podcasts/${podcastId}/icon.jpg`;
    const iconRef = storageRef(storage, iconPath);
    await uploadBytes(iconRef, iconFile);
    const iconURL = await getDownloadURL(iconRef);

    // Upload audio to Storage
    const audioPath = `podcasts/${podcastId}/audio.mp3`;
    const audioRef = storageRef(storage, audioPath);
    await uploadBytes(audioRef, audioFile);
    const audioURL = await getDownloadURL(audioRef);

    // Obtain uploader name from user profile
    let uploaderName = currentUser.displayName;

    // Save podcast metadata to Realtime Database
    await set(newPodcastRef, {
      nombre, // Podcast name
      descripcion, // Podcast description
      iconURL,
      audioURL,
      idcreador: currentUser.uid, // Uploader UID
      uploaderName,
      folderId: folderId || null,
      createdAt: Date.now()
    });

    if (msg) msg.textContent = "✅ Podcast saved successfully!";
    // Clear form
    if (nameInput) nameInput.value = '';
    if (descInput) descInput.value = '';
    if (iconInput) iconInput.value = '';
    if (fileInput) fileInput.value = '';
    // Refresh folder select
    await populateFolderSelect(currentUser.uid);
  } catch (err) {
    //console.error(err);
    if (msg) msg.textContent = `❌ Error saving podcast: ${err.message || err}`;
  }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  // Bind DOM elements
  bindDomElements();

  // Check if user is logged in
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    // Populate folder select based on user (to show only their folders)
    populateFolderSelect(user ? user.uid : null)
      .catch(err => {
        // console.error(err);
      });
      
    if (msg && formContainer && loginBtn) {
      // If user is logged in, show form, else show login prompt
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

  // Button event listeners
  if (uploadBtn) uploadBtn.addEventListener('click', (e) => { e.preventDefault(); handleUpload(); });
  if (loginBtn) loginBtn.addEventListener('click', () => window.location.href = 'login.html');
  if (viewPodcastsBtn) viewPodcastsBtn.addEventListener('click', () => window.location.href = 'podcast.html');
});
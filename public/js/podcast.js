/**
 * ============================================================================
 * PODCAST & FOLDER MANAGEMENT CONTROLLER
 * ============================================================================
 * * OVERVIEW:
 * This is the central logic for the "Podcasts" page. It handles:
 * - Fetching and displaying podcasts and folders from Firebase Realtime Database.
 * - Managing playback (HTML5 Audio) and visual presentation (Cards).
 * - "Master User" privileges (Deleting content).
 * - Social sharing features (Direct messaging of podcasts).
 *
 * * KEY FUNCTIONALITIES:
 *
 * 1. Data Loading & Display:
 * - loadFolders() & listPodcasts(): Fetches data from `/folders` and `/podcasts`.
 * - usersMap: Caches user data to display readable "Uploaded by [Username]" names instead of raw UIDs.
 * - openFolderModal(folderId): Filters global podcasts to show only those belonging 
 * to a specific folder within a modal view.
 *
 * 2. Role-Based Access Control (RBAC):
 * - isMasterUser(): Checks if the current user is the admin ("teamprojectgrupoc@gmail.com").
 * - Admin Powers: Only the Master User sees "Delete" buttons for podcasts and folders.
 * - Regular Users: Can only View and Share content.
 *
 * 3. Content Deletion Logic:
 * - deletePodcast(): Removes the DB entry AND deletes associated files (Audio/Icon) from Storage.
 * - deleteFolder(): Removes the folder and updates all contained podcasts to have `folderId: null` 
 * (orphaning them back to the main list rather than deleting them).
 *
 * 4. Sharing System (promptSharePodcast):
 * - Opens a custom "User Select Modal" listing all registered users.
 * - Upon selection, creates a new Chat or appends to an existing one.
 * - Sends a structured "Attachment Message" containing the podcast metadata.
 *
 * 5. Search & Filtering:
 * - Client-side filtering of the podcast list based on the search input query.
 * ============================================================================
 */
// Firabase App initialization
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";

// Firebase authentication functions
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

// Firebase Realtime Database functions
import { getDatabase, ref, push, set, get, remove, update } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

// Firebase Storage functions
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";

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
  measurementId: "G-J97KEDLYMB",
};

// Firebase Initialization
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const storage = getStorage(app);
const auth = getAuth(app);

// Get the containers
const resultsTitle = document.getElementById("resultsTitle");
const resultsList  = document.getElementById("resultsList");
const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");

// Global variables
let allPodcasts = {};
let allFolders = {};
let currentUser = null;
let usersMap = {};

// Check if user is logged in
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  const uploadBtn = document.getElementById("uploadPodcastBtn") || document.getElementById("goToUpload");
  if (uploadBtn) {
    // Enable or disable upload button based on auth state
    if (user) {
      uploadBtn.title = "Upload a new podcast";
      uploadBtn.disabled = false;
    } else {
      uploadBtn.title = "You must log in to upload";
      uploadBtn.disabled = false;
    }
  }

  // Reload podcasts to show uploader info properly
  listPodcasts().catch(e => console.error('Error reloading podcasts after auth change:', e));
});

// Load users map
async function loadUsersMap() {
  try {
    const usersRef = ref(db, 'users');
    const snap = await get(usersRef);
    usersMap = snap.exists() ? snap.val() : {};
  } catch (err) {
    console.error('Error loading users map:', err);
    usersMap = {};
  }
}

// Load and display folders
async function loadFolders() {
  try {
    const foldersRef = ref(db, "folders");
    const snapshot = await get(foldersRef);
    allFolders = snapshot.exists() ? snapshot.val() : {};
  } catch (error) {
    console.error("Error loading folders:", error);
    allFolders = {};
  }
}


// Check if current user is master
function isMasterUser() {
  if (currentUser && currentUser.email && currentUser.email.toLowerCase() === "teamprojectgrupoc@gmail.com") {
    return true;
  }
  return false;
}

// Get uploader  name
function getUploaderDisplayName(podcast) {
  if (podcast.uploaderName) return podcast.uploaderName;
  if (podcast.idcreador && usersMap[podcast.idcreador]) {
    const u = usersMap[podcast.idcreador];
    return u.username || u.displayName || u.email || podcast.idcreador;
  }
  if (podcast.idcreador) return podcast.idcreador;
  return null;
}

// Create delete button
function makeDeleteButton(onClick) {
  const btn = document.createElement("button");
  btn.textContent = "Delete";
  btn.className = "btn btn-outline-danger mt-3";
  // Confirm before deleting (for safety)
  btn.addEventListener("click", () => {
    if (!isMasterUser()) return alert("You are not allowed to delete this podcast.");
    onClick();
  });
  return btn;
}

// Create share button
function makeShareButton(podcastId, podcast) {
  const btn = document.createElement("button");
  btn.textContent = "Share";
  btn.className = "btn btn-outline-primary mt-2";
  btn.addEventListener("click", () => {
    promptSharePodcast(podcastId, podcast);
  });
  return btn;
}

// Build podcast card element
function buildPodcastCard(podcastId, podcast, options = {}) {
  const { showDelete = false, onDelete = null } = options;

  const podcastItem = document.createElement("div");
  podcastItem.classList.add("podcast-card");

  // Podcast icon
  const img = document.createElement("img");
  img.src = podcast.iconURL || "images/logos/silueta.png";
  img.alt = `${podcast.nombre || "podcast"} icon`;
  podcastItem.appendChild(img);

  // Podcast title
  const title = document.createElement("h3");
  title.textContent = podcast.nombre || "(No title)";
  podcastItem.appendChild(title);

  // Uploader info
  const displayName = getUploaderDisplayName(podcast);
  if (displayName) {
    const uploader = document.createElement("div");
    uploader.className = "podcast-uploader";
    uploader.textContent = `Uploaded by: ${displayName}`;
    podcastItem.appendChild(uploader);
  }

  // Description
  if (podcast.descripcion) {
    const desc = document.createElement("p");
    desc.textContent = podcast.descripcion;
    podcastItem.appendChild(desc);
  }

  // Audio player
  if (podcast.audioURL) {
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.src = podcast.audioURL;
    podcastItem.appendChild(audio);
  }

  // Delete button (only for master)
  if (showDelete && onDelete) {
    podcastItem.appendChild(makeDeleteButton(onDelete));
  }

  podcastItem.appendChild(makeShareButton(podcastId, podcast));

  return podcastItem;
}

// Open modal with podcasts from folder
async function openFolderModal(folderId, folderName) {
  const modal = document.getElementById("folder-modal");
  const title = document.getElementById("folder-modal-title");
  const list = document.getElementById("folder-podcast-list");

  if (!modal || !title || !list) return;

  modal.style.display = "flex";
  title.textContent = `Podcasts in: ${folderName}`;
  list.innerHTML = "Loading...";

  // Filter podcasts by folderId
  const folderPodcasts = {};
  for (const pid in allPodcasts) {
    const p = allPodcasts[pid];
    if (String(p.folderId) === String(folderId) || String(p.idcarpeta) === String(folderId)) {
      folderPodcasts[pid] = p;
    }
  }

  list.innerHTML = "";

  // If there are no podcasts in the folder, show message
  if (Object.keys(folderPodcasts).length === 0) {
    const emptyMsg = document.createElement("p");
    emptyMsg.className = "modal-empty-message";
    emptyMsg.textContent = "No podcasts in this folder.";
    list.appendChild(emptyMsg);
    return;
  }

  const master = isMasterUser();

  // Build podcast cards
  for (const pid in folderPodcasts) {
    const podcast = folderPodcasts[pid];
    const card = buildPodcastCard(pid, podcast, {
      showDelete: master,
      onDelete: () => deletePodcast(pid, podcast.audioURL, podcast.iconURL),
    });
    list.appendChild(card);
  }
}

// Close modal button
document.getElementById("folder-modal-close")?.addEventListener("click", () => {
  const modal = document.getElementById("folder-modal");
  if (modal) modal.style.display = "none";
});

// Close modal when clicking outside content
document.getElementById("folder-modal")?.addEventListener("click", (e) => {
  if (e.target.id === "folder-modal") {
    e.target.style.display = "none";
  }
});

// Load and display podcasts
async function listPodcasts() {
  try {
    await loadUsersMap();

    const podcastsRef = ref(db, "podcasts");
    const snapshot = await get(podcastsRef);

    allPodcasts = snapshot.exists() ? snapshot.val() : {};
  } catch (error) {
    console.error("Error listing podcasts:", error);
    allPodcasts = {};
  }
}

// Display podcasts
function displayPodcasts(podcasts) {
  podcastList.innerHTML = "";
  const master = isMasterUser();

  for (const podcastId in podcasts) {
    const podcast = podcasts[podcastId];
    const card = buildPodcastCard(podcastId, podcast, {
      showDelete: master,
      onDelete: () => deletePodcast(podcastId, podcast.audioURL, podcast.iconURL),
    });
    podcastList.appendChild(card);
  }

  if (podcastList.children.length === 0) {
    podcastList.innerHTML = "<p>No podcasts available.</p>";
  }
}

// Delete podcast
async function deletePodcast(podcastId, audioURL, iconURL) {
  const confirmDelete = confirm(
    `Are you sure you want to delete the podcast "${podcastId}"?`
  );
  if (!confirmDelete) return;

  try {
    // Delete audio and icon from Storage
    if (audioURL) {
      const audioRef = storageRef(storage, audioURL);
      await deleteObject(audioRef);
    }
    if (iconURL) {
      const iconRef = storageRef(storage, iconURL);
      await deleteObject(iconRef);
    }

    // Delete podcast entry from Realtime Database
    const podcastRef = ref(db, `podcasts/${podcastId}`);
    await remove(podcastRef);

    // Update local state and UI
    delete allPodcasts[podcastId];
    displayPodcasts(allPodcasts);

    alert(`Podcast "${podcastId}" deleted successfully.`);
  } catch (error) {
    console.error("Error deleting podcast:", error);
    alert("Failed to delete the podcast.");
  }
}

// Share podcast
async function promptSharePodcast(podcastId, podcast) {
  if (!currentUser) return alert("Log in to share.");

  try {
    const usersRef = ref(db, "users");
    const snap = await get(usersRef);
    if (!snap.exists()) return alert("No users found.");
    const users = snap.val();

    const usersArray = [];
    for (const uid in users) {
      if (uid === currentUser.uid) continue;
      usersArray.push({ uid, username: users[uid].username || users[uid].email || '(no name)', email: users[uid].email || '' });
    }

    // There must be at least one other user to share with
    if (usersArray.length === 0) return alert('No other users to share with.');

    // Open user selection modal
    openUserSelectModal(usersArray, async (recipientUid) => {
      if (!recipientUid) return;

      const attachment = {
        type: "podcast",
        id: podcastId,
        title: podcast.nombre,
        author: podcast.autor || '',
        imageURL: podcast.iconURL,
        audioURL: podcast.audioURL,
        source: "melodystream"
      };

      try {
        await shareToUser(recipientUid, attachment);
        alert("Podcast shared successfully.");
      } catch (err) {
        console.error(err);
        alert("Error sharing podcast.");
      }
    });

  } catch (err) {
    console.error(err);
    alert("Error sharing podcast.");
  }
}

// User selection modal
function openUserSelectModal(usersArray, onSelect) {
  const overlay = document.createElement('div');
  overlay.className = 'user-select-overlay';

  const box = document.createElement('div');
  box.className = 'user-select-box';

  const title = document.createElement('h3');
  title.textContent = 'Select a user';
  box.appendChild(title);

  const list = document.createElement('ul');
  list.className = 'user-select-list';

  usersArray.forEach(u => {
    const li = document.createElement('li');
    li.className = 'user-select-item';

    const info = document.createElement('div');
    info.className = 'user-select-info';
    info.innerHTML = `<strong>${escapeHtml(u.username)}</strong><div class="user-select-email">${escapeHtml(u.email)}</div>`;

    const btn = document.createElement('button');
    btn.textContent = 'Share';
    btn.className = 'btn user-select-btn';
    btn.addEventListener('click', () => {
      document.body.removeChild(overlay);
      onSelect(u.uid);
    });

    li.appendChild(info);
    li.appendChild(btn);
    list.appendChild(li);
  });

  box.appendChild(list);

  const cancel = document.createElement('button');
  cancel.textContent = 'Cancel';
  cancel.className = 'btn user-select-cancel';
  cancel.addEventListener('click', () => {
    document.body.removeChild(overlay);
    onSelect(null);
  });
  box.appendChild(cancel);

  overlay.appendChild(box);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      document.body.removeChild(overlay);
      onSelect(null);
    }
  });

  document.body.appendChild(overlay);
}

// To escape HTML special characters
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function (m) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[m]); });
}

// Share to user function
async function shareToUser(recipientUid, attachment) {
  // User must be logged in
  if (!currentUser) return alert("you must log in.");
  const senderUid = currentUser.uid;
  const chatId = senderUid < recipientUid ? `${senderUid}_${recipientUid}` : `${recipientUid}_${senderUid}`;

  const messagesRef = ref(db, `chats/${chatId}/messages`);
  const chatRef = ref(db, `chats/${chatId}`);
  const timestamp = Date.now();

  const newMessage = {
    sender: senderUid,
    text: '',
    timestamp,
    attachment
  };

  const newKey = push(messagesRef).key;
  await update(chatRef, {
    [`messages/${newKey}`]: newMessage,
    createdAt: timestamp,
    users: {
      [senderUid]: true,
      [recipientUid]: true
    }
  });

  const lastMessageData = {
    sender: senderUid,
    text: `[Shared] ${attachment.title}`,
    timestamp
  };

  // Update last message for both users
  await update(ref(db, `userChats/${senderUid}/${chatId}`), { lastMessage: lastMessageData });
  await update(ref(db, `userChats/${recipientUid}/${chatId}`), { lastMessage: lastMessageData });
}

function getSearchType() {
  return document.querySelector('input[name="searchType"]:checked')?.value || "podcasts";
}

function clearResults() {
  if (resultsList) resultsList.innerHTML = "";
  if (resultsTitle) resultsTitle.style.display = "none";
}

function showResultsHeader(text) {
  if (!resultsTitle) return;
  resultsTitle.style.display = "block";
  resultsTitle.textContent = text;
}

function norm(s) {
  return (s || "").toString().toLowerCase().trim();
}

function scoreMatch(query, text) {
  const q = norm(query);
  const t = norm(text);
  if (!q || !t) return 999999;
  if (t === q) return 0;
  if (t.startsWith(q)) return 5;
  const idx = t.indexOf(q);
  if (idx >= 0) return 20 + idx;
  const parts = q.split(/\s+/).filter(Boolean);
  if (parts.length > 1 && parts.every(p => t.includes(p))) return 80;
  return 999999;
}

function pickTop8(scoredItems) {
  return scoredItems
    .sort((a, b) => a.score - b.score)
    .slice(0, 8)
    .map(x => x.item);
}

function renderNoResults(msg) {
  if (!resultsList) return;
  resultsList.innerHTML = `<p style="opacity:.7;text-align:center;">${msg}</p>`;
}

function searchPodcasts(query) {
  const q = norm(query);
  if (!q) return clearResults();

  const master = isMasterUser();
  const scored = [];

  for (const podcastId in allPodcasts) {
    const p = allPodcasts[podcastId];
    if (!p) continue;

    const uploaderName = getUploaderDisplayName(p) || "";

    const matchName = scoreMatch(q, uploaderName);

    if (matchName < 999999) scored.push({ score: matchName, item: { id: podcastId, p } });
  }

  const top = pickTop8(scored);

  resultsList.innerHTML = "";

  if (top.length === 0) return renderNoResults("No podcasts found.");

  top.forEach(({ id, p }) => {
    const card = buildPodcastCard(id, p, {
      showDelete: master,
      onDelete: () => deletePodcast(id, p.audioURL, p.iconURL),
    });
    resultsList.appendChild(card);
  });
}

function buildFolderCard(folderId, folder) {
  const folderItem = document.createElement("div");
  folderItem.classList.add("podcast-card");

  const img = document.createElement("img");
  img.src = folder.iconURL || "images/logos/silueta.png";
  img.alt = `${folder.name || 'Folder'} icon`;
  folderItem.appendChild(img);

  const title = document.createElement("h3");
  title.textContent = folder.name || "(No name)";
  folderItem.appendChild(title);

  let displayName = null;
  if (folder.createdBy && usersMap[folder.createdBy]) {
    const u = usersMap[folder.createdBy];
    displayName = u.username || u.displayName || u.email || folder.createdBy;
  } else if (folder.createdBy) {
    displayName = folder.createdBy;
  }

  if (displayName) {
    const creator = document.createElement("div");
    creator.className = "podcast-uploader";
    creator.textContent = `Created by: ${displayName}`;
    folderItem.appendChild(creator);
  }

  if (folder.description) {
    const description = document.createElement("p");
    description.textContent = folder.description;
    folderItem.appendChild(description);
  }

  const viewButton = document.createElement("button");
  viewButton.textContent = "View";
  viewButton.className = "btn btn-outline-primary mt-2";
  viewButton.addEventListener("click", () => {
    openFolderModal(folderId, folder.name || "Folder");
  });
  folderItem.appendChild(viewButton);

  if (isMasterUser()) {
    const deleteButton = document.createElement("button");
    deleteButton.textContent = "Delete";
    deleteButton.className = "btn btn-outline-danger mt-3";
    deleteButton.addEventListener("click", async () => {
      if (!confirm(`Are you sure you want to delete the folder "${folder.name || folderId}"?`)) return;
      try {
        await deleteFolder(folderId, folder.iconURL);
        await loadFolders();
        await listPodcasts();
        handleSearch(); // refresca lo que estás viendo
      } catch (err) {
        console.error("Error deleting folder:", err);
        alert("Failed to delete folder.");
      }
    });
    folderItem.appendChild(deleteButton);
  }

  return folderItem;
}

function searchFolders(query) {
  const q = norm(query);
  if (!q) return clearResults();

  const scored = [];

  for (const folderId in allFolders) {
    const f = allFolders[folderId];
    if (!f) continue;

    let creatorName = "";
    if (f.createdBy && usersMap[f.createdBy]) {
      const u = usersMap[f.createdBy];
      creatorName = u.username || u.displayName || u.email || f.createdBy;
    } else {
      creatorName = f.createdBy || "";
    }

    const best = Math.min(
      scoreMatch(q, f.name),
      scoreMatch(q, creatorName)
    );

    if (best < 999999) scored.push({ score: best, item: { id: folderId, f } });
  }

  const top = pickTop8(scored);

  resultsList.innerHTML = "";

  if (top.length === 0) return renderNoResults("No folders found.");

  top.forEach(({ id, f }) => {
    resultsList.appendChild(buildFolderCard(id, f));
  });
}



// Filter podcasts
function handleSearch() {
  const query = searchInput.value.trim();
  if (!query) return clearResults();

  const type = getSearchType();
  if (type === "folders") searchFolders(query);
  else searchPodcasts(query);
}


// Initialize page
document.addEventListener("DOMContentLoaded", async () => {
  clearResults();
  await loadUsersMap();
  await loadFolders();
  await listPodcasts();
});

// Search
searchButton?.addEventListener("click", handleSearch);

searchInput?.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    handleSearch();
  }
});

document.querySelectorAll('input[name="searchType"]').forEach(r => {
  r.addEventListener("change", () => {
    if (searchInput.value.trim()) handleSearch();
    else clearResults();
  });
});


// Upload button
const goToUploadButton = document.getElementById("goToUpload") || document.getElementById("uploadPodcastBtn");
if (goToUploadButton) {
  goToUploadButton.addEventListener("click", (e) => {
    if (typeof currentUser !== "undefined" && currentUser) {
      window.location.href = "podcast_upload.html";
    } else {
      window.location.href = "login.html";
    }
  });
}

// Create folder button
const createFolderBtn = document.getElementById("createFolderBtn");
if (createFolderBtn) {
  createFolderBtn.addEventListener("click", () => {
    if (currentUser) {
      window.location.href = "folder_upload.html";
    } else {
      window.location.href = "login.html";
    }
  });
}

// Delete folder function
async function deleteFolder(folderId, iconURL) {
  try {
    // Delete folder icon from Storage
    if (iconURL) {
      try {
        const iconRef = storageRef(storage, iconURL);
        await deleteObject(iconRef);
      } catch (e) {
        console.warn("Could not delete folder icon from storage (may be URL):", e);
      }
    }

    // Delete folder entry
    const folderRef = ref(db, `folders/${folderId}`);
    await remove(folderRef);

    // Clear folderId from podcasts in this folder
    for (const pid in allPodcasts) {
      if (!Object.prototype.hasOwnProperty.call(allPodcasts, pid)) continue;
      const p = allPodcasts[pid];
      if (String(p.folderId) === String(folderId) || String(p.idcarpeta) === String(folderId)) {
        try {
          const podcastRef = ref(db, `podcasts/${pid}`);
          await update(podcastRef, { folderId: null, idcarpeta: null, folderName: null });
          // Update local state
          if (allPodcasts[pid]) {
            allPodcasts[pid].folderId = null;
            allPodcasts[pid].idcarpeta = null;
            allPodcasts[pid].folderName = null;
          }
        } catch (e) {
          console.warn(`Failed to clear folderId for podcast ${pid}:`, e);
        }
      }
    }
  } catch (err) {
    throw err;
  }
}
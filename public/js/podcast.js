import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getDatabase,
  ref,
  get,
  remove,
  push,
  update,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getStorage,
  ref as storageRef,
  deleteObject,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";

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
const podcastList = document.getElementById("podcastList");
const foldersList = document.getElementById("foldersList");
const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");

let allPodcasts = {};
let allFolders = {};
let currentUser = null;
let usersMap = {};

// Auth listener
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  const uploadBtn = document.getElementById("uploadPodcastBtn") || document.getElementById("goToUpload");
  if (uploadBtn) {
    if (user) {
      uploadBtn.title = "Upload a new podcast";
      uploadBtn.disabled = false;
    } else {
      uploadBtn.title = "You must log in to upload";
      uploadBtn.disabled = false;
    }
  }

  // <-- CHANGED: re-render podcasts when auth state changes so delete buttons update
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
  if (!foldersList) return;
  foldersList.innerHTML = "Loading folders...";

  try {
    const foldersRef = ref(db, "folders");
    const snapshot = await get(foldersRef);

    if (snapshot.exists()) {
      allFolders = snapshot.val();
      displayFolders(allFolders);
    } else {
      foldersList.innerHTML = "<p>No folders available.</p>";
    }
  } catch (error) {
    console.error("Error loading folders:", error);
    foldersList.innerHTML = "<p>Failed to load folders.</p>";
  }
}

// helper: determina si el usuario actual es "master"
function isMasterUser() {
  // permite al account con ese email (header dorado) borrar todo,
  // o a cualquier usuario marcado como isMaster/role/isAdmin en usersMap
  if (!currentUser || !usersMap) return false;
  const emailMaster = currentUser.email && currentUser.email.toLowerCase() === "teamprojectgrupoc@gmail.com";
  const u = usersMap[currentUser.uid] || {};
  return emailMaster || !!(u.isMaster || u.role === "master" || u.isAdmin || u.goldenHeader);
}

// Display folders (same style as podcasts)
function displayFolders(folders) {
  foldersList.innerHTML = "";

  for (const folderId in folders) {
    const folder = folders[folderId];

    const folderItem = document.createElement("div");
    folderItem.classList.add("podcast-card");

    // Icon
    const img = document.createElement("img");
    img.src = folder.iconURL || "images/logos/silueta.png";
    img.alt = `${folder.name || 'Folder'} icon`;
    folderItem.appendChild(img);

    // Title
    const title = document.createElement("h3");
    title.textContent = folder.name || "(No name)";
    folderItem.appendChild(title);

    // Creator
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

    // Description
    if (folder.description) {
      const description = document.createElement("p");
      description.textContent = folder.description;
      folderItem.appendChild(description);
    }

    // View button (mismas clases que los botones de podcasts)
    const viewButton = document.createElement("button");
    viewButton.textContent = "View";
    viewButton.className = "btn btn-outline-primary mt-2";
    // Use the same folder renderer as profile: loadFolderPodcasts
    viewButton.addEventListener("click", () => {
      // Abrir modal con la función existente
      openFolderModal(folderId, folder.name || "Folder");
    });

    // Añadir view directamente a la tarjeta (igual que los botones de podcast)
    folderItem.appendChild(viewButton);

    // Delete button — solo para master
    const canDeleteFolder = isMasterUser();
    if (canDeleteFolder) {
      const deleteButton = document.createElement("button");
      deleteButton.textContent = "Delete";
      deleteButton.className = "btn btn-outline-danger mt-3";
      deleteButton.addEventListener("click", async () => {
        if (!confirm(`Are you sure you want to delete the folder "${folder.name || folderId}"?`)) return;
        try {
          await deleteFolder(folderId, folder.iconURL);
          // refrescar vistas
          await loadFolders();
          await listPodcasts();
          alert(`Folder "${folder.name || folderId}" deleted.`);
        } catch (err) {
          console.error("Error deleting folder:", err);
          alert("Failed to delete folder.");
        }
      });
      folderItem.appendChild(deleteButton);
    }

    foldersList.appendChild(folderItem);
  }
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

  if (Object.keys(folderPodcasts).length === 0) {
    const emptyMsg = document.createElement("p");
    emptyMsg.className = "modal-empty-message";
    emptyMsg.textContent = "No podcasts in this folder.";
    list.appendChild(emptyMsg);
    return;
  }

  // For each podcast build a .podcast-card (same structure as displayPodcasts)
  for (const pid in folderPodcasts) {
    const podcast = folderPodcasts[pid];

    const podcastItem = document.createElement("div");
    podcastItem.classList.add("podcast-card");

    // Icon
    const img = document.createElement("img");
    img.src = podcast.iconURL || "images/logos/silueta.png";
    img.alt = podcast.nombre || "podcast";
    podcastItem.appendChild(img);

    // Title
    const titleEl = document.createElement("h3");
    titleEl.textContent = podcast.nombre || "(No title)";
    podcastItem.appendChild(titleEl);

    // Uploader
    let displayName = null;
    if (podcast.uploaderName) displayName = podcast.uploaderName;
    else if (podcast.idcreador && usersMap[podcast.idcreador]) {
      const u = usersMap[podcast.idcreador];
      displayName = u.username || u.displayName || u.email || podcast.idcreador;
    } else if (podcast.idcreador) {
      displayName = podcast.idcreador;
    }
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

    // Delete button: show solo si es master
    const canDelete = isMasterUser();
    if (canDelete) {
      const deleteButton = document.createElement("button");
      deleteButton.textContent = "Delete";
      deleteButton.className = "btn btn-outline-danger mt-3";
      deleteButton.addEventListener("click", () => {
        if (!isMasterUser()) {
          return alert("You are not allowed to delete this podcast.");
        }
        deletePodcast(pid, podcast.audioURL, podcast.iconURL);
      });
      podcastItem.appendChild(deleteButton);
    }

    // Share button (same as main page)
    const shareButton = document.createElement("button");
    shareButton.textContent = "Share";
    shareButton.className = "btn btn-outline-primary mt-2";
    shareButton.addEventListener("click", () => {
      promptSharePodcast(pid, podcast);
    });
    podcastItem.appendChild(shareButton);

    list.appendChild(podcastItem);
  }
}

// Close modal
document.getElementById("folder-modal-close")?.addEventListener("click", () => {
  const modal = document.getElementById("folder-modal");
  if (modal) modal.style.display = "none";
});

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

    if (snapshot.exists()) {
      allPodcasts = snapshot.val();
      displayPodcasts(allPodcasts);
    } else {
      podcastList.textContent = "No podcasts available.";
    }
  } catch (error) {
    console.error("Error listing podcasts:", error);
    podcastList.textContent = "Failed to load podcasts.";
  }
}

// Display podcasts (solo los que NO están en carpetas)
function displayPodcasts(podcasts) {
  podcastList.innerHTML = "";

  for (const podcastId in podcasts) {
    const podcast = podcasts[podcastId];

    const podcastItem = document.createElement("div");
    podcastItem.classList.add("podcast-card");

    // Icon
    const img = document.createElement("img");
    img.src = podcast.iconURL || "images/logos/silueta.png";
    img.alt = `${podcast.nombre} icon`;
    podcastItem.appendChild(img);

    // Title
    const title = document.createElement("h3");
    title.textContent = podcast.nombre;
    podcastItem.appendChild(title);

    // Uploader
    let displayName = null;
    if (podcast.uploaderName) displayName = podcast.uploaderName;
    else if (podcast.idcreador && usersMap[podcast.idcreador]) {
      const u = usersMap[podcast.idcreador];
      displayName = u.username || u.displayName || u.email || podcast.idcreador;
    } else if (podcast.idcreador) {
      displayName = podcast.idcreador;
    }
    if (displayName) {
      const uploader = document.createElement("div");
      uploader.className = "podcast-uploader";
      uploader.textContent = `Uploaded by: ${displayName}`;
      podcastItem.appendChild(uploader);
    }

    // Description
    if (podcast.descripcion) {
      const description = document.createElement("p");
      description.textContent = podcast.descripcion;
      podcastItem.appendChild(description);
    }

    // Audio player
    if (podcast.audioURL) {
      const audio = document.createElement("audio");
      audio.controls = true;
      audio.src = podcast.audioURL;
      podcastItem.appendChild(audio);
    }

    // Delete button: show si uploader o master
    const canDelete = isMasterUser();
    if (canDelete) {
      const deleteButton = document.createElement("button");
      deleteButton.textContent = "Delete";
      deleteButton.className = "btn btn-outline-danger mt-3";
      deleteButton.addEventListener("click", () => {
        // double-check before delete
        if (!isMasterUser()) {
          return alert("You are not allowed to delete this podcast.");
        }
        deletePodcast(podcastId, podcast.audioURL, podcast.iconURL);
      });
      podcastItem.appendChild(deleteButton);
    }

    // Share button (unchanged)
    const shareButton = document.createElement("button");
    shareButton.textContent = "Share";
    shareButton.className = "btn btn-outline-primary mt-2";
    shareButton.addEventListener("click", () => {
      promptSharePodcast(podcastId, podcast);
    });
    podcastItem.appendChild(shareButton);

    podcastList.appendChild(podcastItem);
  }

  // Si no hay podcasts sin carpeta
  if (podcastList.children.length === 0) {
    podcastList.innerHTML = "<p>No podcasts available outside folders.</p>";
  }
}

// Delete podcast
async function deletePodcast(podcastId, audioURL, iconURL) {
  const confirmDelete = confirm(
    `Are you sure you want to delete the podcast "${podcastId}"?`
  );
  if (!confirmDelete) return;

  try {
    if (audioURL) {
      const audioRef = storageRef(storage, audioURL);
      await deleteObject(audioRef);
    }
    if (iconURL) {
      const iconRef = storageRef(storage, iconURL);
      await deleteObject(iconRef);
    }

    const podcastRef = ref(db, `podcasts/${podcastId}`);
    await remove(podcastRef);

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

    if (usersArray.length === 0) return alert('No other users to share with.');

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

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function (m) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[m]); });
}

async function shareToUser(recipientUid, attachment) {
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

  await update(ref(db, `userChats/${senderUid}/${chatId}`), { lastMessage: lastMessageData });
  await update(ref(db, `userChats/${recipientUid}/${chatId}`), { lastMessage: lastMessageData });
}

// Filter podcasts (también excluye los de carpetas)
function filterPodcasts(query) {
  const filteredPodcasts = {};

  for (const podcastId in allPodcasts) {
    const podcast = allPodcasts[podcastId];
    
    // Excluir podcasts que están en carpetas
    if (podcast.folderId || podcast.idcarpeta) {
      continue;
    }
    
    if (podcast.nombre.toLowerCase().includes(query.toLowerCase())) {
      filteredPodcasts[podcastId] = podcast;
    }
  }

  displayPodcasts(filteredPodcasts);
}

// Initialize page
document.addEventListener("DOMContentLoaded", async () => {
  await loadUsersMap();
  await loadFolders();
  await listPodcasts();
});

// Search
searchButton?.addEventListener("click", () => {
  const query = searchInput.value.trim();
  filterPodcasts(query);
});

searchInput?.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    const query = searchInput.value.trim();
    filterPodcasts(query);
  }
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

// Borra carpeta, su icon en storage (si procede) y limpia folderId en podcasts que la referencian
async function deleteFolder(folderId, iconURL) {
  try {
    // borrar icon en storage si existe
    if (iconURL) {
      try {
        const iconRef = storageRef(storage, iconURL);
        await deleteObject(iconRef);
      } catch (e) {
        // puede fallar si iconURL es URL pública; intentar ignorar y continuar
        console.warn("Could not delete folder icon from storage (may be URL):", e);
      }
    }

    // eliminar entrada de folder
    const folderRef = ref(db, `folders/${folderId}`);
    await remove(folderRef);

    // buscar podcasts que referencien esta carpeta y quitar folderId
    for (const pid in allPodcasts) {
      if (!Object.prototype.hasOwnProperty.call(allPodcasts, pid)) continue;
      const p = allPodcasts[pid];
      if (String(p.folderId) === String(folderId) || String(p.idcarpeta) === String(folderId)) {
        try {
          const podcastRef = ref(db, `podcasts/${pid}`);
          await update(podcastRef, { folderId: null, idcarpeta: null, folderName: null });
          // actualizar en memoria
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
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

// Get the podcast list container and search input
const podcastList = document.getElementById("podcastList");
const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");

let allPodcasts = {}; // Variable para almacenar todos los podcasts
let currentUser = null;
let usersMap = {}; // nuevo: mapa uid -> user data

// Auth listener to get current user
const auth = getAuth(app);
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  const uploadBtn = document.getElementById("uploadPodcastBtn") || document.getElementById("goToUpload");
  if (uploadBtn) {
    if (user) {
      uploadBtn.title = "Upload a new podcast";
      uploadBtn.disabled = false;
      uploadBtn.style.opacity = "";
    } else {
      uploadBtn.title = "You must log in to upload";
      uploadBtn.disabled = false;
      uploadBtn.style.opacity = "1";
    }
  }
});

// carga todos los usuarios para poder mostrar nombres
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

// Function to list podcasts
async function listPodcasts() {
  try {
    // cargar mapa de usuarios antes de mostrar podcasts
    await loadUsersMap();

    // Reference to the "podcasts" node in the database
    const podcastsRef = ref(db, "podcasts");
    const snapshot = await get(podcastsRef);

    if (snapshot.exists()) {
      allPodcasts = snapshot.val(); // Guardar todos los podcasts en la variable global
      displayPodcasts(allPodcasts); // Mostrar todos los podcasts inicialmente
    } else {
      podcastList.textContent = "No podcasts available.";
    }
  } catch (error) {
    console.error("Error listing podcasts:", error);
    podcastList.textContent = "Failed to load podcasts.";
  }
}

// Function to display podcasts
function displayPodcasts(podcasts) {
  podcastList.innerHTML = "";

  for (const podcastId in podcasts) {
    const podcast = podcasts[podcastId];

    const podcastItem = document.createElement("div");
    podcastItem.classList.add("podcast-card");

    // Icono
    const img = document.createElement("img");
    img.src = podcast.iconURL;
    img.alt = `${podcast.nombre} icon`;
    img.style.width = "100%";
    img.style.maxHeight = "180px";
    img.style.objectFit = "cover";
    img.style.borderRadius = "10px";
    img.style.marginBottom = "0.8rem";
    podcastItem.appendChild(img);

    // Título
    const title = document.createElement("h3");
    title.textContent = podcast.nombre;
    podcastItem.appendChild(title);

    // Show uploader name if available (uploaderName preferred, fallback to idcreador)
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
      uploader.style.fontSize = "0.9rem";
      uploader.style.color = "#555";
      uploader.textContent = `Uploaded by: ${displayName}`;
      podcastItem.appendChild(uploader);
    }
    // Descripción
    const description = document.createElement("p");
    description.textContent = podcast.descripcion;
    podcastItem.appendChild(description);

    // Reproductor de audio
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.src = podcast.audioURL;
    audio.style.width = "100%";
    podcastItem.appendChild(audio);

    // Botón Delete
    const deleteButton = document.createElement("button");
    deleteButton.textContent = "Delete";
    deleteButton.className = "btn btn-outline-danger mt-3";
    deleteButton.addEventListener("click", () => {
      deletePodcast(podcastId, podcast.audioURL, podcast.iconURL);
    });
    podcastItem.appendChild(deleteButton);

    // Share button
    const shareButton = document.createElement("button");
    shareButton.textContent = "Share";
    shareButton.className = "btn btn-outline-primary mt-2";
    shareButton.addEventListener("click", () => {
      promptSharePodcast(podcastId, podcast);
    });
    podcastItem.appendChild(shareButton);

    podcastList.appendChild(podcastItem);
  }
}


// Function to delete a podcast
async function deletePodcast(podcastId, audioURL, iconURL) {
  const confirmDelete = confirm(
    `Are you sure you want to delete the podcast "${podcastId}"?`
  );
  if (!confirmDelete) return;

  try {
    // Delete the audio file from Firebase Storage
    const audioRef = storageRef(storage, audioURL);
    await deleteObject(audioRef);

    // Delete the icon file from Firebase Storage
    const iconRef = storageRef(storage, iconURL);
    await deleteObject(iconRef);

    // Delete the podcast entry from Firebase Database
    const podcastRef = ref(db, `podcasts/${podcastId}`);
    await remove(podcastRef);

    // Remove the podcast from the UI
    delete allPodcasts[podcastId];
    displayPodcasts(allPodcasts);

    alert(`Podcast "${podcastId}" deleted successfully.`);
  } catch (error) {
    console.error("Error deleting podcast:", error);
    alert("Failed to delete the podcast.");
  }
}

// Prompt user for recipient and share podcast as attachment
// Open a modal listing users and call onSelect(selectedUid)
async function promptSharePodcast(podcastId, podcast) {
  if (!currentUser) return alert("Log in to share.");

  try {
    const usersRef = ref(db, "users");
    const snap = await get(usersRef);
    if (!snap.exists()) return alert("No users found.");
    const users = snap.val();

    // Build array of { uid, username, email }
    const usersArray = [];
    for (const uid in users) {
      if (uid === currentUser.uid) continue; // don't show self
      usersArray.push({ uid, username: users[uid].username || users[uid].email || '(no name)', email: users[uid].email || '' });
    }

    if (usersArray.length === 0) return alert('No other users to share with.');

    // show modal and wait for selection
    openUserSelectModal(usersArray, async (recipientUid) => {
      if (!recipientUid) return; // cancelled

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

// Create and show a lightweight user selection modal. Calls onSelect(uid) or onSelect(null) if cancelled.
function openUserSelectModal(usersArray, onSelect) {
  // modal elements
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.left = 0;
  overlay.style.top = 0;
  overlay.style.right = 0;
  overlay.style.bottom = 0;
  overlay.style.background = 'rgba(0,0,0,0.5)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = 9999;

  const box = document.createElement('div');
  box.style.width = '360px';
  box.style.maxHeight = '70vh';
  box.style.overflow = 'auto';
  box.style.background = '#fff';
  box.style.borderRadius = '8px';
  box.style.padding = '12px';
  box.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)';

  const title = document.createElement('h3');
  title.textContent = 'Select a user';
  title.style.marginTop = 0;
  box.appendChild(title);

  const list = document.createElement('ul');
  list.style.listStyle = 'none';
  list.style.padding = 0;
  list.style.margin = '8px 0 12px 0';

  usersArray.forEach(u => {
    const li = document.createElement('li');
    li.style.display = 'flex';
    li.style.justifyContent = 'space-between';
    li.style.alignItems = 'center';
    li.style.padding = '8px';
    li.style.borderBottom = '1px solid #eee';

    const info = document.createElement('div');
    info.innerHTML = `<strong>${escapeHtml(u.username)}</strong><div style="font-size:0.85rem;color:#666">${escapeHtml(u.email)}</div>`;

    const btn = document.createElement('button');
    btn.textContent = 'Share';
    btn.className = 'btn';
    btn.style.marginLeft = '8px';
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
  cancel.className = 'btn';
  cancel.style.marginTop = '8px';
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

// Write the message with attachment to DB
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

// Function to filter podcasts based on the search query
function filterPodcasts(query) {
  const filteredPodcasts = {};

  for (const podcastId in allPodcasts) {
    const podcast = allPodcasts[podcastId];
    if (podcast.nombre.toLowerCase().includes(query.toLowerCase())) {
      filteredPodcasts[podcastId] = podcast;
    }
  }

  displayPodcasts(filteredPodcasts); // Mostrar los podcasts filtrados
}

// Call the function to list podcasts on page load
listPodcasts();

// Add event listener to the search button
searchButton.addEventListener("click", () => {
  const query = searchInput.value.trim();
  filterPodcasts(query);
});

searchInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    const query = searchInput.value.trim();
    filterPodcasts(query);
  }
});



// Add event listener to the "Upload Podcast" button
const uploadButton = document.getElementById("uploadPodcastBtn") || document.getElementById("goToUpload");
if (uploadButton) {
  uploadButton.addEventListener("click", (e) => {
    if (currentUser) {
      window.location.href = "podcast_upload.html";
    } else {
      // opción: mostrar mensaje antes de redirigir
      // alert('You must be logged in to upload a podcast.');
      window.location.href = "login.html";
    }
  });
}

// After existing upload button handler add navigation to folder creation page
const createFolderBtn = document.getElementById("createFolderBtn");
if (createFolderBtn) {
  createFolderBtn.addEventListener("click", () => {
    // require login: if you have currentUser via onAuthStateChanged use it; otherwise redirect to login
    if (currentUser) {
      window.location.href = "folder_upload.html";
    } else {
      window.location.href = "login.html";
    }
  });
}
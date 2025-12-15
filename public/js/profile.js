// --- IMPORT ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";
import { saveFavouriteSong, saveFavouriteArtist } from "./favourites.js";

// Modules Realtime Database (RTDB)
import { getDatabase, ref, onValue, set, get, update, push, remove } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-database.js";
const databaseRef = ref;

// Módulos Storage
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-storage.js";

// --- CONFIGURATION FIREBASE ---
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

// --- INIT ---
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const storage = getStorage(app);
let currentUser = null; // save here the user so the function saves it
// --- SPOTIFY PLAYER VARIABLES (Same logic as chats.js) ---
let playerReady = false;
let isPlaying = false;
let token = localStorage.getItem("spotify_access_token");
let isPremium = localStorage.getItem("spotify_is_premium") === "1";
let deviceId = null;
let currentPlayingUri = null;
let currentActivePlayButton = null;

// 1. Validate Spotify Token (Using endpoint 2)
async function isSpotifyTokenValid(token) {
    if (!token) return false;
    try {
        const res = await fetch("https://api.spotify.com/v1/me", {
            headers: { "Authorization": "Bearer " + token }
        });
        return res.status === 200;
    } catch (e) {
        console.warn("Token validation failed", e);
        return false;
    }
}

// 2. Initialize Spotify Web Playback SDK
function initSpotifyPlaybackSDK() {
    // Avoid loading script twice if it exists
    if (document.getElementById('spotify-player-script')) return;

    const script = document.createElement("script");
    script.id = "spotify-player-script";
    script.src = "https://sdk.scdn.co/spotify-player.js";
    document.body.appendChild(script);

    window.onSpotifyWebPlaybackSDKReady = () => {
        window.spotifyPlayer = new Spotify.Player({
            name: "MelodyStream Profile Player",
            getOAuthToken: (cb) => cb(token),
            volume: 0.8
        });

        // Listen for the 'ready' event to get the Device ID
        window.spotifyPlayer.addListener("ready", ({ device_id }) => {
            console.log("Device ready:", device_id);
            deviceId = device_id;
            playerReady = true;
        });

        window.spotifyPlayer.addListener("not_ready", ({ device_id }) => {
            console.log("Device ID has gone offline", device_id);
            playerReady = false;
        });

        window.spotifyPlayer.connect();
    };
}

// 3. Auto-start SDK if token and premium status are valid
(async () => {
    if (token && isPremium && await isSpotifyTokenValid(token)) {
        console.log("Spotify token OK — Loading Web Playback SDK...");
        initSpotifyPlaybackSDK();
    } else {
        console.log("Spotify not available — premium or token invalid.");
    }
})();



function cargarDatosDePerfil() {
  const imagenElemento = document.getElementById('fotoPerfilUsuario');
  const msgElemento = document.getElementById('msg');

  if (!imagenElemento || !msgElemento) {
    console.error("Faltan elementos HTML (msg o fotoPerfilUsuario)");
    return;
  }


  onAuthStateChanged(auth, async (user) => {
    currentUser = user; // set global user for upload function

    const msgElemento = document.getElementById('msg');
    const imagenElemento = document.getElementById('fotoPerfilUsuario');
    const userDataDiv = document.getElementById('userData');

    if (user) {
      msgElemento.textContent = `✅ Logged in as ${user.email}`;

      // Referencia al usuario en la base de datos
      const userRef = databaseRef(db, 'users/' + user.uid);

      onValue(userRef, (snapshot) => {
        const userData = snapshot.val();

        if (userData) {
          // profile info
          userDataDiv.style.display = 'block';
          userDataDiv.innerHTML = `
            <h2 class="profileInformation">Profile Information</h2>
            <p><strong>Username:</strong> ${userData.username || "—"}</p>
            <p><strong>Phone:</strong> ${userData.phone || "—"}</p>
            <p><strong>Email:</strong> ${user.email}</p>
          `;

          // render profile picture
          if (userData.urlFotoPerfil) {
            imagenElemento.src = userData.urlFotoPerfil;
            const headerPic = document.getElementById('headerUserPic');
            if (headerPic) headerPic.src = userData.urlFotoPerfil;
          }
        } else {
          userDataDiv.style.display = 'none';
        }
      });

      document.getElementById("favArtistsSection").style.display = "block";
      document.getElementById("favSongsSection").style.display = "block";


      // Load and display the podcasts uploaded by this user
      loadUserPodcasts(user.uid);
      loadUserFolders(user.uid);
      loadFavouriteArtists(user.uid);
      loadFavouriteSongs(user.uid);


    } else {
      msgElemento.textContent = "⚠️ You must be logged in to see your profile.";
      imagenElemento.src = "images/logos/silueta.png";

      const headerPic = document.getElementById('headerUserPic');
      if (headerPic) headerPic.src = "images/logos/silueta.png";
      userDataDiv.style.display = 'none';

      // Clear podcast list on logout
      const existingContainer = document.getElementById('userPodcasts');
      if (existingContainer) existingContainer.innerHTML = '';

      document.getElementById("favArtistsSection").style.display = "none";
      document.getElementById("favSongsSection").style.display = "none";

    }
  });
}

async function loadUserPodcasts(uid) {
  let container = document.getElementById('userPodcasts');
  let heading = document.getElementById('podcast-heading');

  if (!container) {
    container = document.createElement('div');
    container.id = 'userPodcasts';
    container.classList.add('module-box');

    heading = document.createElement('h2');
    heading.textContent = 'My Uploaded Podcasts';
    heading.id = 'podcast-heading';
    heading.classList.add('module-title');

    const profileMain = document.querySelector('main') || document.body;
    container.appendChild(heading);
    profileMain.appendChild(container);
  }

  let contentWrapper = document.getElementById('podcasts-content-wrapper');
  if (!contentWrapper) {
        contentWrapper = document.createElement('div');
        contentWrapper.id = 'podcasts-content-wrapper';
        container.appendChild(contentWrapper);
  }

  contentWrapper.innerHTML = 'Loading your podcasts...';

  try {
    const podcastsRef = databaseRef(db, 'podcasts');
    const snapshot = await get(podcastsRef);

    if (!snapshot.exists()) {
      contentWrapper.innerHTML = '<p>You have not uploaded any podcasts.</p>';
      return;
    }

    const podcasts = snapshot.val();
    const list = document.createElement('div');
    list.className = 'podcast-list';
    
    let found = false;

    const foldersSnap = await get(databaseRef(db, 'folders'));
    const userFolders = {};
    if (foldersSnap.exists()) {
      const allFolders = foldersSnap.val();
      for (const fid in allFolders) {
        const f = allFolders[fid];
        if (f.createdBy === uid) {
          userFolders[fid] = f;
        }
      }
    }

    for (const pid in podcasts) {
      const p = podcasts[pid];
      if (p.idcreador === uid) {
        found = true;

        const item = document.createElement('div');
        item.className = 'podcast-card';

        // Image
        const img = document.createElement('img');
        img.src = p.iconURL || 'images/logos/silueta.png';
        img.alt = (p.nombre || 'podcast') + ' icon';
        item.appendChild(img);

        // Títle
        const title = document.createElement('h4');
        title.textContent = p.nombre || '(no title)';
        item.appendChild(title);

        // Description
        if (p.descripcion) {
          const desc = document.createElement('p');
          desc.textContent = p.descripcion;
          item.appendChild(desc);
        }

        // Audio
        if (p.audioURL || p.audioUrl || p.audio) {
          const audio = document.createElement('audio');
          audio.controls = true;
          audio.src = p.audioURL || p.audioUrl || p.audio;
          item.appendChild(audio);
        }

        const controlWrapper = document.createElement('div');
        controlWrapper.className = 'folder-selection-container';

        // Selectfolders
        const folderLabel = document.createElement('label');
        folderLabel.textContent = 'Folder:';
        folderLabel.htmlFor = `folder-select-${pid}`;

        const select = document.createElement('select');
        select.id = `folder-select-${pid}`;
        
        const noneOpt = document.createElement('option');
        noneOpt.value = '';
        noneOpt.textContent = '-- No folder --';
        select.appendChild(noneOpt);

        for (const fid in userFolders) {
          const opt = document.createElement('option');
          opt.value = fid;
          opt.textContent = userFolders[fid].name || fid;
          if (p.folderId && String(p.folderId) === String(fid)) opt.selected = true;
          select.appendChild(opt);
        }

        controlWrapper.appendChild(folderLabel);
        controlWrapper.appendChild(select);

        // button "Add to folder"
        const addBtn = document.createElement('button');
        addBtn.textContent = 'Add to folder';
        addBtn.classList.add('main-button', 'add-to-folder-btn');

        controlWrapper.appendChild(addBtn);
        item.appendChild(controlWrapper);

        addBtn.addEventListener('click', async () => {
          const chosen = select.value || null;
          try {
            await update(databaseRef(db, `podcasts/${pid}`), { folderId: chosen });
            const originalText = addBtn.textContent;
            addBtn.textContent = 'Saved!';
            setTimeout(() => (addBtn.textContent = originalText), 1500);
          } catch (err) {
            console.error('Error updating podcast folder:', err);
            alert('Error updating folder: ' + (err.message || err));
          }
        });

        // Botón Delete para el podcast
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Remove';
        deleteBtn.className = 'btn btn-outline-danger mt-3';
        deleteBtn.addEventListener('click', async () => {
          if (!confirm(`Are you sure you want to delete "${p.nombre || 'this podcast'}"?`)) return;
          try {
            // Borrar archivos de storage si existen
            if (p.audioURL) {
              try {
                const audioRef = storageRef(storage, p.audioURL);
                await deleteObject(audioRef);
              } catch (e) {
                console.warn('Could not delete audio from storage:', e);
              }
            }
            if (p.iconURL) {
              try {
                const iconRef = storageRef(storage, p.iconURL);
                await deleteObject(iconRef);
              } catch (e) {
                console.warn('Could not delete icon from storage:', e);
              }
            }
            // Borrar entrada de la base de datos
            await remove(databaseRef(db, `podcasts/${pid}`));
            // Recargar la lista
            await loadUserPodcasts(uid);
            alert('Podcast deleted successfully');
          } catch (err) {
            console.error('Error deleting podcast:', err);
            alert('Failed to delete podcast: ' + (err.message || err));
          }
        });
        item.appendChild(deleteBtn);

        list.appendChild(item);
      }
    }

    contentWrapper.innerHTML = '';
    if (found) {
      contentWrapper.appendChild(list);
    } else {
      contentWrapper.innerHTML = '<p class="empty-message">You have not uploaded any podcasts.</p>';
    }

  } catch (err) {
    console.error('Error loading user podcasts:', err);
    contentWrapper.innerHTML = '<p class="empty-message">Failed to load your podcasts.</p>';
  }
}

async function loadUserFolders(uid) {
  let container = document.getElementById("userFolders");
  let heading = document.getElementById('folders-heading');

  if (!container) {
    container = document.createElement("div");
    container.id = "userFolders";
    container.classList.add('module-box');

    heading = document.createElement("h2");
    heading.textContent = "My Folders";
    heading.id = 'folders-heading';
    heading.classList.add('module-title');

    const profileMain = document.querySelector("main") || document.body;
    
    container.appendChild(heading);
    profileMain.appendChild(container);
  }

  let contentWrapper = document.getElementById('folders-content-wrapper');
  if (!contentWrapper) {
        contentWrapper = document.createElement('div');
        contentWrapper.id = 'folders-content-wrapper';
        container.appendChild(contentWrapper); // Se añade *después* del título
  }

  contentWrapper.innerHTML = "Loading your folders...";

  try {
    const foldersRef = databaseRef(db, "folders");
    const snap = await get(foldersRef);
    if (!snap.exists()) {
      contentWrapper.innerHTML = `<p>You have not created any folders.</p>`;
      return;
    }

    const folders = snap.val();
    const list = document.createElement("div");
    list.className = 'folder-list';
    
    let found = false;
    
    for (const fid in folders) {
      const f = folders[fid];
      if (f.createdBy === uid) {
        found = true;
        const item = document.createElement("div");
        item.className = "folder-item";

        // Imagen
        const img = document.createElement("img");
        img.src = f.iconURL || "images/logos/silueta.png";
        img.alt = f.name + " icon";
        item.appendChild(img);

        // Title
        const title = document.createElement("h4");
        title.textContent = f.name || "(no name)";
        item.appendChild(title);

        // Description
        if (f.description) {
          const desc = document.createElement("p");
          desc.textContent = f.description;
          item.appendChild(desc);
        }

        // View button
        const viewBtn = document.createElement("button");
        viewBtn.textContent = "View";
        viewBtn.classList.add("main-button", "view-folder");

        viewBtn.setAttribute('data-folder-id', fid);
        viewBtn.setAttribute('data-folder-name', f.name || '');

        item.appendChild(viewBtn);

        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Remove';
        deleteBtn.className = 'btn btn-outline-danger mt-3';
        deleteBtn.addEventListener('click', async () => {
          if (!confirm(`Are you sure you want to delete the folder "${f.name || fid}"?`)) return;
          try {
            // remove storage icon if it exists
            if (f.iconURL) {
              try {
                const iconRef = storageRef(storage, f.iconURL);
                await deleteObject(iconRef);
              } catch (e) {
                console.warn('Could not delete folder icon from storage:', e);
              }
            }
            // remove folder from database
            await remove(databaseRef(db, `folders/${fid}`));
            
            // remove folderId of all podcasts that were in this folder
            const podsSnap = await get(databaseRef(db, 'podcasts'));
            if (podsSnap.exists()) {
              const allPods = podsSnap.val();
              for (const pid in allPods) {
                const pod = allPods[pid];
                if (pod.folderId && String(pod.folderId) === String(fid)) {
                  await update(databaseRef(db, `podcasts/${pid}`), { folderId: null });
                }
              }
            }
            
            // update list
            await loadUserFolders(uid);
            alert('Folder deleted successfully');
          } catch (err) {
            console.error('Error deleting folder:', err);
            alert('Failed to delete folder: ' + (err.message || err));
          }
        });
        item.appendChild(deleteBtn);

        list.appendChild(item);
      }
    }

    contentWrapper.innerHTML = '';
    if (found) contentWrapper.appendChild(list);
    else{      
      contentWrapper.innerHTML = '<p class="empty-message">You have not created any folders.</p>';;
    }
  } 
  catch (err) {
    console.error("Error loading user folders:", err);
    contentWrapper.innerHTML = '<p class="empty-message">Failed to load your folders.</p>';
  }
}

function setupFormUploadListener() {

  const form = document.getElementById('uploadForm');
  const fileInput = document.getElementById('fotoArchivo');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // 1. Validate
    if (!currentUser) {
      alert("You must be logged in to upload a photo.");
      return;
    }
    const file = fileInput.files[0];
    if (!file) {
      alert("Please select a file.");
      return;
    }

    // 2. Crear la ruta de subida en Firebase Storage
    const filePath = `profile_images/${currentUser.uid}/${file.name}`;
    const sRef = storageRef(storage, filePath); 

    try {
      // 3. Upload the file
      alert("Uploading photo...");
      const snapshot = await uploadBytes(sRef, file);
      console.log('Photo uploaded!', snapshot);

      // 4. get download URL
      const downloadURL = await getDownloadURL(snapshot.ref);
      console.log('File URL:', downloadURL);

      // 5. save URL in Realtime Database
      const userDbRef = databaseRef(db, 'users/' + currentUser.uid + '/urlFotoPerfil');
      await set(userDbRef, downloadURL);

      // 6. Update the image in the web
      document.getElementById('fotoPerfilUsuario').src = downloadURL;
      const headerPic = document.getElementById('headerUserPic');
      if (headerPic) headerPic.src = downloadURL;

      localStorage.setItem('profilePic', downloadURL);

      alert("¡Profile picture updated!");

    } catch (error) {
      console.error("Error al subir el archivo:", error);
      alert("Error uploading photo. Check your console.");
    }
  });
}

function createPodcastCard(p) {
  const wrapper = document.createElement('div');
  wrapper.className = 'podcast-card';

  const thumb = document.createElement('img');
  thumb.src = p.thumbnail || 'images/logos/default.png';
  thumb.alt = p.title || 'thumbnail';

  const info = document.createElement('div');
  info.className = 'podcast-card-info';

  const title = document.createElement('h3');
  title.textContent = p.title || 'Sin título';

  const desc = document.createElement('p');
  desc.textContent = p.description || '';

  info.appendChild(title);
  info.appendChild(desc);

  // Audio player if exists
  const audioSrc = p.audioURL || p.audioUrl || p.audio || p.url || p.audio_src || '';
  if (audioSrc) {
    const audioEl = document.createElement('audio');
    audioEl.controls = true;
    audioEl.src = audioSrc;
    info.appendChild(audioEl);
  }

  wrapper.appendChild(thumb);
  wrapper.appendChild(info);

  return wrapper;
}

function openModal() {
  const modal = document.getElementById('folder-modal');
  if (!modal) return;
  modal.style.display = 'flex';
}

function closeModal() {
  const modal = document.getElementById('folder-modal');
  if (!modal) return;
  modal.style.display = 'none';
  const listEl = document.getElementById('folder-podcast-list');
  if (listEl) listEl.innerHTML = '';
  const titleEl = document.getElementById('folder-modal-title');
  if (titleEl) titleEl.textContent = 'Podcasts de la carpeta';
}

async function loadFolderPodcasts(folderId, folderName) {
  const listEl = document.getElementById('folder-podcast-list');
  const titleEl = document.getElementById('folder-modal-title');
  if (!listEl || !titleEl) return;
  titleEl.textContent = folderName || 'Loading...';
  listEl.innerHTML = '';
  openModal();

  try {
    const podsSnap = await get(databaseRef(db, 'podcasts'));
    if (!podsSnap.exists()) {
      listEl.innerHTML = '<p class="modal-empty-message">This folder is empty.</p>';
      return;
    }
    const all = podsSnap.val();
    const items = [];
    for (const pid in all) {
      const p = all[pid];
      if (p.folderId && String(p.folderId) === String(folderId)) {
        items.push({
          id: pid,
          title: p.nombre || p.title || '',
          description: p.descripcion || p.description || '',
          thumbnail: p.iconURL || p.thumbnail || '',
          audioURL: p.audioURL || p.audioUrl || p.audio || p.url || p.audio_src || ''
        });
      }
    }

    if (items.length === 0) {
      listEl.innerHTML = '<p class="modal-empty-message">This folder is empty.</p>';
      return;
    }
    items.forEach(p => listEl.appendChild(createPodcastCard(p)));
  } catch (err) {
    console.error(err);
    titleEl.textContent = 'Error al cargar';
    listEl.innerHTML = '<p class="modal-empty-message">No se pudieron cargar los podcasts.</p>';
  }
}

// --- INIT the functions ---
document.addEventListener('DOMContentLoaded', () => {
  cargarDatosDePerfil(); // Carga el email y la foto existente
  setupFormUploadListener(); // Prepara el formulario de subida
});

// global handlers 
const goToChatBtn = document.getElementById('goToChatBtn');
if (goToChatBtn) {
  goToChatBtn.addEventListener('click', () => {
    window.location.href = 'chat.html';
  });
}


// Event to open modal if doing click in the button .view-folder
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.view-folder');
  if (!btn) return;
  e.preventDefault();
  const fid = btn.dataset.folderId || btn.getAttribute('data-folder-id');
  const fname = btn.dataset.folderName || btn.getAttribute('data-folder-name') || '';
  if (!fid) return console.warn('El botón view necesita data-folder-id');
  loadFolderPodcasts(fid, fname);
});

// Close modal - existents buttons in DOM
document.getElementById('folder-modal-close')?.addEventListener('click', closeModal);
document.getElementById('folder-form-close')?.addEventListener('click', closeModal);

// Close modal if doing click outside content
document.getElementById('folder-modal')?.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'folder-modal') closeModal();
});




//-----------------------------------------------------------------------------------------------------------------------------------------------------------------------
//ARTISTS FAV SECTION
function getSpotifyUserToken() {
  return localStorage.getItem("spotify_access_token");
}

async function searchArtist(query) {
  const resp = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=artist&limit=6`,
    { headers: { "Authorization": "Bearer " + token } }
  );

  const data = await resp.json();
  return data.artists.items;
}

async function fetchArtistData(artistIds) {
  const db = getDatabase();
  const artists = [];

  for (const id of artistIds) {
    const artistSnap = await get(ref(db, `artistas/${id}`));
    if (artistSnap.exists()) {
      artists.push({ id, ...artistSnap.val() });
    }
  }

  renderSavedArtists(artists);
}

function loadFavouriteArtists(userId) {
  const db = getDatabase();
  const favRef = ref(db, `users/${userId}/favourite_artists`);

  onValue(favRef, snapshot => {
    const favData = snapshot.val() || {};
    const artistIds = Object.keys(favData);

    // CALL ASYNC FUNCTION TO FETCH ARTIST DATA
    fetchArtistData(artistIds);
  });
}


async function removeFavouriteArtist(artistId) {
  const db = getDatabase();

  const favRef = ref(db, `users/${currentUser.uid}/favourite_artists/${artistId}`);
  await remove(favRef);

  alert("Artist removed from favourites");
}


function renderSavedArtists(artists) {
  const container = document.getElementById("savedArtists");
  container.innerHTML = "";

  artists.forEach(a => {
    const div = document.createElement("div");
    div.classList.add("artistCard");

    div.innerHTML = `
      <img src="${a.image || 'images/default_artist.png'}" style="width:80px;border-radius:50%">
      <p>${a.name}</p>

      <button class="shareArtistBtn">Share</button>
      <button class="removeArtistBtn">Remove</button>
    `;

    // REMOVE
    div.querySelector(".removeArtistBtn").addEventListener("click", async () => {
      removeFavouriteArtist(a.id);
    });

    // SHARE
    div.querySelector(".shareArtistBtn").addEventListener("click", () => {
      openShareArtistModal(a);
    });

    container.appendChild(div);
  });
}



document.getElementById("btnSearchArtist").addEventListener("click", async () => {
  const query = document.getElementById("artistSearch").value.trim();
  const resultContainer = document.getElementById("artistResults");

  resultContainer.innerHTML = ""; // remove previous results

  if (query === "") {
    resultContainer.innerHTML = "<p>Please enter an artist name.</p>";
    return;
  }

  try {
    // Validate token
    const tokenValid = token && await isSpotifyTokenValid(token);

    if (!tokenValid) {
      resultContainer.innerHTML = ""; 

      const reconnectBtn = document.createElement("button");
      reconnectBtn.textContent = "Connect Spotify";
      reconnectBtn.className = "main-button";
      reconnectBtn.style.marginTop = "10px";

      reconnectBtn.addEventListener("click", () => {
          window.location.href = "test_register_spotify.html";
      });

      resultContainer.appendChild(reconnectBtn);
      return;
    }

    const artists = await searchArtist(query);

    if (!artists || artists.length === 0) {
      resultContainer.innerHTML = "<p>No artists found.</p>";
      return;
    }

    artists.forEach(artist => {
      const card = document.createElement("div");
      card.classList.add("artistCard");

      card.innerHTML = `
        <img src="${artist.images?.[0]?.url || 'images/logos/silueta.png'}" />
        <p>${artist.name}</p>
        <button class="addFavBtn">Add to favourites</button>
      `;

      // Botón añadir a favoritos
      card.querySelector(".addFavBtn").addEventListener("click", () => {
        saveFavouriteArtist(currentUser.uid, artist);
      });

      resultContainer.appendChild(card);
    });

  } catch (error) {
    console.error("Error searching artists:", error);
    resultContainer.innerHTML = "<p>Error searching artists.</p>";
  }
});

//----------SHARE ARTISTS-------------------------------------------------------------------------------------------------------------------

// Devuelve [{ chatId, displayName }]
async function loadUserChatsForShareData() {
  const db = getDatabase();
  const chatsRef = ref(db, `userChats/${currentUser.uid}`);
  const snapshot = await get(chatsRef);
  const data = snapshot.val() || {};

  const out = [];

  for (const chatId in data) {
    const parts = chatId.split("_");
    const userA = parts[0];
    const userB = parts[1];
    const otherUid = (userA === currentUser.uid) ? userB : userA;

    const userSnap = await get(ref(db, `users/${otherUid}`));
    const userData = userSnap.val();
    const displayedName = userData?.username || userData?.email || otherUid;

    out.push({ chatId, displayName: displayedName });
  }

  // orden opcional por nombre
  out.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return out;
}

function fillChatSelect(selectEl, chats) {
  selectEl.innerHTML = "";

  chats.forEach(({ chatId, displayName }) => {
    const option = document.createElement("option");
    option.value = chatId;
    option.textContent = displayName;
    selectEl.appendChild(option);
  });
}

// ✅ Reemplaza tu función actual por esta (misma firma)
async function loadUserChatsForShare(selectEl, searchInputEl) {
  const chats = await loadUserChatsForShareData();

  // pinta todo
  fillChatSelect(selectEl, chats);

  // si no pasas input, listo
  if (!searchInputEl) return;

  // filtro en vivo
  const norm = (s) => (s || "").toString().toLowerCase().trim();

  searchInputEl.value = "";
  searchInputEl.addEventListener("input", () => {
    const q = norm(searchInputEl.value);
    const filtered = !q
      ? chats
      : chats.filter(c => norm(c.displayName).includes(q));
    fillChatSelect(selectEl, filtered);
  });
}


function openShareArtistModal(artist) {
  const modal = document.getElementById("shareArtistModal");
  const nameEl = document.getElementById("shareArtistName");
  const select = document.getElementById("chatSelect");

  nameEl.innerText = artist.name;

  // save data artist in modal dataset
  modal.dataset.artistId = artist.id;
  modal.dataset.artistName = artist.name;
  modal.dataset.artistImage = artist.image;

  loadUserChatsForShare(select);

  modal.style.display = "flex";
}

document.getElementById("shareArtistCancel").addEventListener("click", () => {
  document.getElementById("shareArtistModal").style.display = "none";
});

async function shareArtistToChat(chatId, artist) {
  const db = getDatabase();
  const timestamp = Date.now();

  // 1. get UIDS
  const parts = chatId.split("_");
  const user1 = parts[0];
  const user2 = parts[1];

  // 2. prepare message data
  const messagesRef = ref(db, `chats/${chatId}/messages`);
  const msgKey = push(messagesRef).key;

  const message = {
    sender: currentUser.uid,
    timestamp,
    attachment: {
      id: artist.id,
      title: artist.name,
      imageURL: artist.image,
      author: "Favourite Artist",
      audioURL: "" 
    },
    text: `Shared artist: ${artist.name}`
  };

  const lastMessageObj = {
    sender: currentUser.uid,
    text: `[Artist] ${artist.name}`,
    timestamp
  };

  // 3. prepare updates
  const updates = {};
  
  // Chat data
  updates[`chats/${chatId}/messages/${msgKey}`] = message;
  updates[`chats/${chatId}/createdAt`] = timestamp;
  updates[`chats/${chatId}/users/${user1}`] = true;
  updates[`chats/${chatId}/users/${user2}`] = true;

  // Sender UserChat
  updates[`userChats/${currentUser.uid}/${chatId}/lastMessage`] = lastMessageObj;
  updates[`userChats/${currentUser.uid}/${chatId}/isRead`] = true;

  // Receiver UserChat (Calculamos quién es el otro)
  const otherUser = (user1 === currentUser.uid) ? user2 : user1;
  updates[`userChats/${otherUser}/${chatId}/lastMessage`] = lastMessageObj;
  updates[`userChats/${otherUser}/${chatId}/isRead`] = false;

  await update(ref(db), updates);
}

document.getElementById("shareArtistConfirm").addEventListener("click", async () => {
  const modal = document.getElementById("shareArtistModal");
  const chatId = document.getElementById("chatSelect").value;

  const artist = {
    id: modal.dataset.artistId,
    name: modal.dataset.artistName,
    image: modal.dataset.artistImage
  };

  await shareArtistToChat(chatId, artist);

  modal.style.display = "none";
  alert("Artist shared!");
});

// SONGS
//----------------------------------------------------------------------------------------------------------------------------------------------------------------------z

async function searchSong(query) {
  const token = getSpotifyUserToken();

  const resp = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=6`,
    {
      headers: { "Authorization": "Bearer " + token }
    }
  );

  const data = await resp.json();
  return data.tracks.items;
}

function loadFavouriteSongs(userId) {
  const db = getDatabase();
  const favRef = ref(db, `users/${userId}/favoritos`);

  onValue(favRef, snapshot => {
    const data = snapshot.val() || {};
    const songIds = Object.keys(data);
    renderSavedSongs(songIds, data);
  });
}

async function playTrack(uri, playButton) {

    if (!playerReady || !deviceId) {
        console.warn("Spotify player not ready.");
        return;
    }

    // Otra canción → parar la anterior
    if (currentPlayingUri && currentPlayingUri !== uri) {
        await fetch(
            `https://api.spotify.com/v1/me/player/pause?device_id=${deviceId}`,
            { method: "PUT", headers: { Authorization: `Bearer ${token}` } }
        );

        if (currentActivePlayButton) {
            currentActivePlayButton.textContent = "▶ Play";
        }
    }

    // Misma canción → pausar
    if (currentPlayingUri === uri && currentPlayingUri && playButton.textContent === "⏹ Stop") {
        await fetch(
            `https://api.spotify.com/v1/me/player/pause?device_id=${deviceId}`,
            { method: "PUT", headers: { Authorization: `Bearer ${token}` } }
        );

        playButton.textContent = "▶ Play";
        currentPlayingUri = null;
        return;
    }

    // Reproducir
    await fetch(
        `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
        {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ uris: [uri] })
        }
    );

    currentPlayingUri = uri;
    playButton.textContent = "⏹ Stop";
    currentActivePlayButton = playButton;
}
async function removeFavSongs(songId){
  const db = getDatabase();

  const favSongRef = ref(db, `users/${currentUser.uid}/favoritos/${songId}`);
  await remove(favSongRef);

  console.log(`Song with id ${songId} removed from favorites`);
}

// --- RENDER SAVED SONGS (Logic matching Chats) ---
async function renderSavedSongs(songIds, favorites) {
    const container = document.getElementById("savedSongs");
    container.innerHTML = "";
    
    // Check token validity once when loading the list
    const tokenValid = token && await isSpotifyTokenValid(token);
    const db = getDatabase();

    songIds.forEach(songId => {
        const songRef = ref(db, `canciones/${songId}`);

        onValue(songRef, snapshot => {
            const data = snapshot.val();

            if (data) {
                const div = document.createElement("div");
                div.classList.add("artistCard");

                let artistNames = "Unknown Artist";
                if (Array.isArray(data.artist)) {
                    artistNames = data.artist.join(", ");
                } else if (typeof data.artist === 'string') {
                    artistNames = data.artist;
                }
                
                // Construct the URI if not saved (format: spotify:track:ID)
                // This is crucial for the player to work
                const songUri = data.uri || `spotify:track:${data.id || songId}`;

                // Base HTML Structure
                div.innerHTML = `
                  <img src="${data.albumImageUrl || 'images/logos/silueta.png'}" style="width:80px; border-radius:10px;">
                  <p><strong>${data.title}</strong></p>
                  <p>${artistNames}</p>
                  
                  <div class="player-controls-area"></div> 
                  
                  <div class="action-buttons" style="margin-top:5px;">
                      <button class="shareSongBtn">Share</button>
                      <button class="removeSongBtn">Remove</button>
                  </div>
                `;

                // --- PLAYER LOGIC (Dynamic Buttons) ---
                const controlsArea = div.querySelector(".player-controls-area");

                // 1. No valid token -> Show Connect button
                if (!tokenValid) {
                    const reconnectBtn = document.createElement("button");
                    reconnectBtn.textContent = "Connect Spotify";
                    reconnectBtn.className = "main-button"; // Make sure you have CSS for this class
                    reconnectBtn.style.fontSize = "12px";
                    reconnectBtn.style.marginTop = "5px";
                    reconnectBtn.addEventListener("click", () => {
                        window.location.href = "test_register_spotify.html"; 
                    });
                    controlsArea.appendChild(reconnectBtn);
                } 
                // 2. Valid token but NOT Premium -> Show info message
                else if (!isPremium) {
                    const info = document.createElement("p");
                    info.textContent = "Playback not available (Premium only)";
                    info.style.fontStyle = "italic";
                    info.style.fontSize = "11px";
                    info.style.color = "#888";
                    controlsArea.appendChild(info);
                } 
                // 3. Premium OK -> Show PLAY button
                else {
                    const playBtn = document.createElement("button");
                    playBtn.textContent = "▶ Play";
                    playBtn.className = "main-button"; 
                    playBtn.style.marginTop = "5px";
                    
                    // Attach the click event to the playTrack function
                    playBtn.addEventListener("click", () => {
                        playTrack(songUri, playBtn);
                    });
                    controlsArea.appendChild(playBtn);
                }

                // --- ACTION BUTTONS EVENTS ---
                
                // REMOVE BUTTON
                div.querySelector(".removeSongBtn").addEventListener("click", async () => {
                    removeFavSongs(songId);
                });

                // SHARE BUTTON
                div.querySelector(".shareSongBtn").addEventListener("click", () => {
                    // Update data object with the correct URI for the modal
                    data.id = songId;
                    data.uri = songUri; 
                    openShareSongModal(data);
                });

                container.appendChild(div);
            }
        });
    });
}

document.getElementById("btnSearchSong").addEventListener("click", async () => {
  const query = document.getElementById("songSearch").value.trim();
  const resultContainer = document.getElementById("songResults");

  resultContainer.innerHTML = "";

  if (!query) {
    resultContainer.innerHTML = "<p>Please enter a song name.</p>";
    return;
  }

  try {
    // Validate token
    const tokenValid = token && await isSpotifyTokenValid(token);

    if (!tokenValid) {
      resultContainer.innerHTML = ""; 

      const reconnectBtn = document.createElement("button");
      reconnectBtn.textContent = "Connect Spotify";
      reconnectBtn.className = "main-button";
      reconnectBtn.style.marginTop = "10px";

      reconnectBtn.addEventListener("click", () => {
          window.location.href = "test_register_spotify.html";
      });

      resultContainer.appendChild(reconnectBtn);
      return;
    }

    const songs = await searchSong(query);

    if (!songs || songs.length === 0) {
      resultContainer.innerHTML = "<p>No songs found.</p>";
      return;
    }

    songs.forEach(song => {
      const card = document.createElement("div");
      card.classList.add("artistCard");

      card.innerHTML = `
        <img src="${song.album.images?.[0]?.url || 'images/logos/silueta.png'}" />
        <p><strong>${song.name}</strong></p>
        <p>${song.artists[0].name}</p>
        <button class="addSongBtn">Add to favourites</button>
      `;

      card.querySelector(".addSongBtn").addEventListener("click", () => {
        saveFavouriteSong(currentUser.uid, song);
      });

      resultContainer.appendChild(card);
    });

  } catch (error) {
    console.error("Error searching songs:", error);
    resultContainer.innerHTML = "<p>Error searching songs.</p>";
  }
});


function openShareSongModal(track) {
  const modal = document.getElementById("shareSongModal");
  const nameEl = document.getElementById("shareSongName");
  const select = document.getElementById("chatSelectSong");
  const search = document.getElementById("chatSearchSong");

  nameEl.innerText = track.name;

  //Save songs in modal
  modal.dataset.trackId = track.id;
  modal.dataset.trackTitle = track.title;
  modal.dataset.trackArtist = track.artist;
  modal.dataset.trackAlbum = track.album;
  modal.dataset.trackImage = track.albumImageUrl;
  modal.dataset.trackAudioUrl = track.previewUrl;

  loadUserChatsForShare(select, search);

  modal.style.display = "flex";
}

document.getElementById("shareSongCancel").addEventListener("click", () => {
  document.getElementById("shareSongModal").style.display = "none";
});

async function shareSongToChat(chatId, track) {
  const db = getDatabase();
  const timestamp = Date.now();

  const parts = chatId.split("_");
  const user1 = parts[0];
  const user2 = parts[1];

  const messagesRef = ref(db, `chats/${chatId}/messages`);
  const msgKey = push(messagesRef).key;

  const message = {
    sender: currentUser.uid,
    timestamp,
    attachment: {
      id: track.id,
      title: track.title,
      imageURL: track.albumImageUrl || track.albumImageURL || track.albumImage || "",
      author: Array.isArray(track.artist) ? track.artist.join(", ") : track.artist || "Unknown Artist",
      ...(track.previewUrl && { audioURL: track.previewUrl }) 
    },
    text: `Shared song: ${track.title}`
  };
  
  const lastMessageObj = {
    sender: currentUser.uid,
    text: `[Song] ${track.title}`,
    timestamp
  };

  // Prepare updates
  const updates = {};

  updates[`chats/${chatId}/messages/${msgKey}`] = message;
  updates[`chats/${chatId}/createdAt`] = timestamp;
  updates[`chats/${chatId}/users/${user1}`] = true;
  updates[`chats/${chatId}/users/${user2}`] = true;

  updates[`userChats/${currentUser.uid}/${chatId}/lastMessage`] = lastMessageObj;
  updates[`userChats/${currentUser.uid}/${chatId}/isRead`] = true;

  const otherUser = (user1 === currentUser.uid) ? user2 : user1;
  updates[`userChats/${otherUser}/${chatId}/lastMessage`] = lastMessageObj;
  updates[`userChats/${otherUser}/${chatId}/isRead`] = false;

  await update(ref(db), updates);
}

document.getElementById("shareSongConfirm").addEventListener("click", async () => {
  
  const chatId = document.getElementById("chatSelectSong").value;
  const modal = document.getElementById("shareSongModal");

  const track = {
    id: modal.dataset.trackId,
    title: modal.dataset.trackTitle,
    artist: modal.dataset.trackArtist,
    album: modal.dataset.trackAlbum,
    albumImageUrl: modal.dataset.trackImage || modal.dataset.trackimage,
    previewUrl: modal.dataset.trackAudioUrl
  };


  await shareSongToChat(chatId, track);

  modal.style.display = "none";
  alert("Song shared!");
});

// Creaate a shared global object if not exists
if (!globalThis.MelodyStreamAPI) {
    globalThis.MelodyStreamAPI = {};
}

//Open folder modal and load podcasts inside
async function openFolderModal(folderId, folderName = '') {
  // make sure that exists #folder-modal #folder-podcast-list 
  let modal = document.getElementById('folder-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'folder-modal';
    document.body.appendChild(modal);
  }

  // structure inside the modal
  modal.innerHTML = `
    <div class="folder-modal-inner" style="max-width:1100px;width:95%;padding:20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <h2 id="folder-modal-title">${folderName || 'Carpeta'}</h2>
        <button id="folder-modal-close" class="btn">Close</button>
      </div>
      <div id="folder-podcast-list" style="margin-top:16px;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1rem;"></div>
    </div>
  `;
  modal.style.position = 'fixed';
  modal.style.inset = '0';
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
  modal.style.background = 'rgba(0,0,0,0.6)';
  document.getElementById('folder-modal-close')?.addEventListener('click', () => { modal.style.display = 'none'; });

  const listEl = document.getElementById('folder-podcast-list');
  if (!listEl) return;
  listEl.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--color-blanco)">Loading...</p>';
  modal.style.display = 'flex';

  try {
    // try using allPodcasts in memory, if it doesn't exist, fetch from database
    let all = window.allPodcasts || {};
    if (!Object.keys(all).length) {
      const snap = await get(ref(db, 'podcasts'));
      all = snap.exists() ? snap.val() : {};
    }

    const items = [];
    for (const pid in all) {
      if (!Object.prototype.hasOwnProperty.call(all, pid)) continue;
      const p = all[pid];
      if (p.folderId && String(p.folderId) === String(folderId)) {
        items.push({ id: pid, data: p });
      }
    }

    listEl.innerHTML = '';
    if (items.length === 0) {
      listEl.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--color-blanco)">No hay podcasts en esta carpeta.</p>';
      return;
    }

    // create exact cards as in podcast.js
    for (const it of items) {
      const p = it.data;
      const card = document.createElement('div');
      card.className = 'podcast-card';

      const img = document.createElement('img');
      img.src = p.iconURL || 'images/logos/silueta.png';
      img.alt = p.nombre || p.title || 'podcast';
      card.appendChild(img);

      const titleEl = document.createElement('h4');
      titleEl.textContent = p.nombre || p.title || '(Sin título)';
      card.appendChild(titleEl);

      if (p.uploaderName || p.idcreador) {
        const uploader = document.createElement('div');
        uploader.className = 'podcast-uploader';
        let disp = p.uploaderName || p.idcreador;
        if (p.idcreador && window.usersMap && usersMap[p.idcreador]) {
          const u = usersMap[p.idcreador];
          disp = u.username || u.displayName || u.email || p.idcreador;
        }
        uploader.textContent = `Uploaded by: ${disp}`;
        card.appendChild(uploader);
      }

      if (p.descripcion) {
        const desc = document.createElement('p');
        desc.textContent = p.descripcion;
        card.appendChild(desc);
      }

      if (p.audioURL) {
        const audio = document.createElement('audio');
        audio.controls = true;
        audio.src = p.audioURL;
        card.appendChild(audio);
      }

      // buttons: delete and  share 
      const canDelete = (typeof isMasterUser === 'function' && isMasterUser()) ||
                        (currentUser && p.idcreador && String(p.idcreador) === String(currentUser.uid));
      if (canDelete) {
        const del = document.createElement('button');
        del.className = 'btn btn-outline-danger mt-3';
        del.textContent = 'Remove';
        del.addEventListener('click', () => {
          if (!confirm('Confirm delete?')) return;
          if (typeof deletePodcast === 'function') deletePodcast(it.id, p.audioURL, p.iconURL);
        });
        card.appendChild(del);
      }

      const share = document.createElement('button');
      share.className = 'btn btn-outline-primary mt-2';
      share.textContent = 'Share';
      share.addEventListener('click', () => {
        if (typeof promptSharePodcast === 'function') promptSharePodcast(it.id, p);
      });
      card.appendChild(share);

      listEl.appendChild(card);
    }
  } catch (err) {
    console.error('openFolderModal error:', err);
    listEl.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--color-blanco)">Error al cargar podcasts.</p>';
  }
}



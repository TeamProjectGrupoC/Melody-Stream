// --- IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";
import { saveFavouriteSong, saveFavouriteArtist } from "./favourites.js";
import { getDatabase, ref, onValue, set, get, update, push, remove } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-database.js";
const databaseRef = ref;
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-storage.js";

/**
 * ============================================================================
 * MAIN PROFILE
 * ============================================================================

DATABASE STRUCTURE AND LOGIC:
/users/{uid} 
    - Stores profile URL, username, phone.
/podcasts/{pid} 
    - Stores user-uploaded podcasts (idcreador = uid).
    - Can be updated to include 'folderId'.
/folders/{fid} 
    - Stores user-created folders (createdBy = uid) for organizing podcasts.
/users/{uid}/favourite_artists/{artistId} 
    - Stores references to favourite artists (loaded from /artistas).
/users/{uid}/favoritos/{songId} 
    - Stores references to favourite songs (loaded from /canciones).

LOGIC FOR DELETION:
- Deleting a Podcast: Removes entry from /podcasts/{pid} and deletes associated files (audioURL, iconURL) from Storage.
- Deleting a Folder: Removes entry from /folders/{fid} and cleans up 'folderId' from all associated podcasts.

LOGIC FOR SHARING (Artists/Songs):
- Uses loadUsersForShare for user selection.
- Shares content by pushing a new message to /chats/{chatId}/messages with an 'attachment' object.
- Updates /userChats/{uid}/{chatId} (lastMessage and isRead status).
*/

/**
 * MAIN EXECUTION FLOW & FUNCTION SUMMARY:
 * * 1. CONFIGURATION & STATE
 * - Initializes Firebase services (App, DB, Auth, Storage).
 * - Declares global state (currentUser, Spotify tokens/player state).
 * 
 * * 2. SPOTIFY INTEGRATION
 * - isSpotifyTokenValid(token): Checks if the token is active.
 * - initSpotifyPlaybackSDK(): Loads Spotify SDK, connects player, and sets deviceId (Premium required).
 * - IIFE: Auto-starts SDK if tokens are valid.
 * 
 * * 3. PROFILE DATA: cargarDatosDePerfil()
 * - Listener (onAuthStateChanged): Sets currentUser, loads profile data (/users/{uid}).
 * - Calls content loaders: loadUserPodcasts, loadUserFolders, loadFavouriteArtists, loadFavouriteSongs.
 * 
 * * 4. CONTENT MANAGEMENT: loadUserPodcasts(uid) / loadUserFolders(uid)
 * - Fetches user content (podcasts where idcreador=uid, folders where createdBy=uid).
 * - Renders lists with functionality (play, add to folder, REMOVE from DB and Storage).
 * 
 * * 5. PROFILE PICTURE UPLOAD: setupFormUploadListener()
 * - Handles form submission. Uploads file to Storage (`profile_images/{uid}`).
 * - Saves resulting download URL in RTDB (`users/{uid}/urlFotoPerfil`).
 * 
 * * 6. FOLDER MODAL: loadFolderPodcasts(fid, fname)
 * - Renders a modal view displaying all podcasts associated with a given folderId.
 * 
 * * 7. FAV ARTISTS: loadFavouriteArtists(uid) & renderSavedArtists(artists)
 * - Listens to /users/{uid}/favourite_artists, fetches details from /artistas, and renders the list.
 * - Includes search (searchArtist) and Add/Remove/Share functionality.
 * 
 * * 8. FAV SONGS: loadFavouriteSongs(uid) & renderSavedSongs(ids, data)
 * - Listens to /users/{uid}/favoritos, fetches details from /canciones, and renders the list.
 * - Includes Playback (playTrack) and Remove/Share functionality.
 * 
 * * 9. SHARING LOGIC: loadUsersForShare & shareArtistToChat / shareSongToChat
 * - loadUsersForShare: Creates a searchable user picker within the sharing modal (used for both Artists and Songs).
 * - share...ToChat: Constructs a message with an 'attachment' and executes DB updates to send content via chat.
 */

// --- FIREBASE CONFIGURATION ---
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

// --- service initialization ---
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const storage = getStorage(app);
let currentUser = null; 

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

  //If the container does not exist, create it
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

  //Wrapper where podcasts cards will be rendered
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

    //Load all folders from the db
    const foldersSnap = await get(databaseRef(db, 'folders'));
    const userFolders = {};

    //Filter only folders created by current user
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

        //Podcast image
        const img = document.createElement('img');
        img.src = p.iconURL || 'images/logos/silueta.png';
        img.alt = (p.nombre || 'podcast') + ' icon';
        item.appendChild(img);

        //Podcast title
        const title = document.createElement('h4');
        title.textContent = p.nombre || '(no title)';
        item.appendChild(title);

        //Podcast description
        if (p.descripcion) {
          const desc = document.createElement('p');
          desc.textContent = p.descripcion;
          item.appendChild(desc);
        }

        //Podcast audio player
        if (p.audioURL || p.audioUrl || p.audio) {
          const audio = document.createElement('audio');
          audio.controls = true;
          audio.src = p.audioURL || p.audioUrl || p.audio;
          item.appendChild(audio);
        }

        //Folder selection controls
        const controlWrapper = document.createElement('div');
        controlWrapper.className = 'folder-selection-container';

        //Folder label
        const folderLabel = document.createElement('label');
        folderLabel.textContent = 'Folder:';
        folderLabel.htmlFor = `folder-select-${pid}`;

        const select = document.createElement('select');
        select.id = `folder-select-${pid}`;
        
        const noneOpt = document.createElement('option');
        noneOpt.value = '';
        noneOpt.textContent = '-- No folder --';
        select.appendChild(noneOpt);

        //Add user's folders to the dropdown
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
            alert('Error updating folder: ' + (err.message || err));
          }
        });

        //Delete podcast button
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Remove';
        deleteBtn.className = 'btn btn-outline-danger mt-3';
        deleteBtn.addEventListener('click', async () => {
          if (!confirm(`Are you sure you want to delete "${p.nombre || 'this podcast'}"?`)) return;
          try {
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
            //Remove podcast entry from the db
            await remove(databaseRef(db, `podcasts/${pid}`));
            await loadUserPodcasts(uid);
            alert('Podcast deleted successfully');
          } catch (err) {
            alert('Failed to delete podcast: ' + (err.message || err));
          }
        });
        item.appendChild(deleteBtn);

        list.appendChild(item);
      }
    }

    //Render final result
    contentWrapper.innerHTML = '';
    if (found) {
      contentWrapper.appendChild(list);
    } else {
      contentWrapper.innerHTML = '<p class="empty-message">You have not uploaded any podcasts.</p>';
    }

  } catch (err) {
    contentWrapper.innerHTML = '<p class="empty-message">Failed to load your podcasts.</p>';
  }
}

async function loadUserFolders(uid) {
  let container = document.getElementById("userFolders");
  let heading = document.getElementById('folders-heading');

  //If container does not exist, create it
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
  
  // Wrapper for dynamic content
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

      // Only folders created by current user
      if (f.createdBy === uid) {
        found = true;
        const item = document.createElement("div");
        item.className = "folder-item";

        //Folder image
        const img = document.createElement("img");
        img.src = f.iconURL || "images/logos/silueta.png";
        img.alt = f.name + " icon";
        item.appendChild(img);

        //Folder title
        const title = document.createElement("h4");
        title.textContent = f.name || "(no name)";
        item.appendChild(title);

        //Folder description
        if (f.description) {
          const desc = document.createElement("p");
          desc.textContent = f.description;
          item.appendChild(desc);
        }

        // View button
        const viewBtn = document.createElement("button");
        viewBtn.textContent = "View";
        viewBtn.classList.add("main-button", "view-folder");

        //Store folder data in attributes
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
            if (f.iconURL) {
              try {
                const iconRef = storageRef(storage, f.iconURL);
                await deleteObject(iconRef);
              } catch (e) {
                console.warn('Could not delete folder icon from storage:', e);
              }
            }
            //Remove folder from database
            await remove(databaseRef(db, `folders/${fid}`));
            
            //Remove folderID from all podcasts that used this folder
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
            
            await loadUserFolders(uid);
            alert('Folder deleted successfully');
          } catch (err) {
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
    contentWrapper.innerHTML = '<p class="empty-message">Failed to load your folders.</p>';
  }
}

function setupFormUploadListener() {

  const form = document.getElementById('uploadForm');
  const fileInput = document.getElementById('fotoArchivo');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    //Validations
    if (!currentUser) {
      alert("You must be logged in to upload a photo.");
      return;
    }

    //Get selected file
    const file = fileInput.files[0];
    if (!file) {
      alert("Please select a file.");
      return;
    }

    //Create storage path
    const filePath = `profile_images/${currentUser.uid}/${file.name}`;
    const sRef = storageRef(storage, filePath);

    try {
      //Upload file
      alert("Uploading photo...");
      const snapshot = await uploadBytes(sRef, file);

      //Get download url
      const downloadURL = await getDownloadURL(snapshot.ref);

      //Save URL in db
      const userDbRef = databaseRef(db, 'users/' + currentUser.uid + '/urlFotoPerfil');
      await set(userDbRef, downloadURL);

      //Update ui
      document.getElementById('fotoPerfilUsuario').src = downloadURL;
      const headerPic = document.getElementById('headerUserPic');
      if (headerPic) headerPic.src = downloadURL;

      localStorage.setItem('profilePic', downloadURL);

      alert("¡Profile picture updated!");

    } catch (error) {
      alert("Error uploading photo. Check your console.");
    }
  });
}

function createPodcastCard(p) {

  //Create the main wrapper for the podcast card
  const wrapper = document.createElement('div');
  wrapper.className = 'podcast-card';

  //Create thumbnail image element
  const thumb = document.createElement('img');
  thumb.src = p.thumbnail || 'images/logos/default.png';
  thumb.alt = p.title || 'thumbnail';

  //Container for podcast information
  const info = document.createElement('div');
  info.className = 'podcast-card-info';

  //Podcast title
  const title = document.createElement('h3');
  title.textContent = p.title || 'Sin título';

  //Podcast description
  const desc = document.createElement('p');
  desc.textContent = p.description || '';

  info.appendChild(title);
  info.appendChild(desc);

  //Resolver audio source from multiple possible property names
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

  //Get modal elements where podcasts will be rendered
  const listEl = document.getElementById('folder-podcast-list');
  const titleEl = document.getElementById('folder-modal-title');
  if (!listEl || !titleEl) return;
  titleEl.textContent = folderName || 'Loading...';
  listEl.innerHTML = '';
  openModal();

  try {
    //Retrieve all podcasts from the db
    const podsSnap = await get(databaseRef(db, 'podcasts'));
    if (!podsSnap.exists()) {
      listEl.innerHTML = '<p class="modal-empty-message">This folder is empty.</p>';
      return;
    }
    const all = podsSnap.val();
    const items = [];

    //Filter podcasts that belong to the selected folder
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
    titleEl.textContent = 'Error al cargar';
    listEl.innerHTML = '<p class="modal-empty-message">No se pudieron cargar los podcasts.</p>';
  }
}

//------ INITIALIZATION ---------------

//Run when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  cargarDatosDePerfil(); 
  setupFormUploadListener();
});

//------- GLOBAL NAVIGATION HANDLERS ------------
const goToChatBtn = document.getElementById('goToChatBtn');
if (goToChatBtn) {
  goToChatBtn.addEventListener('click', () => {
    window.location.href = 'chat.html';
  });
}

//------ OPEN FOLDER MODAL (EVENT DELEGATION) ---------
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.view-folder');
  if (!btn) return;
  e.preventDefault();
  const fid = btn.dataset.folderId || btn.getAttribute('data-folder-id');
  const fname = btn.dataset.folderName || btn.getAttribute('data-folder-name') || '';
  if (!fid) return console.warn('El botón view necesita data-folder-id');
  loadFolderPodcasts(fid, fname);
});

//Close modal
document.getElementById('folder-modal-close')?.addEventListener('click', closeModal);
document.getElementById('folder-form-close')?.addEventListener('click', closeModal);

document.getElementById('folder-modal')?.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'folder-modal') closeModal();
});


//-----------------------------------------------------------------------------------------------------------------------------------------------------------------------
//FAVOURITE ARTIST SECTION
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
      //Merge artist ID with the stored artist data
      artists.push({ id, ...artistSnap.val() });
    }
  }

  renderSavedArtists(artists);
}

function loadFavouriteArtists(userId) {
  const db = getDatabase();
  const favRef = ref(db, `users/${userId}/favourite_artists`);

  onValue(favRef, snapshot => {
    const favData = snapshot.val() || {}; //Get favourite artists data or an empty object if none exists
    const artistIds = Object.keys(favData);

    fetchArtistData(artistIds);
  });
}


async function removeFavouriteArtist(artistId) {
  const db = getDatabase();

  //Reference to the specific favourite artist of the current user
  const favRef = ref(db, `users/${currentUser.uid}/favourite_artists/${artistId}`);
  await remove(favRef);

  alert("Artist removed from favourites");
}


function renderSavedArtists(artists) {

  //Get containser where saved artist will be rendered
  const container = document.getElementById("savedArtists");
  container.innerHTML = "";

  artists.forEach(a => {
    const div = document.createElement("div");
    div.classList.add("artistCard");

    //Build artist card HTML
    div.innerHTML = `
      <img src="${a.image || 'images/default_artist.png'}" style="width:80px;border-radius:50%">
      <p>${a.name}</p>

      <button class="shareArtistBtn">Share</button>
      <button class="removeArtistBtn">Remove</button>
    `;

    //Remove artist button
    div.querySelector(".removeArtistBtn").addEventListener("click", async () => {
      removeFavouriteArtist(a.id);
    });

    //Share artist button
    div.querySelector(".shareArtistBtn").addEventListener("click", () => {
      openShareArtistModal(a);
    });

    container.appendChild(div);
  });
}

//Event listener for "Search Artist" button
document.getElementById("btnSearchArtist").addEventListener("click", async () => {
  const query = document.getElementById("artistSearch").value.trim();
  const resultContainer = document.getElementById("artistResults");

  resultContainer.innerHTML = ""; 

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

      //Redirect to Spotify connection page on click
      reconnectBtn.addEventListener("click", () => {
          window.location.href = "test_register_spotify.html";
      });

      resultContainer.appendChild(reconnectBtn);
      return;
    }

    //Search for artists via Spotify API
    const artists = await searchArtist(query);

    if (!artists || artists.length === 0) {
      resultContainer.innerHTML = "<p>No artists found.</p>";
      return;
    }

    //Render each artist
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
    resultContainer.innerHTML = "<p>Error searching artists.</p>";
  }
});

//----------SHARE ARTISTS-------------------------------------------------------------------------------------------------------------------
async function loadUsersForShare(selectEl, { modalId, pickerId }) {
  const db = getDatabase();

  selectEl.innerHTML = "";
  selectEl.style.display = "none";

  const modal = document.getElementById(modalId);
  const box = modal.querySelector(".modal-content") || modal;
 
  //Remove global picker if it exists outside the current modal
  const existingGlobal = document.getElementById(pickerId);
  if (existingGlobal && !box.contains(existingGlobal)) {
    existingGlobal.remove();
  }

  //Create the picker if it does not exist
  let picker = box.querySelector(`#${pickerId}`);
  if (!picker) {
    picker = document.createElement("div");
    picker.id = pickerId;

    const search = document.createElement("input");
    search.type = "text";
    search.placeholder = "Search user...";
    search.autocomplete = "off";
    search.className = "user-select-search";

    const list = document.createElement("ul");
    list.className = "user-select-list";

    picker.appendChild(search);
    picker.appendChild(list);

    selectEl.parentNode.insertBefore(picker, selectEl);
  }

  const searchEl = picker.querySelector("input");
  const listEl = picker.querySelector("ul");

  //Escape HTML to prevent injection
  function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/[&<>"']/g, (m) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[m]));
  }
  function norm(s) { return (s || "").toString().toLowerCase().trim(); }

  const usersSnap = await get(ref(db, "users"));
  if (!usersSnap.exists()) {
    listEl.innerHTML = `<li class="user-select-empty">No users found.</li>`;
    return;
  }

  const users = usersSnap.val();
  const usersArray = [];

  //Build array of users and options for the hidden select
  for (const uid in users) {
    if (uid === currentUser.uid) continue;

    const u = users[uid] || {};
    const username = u.username || u.email || "(no name)";
    const email = u.email || "";

    const a = currentUser.uid;
    const b = uid;
    const chatId = a < b ? `${a}_${b}` : `${b}_${a}`;

    const opt = document.createElement("option");
    opt.value = chatId;
    opt.textContent = username;
    selectEl.appendChild(opt);

    usersArray.push({ uid, chatId, username, email });
  }

  //Function to render filtered users
  function render(filtered) {
    listEl.innerHTML = "";

    if (!filtered.length) {
      const li = document.createElement("li");
      li.className = "user-select-empty";
      li.textContent = "No users found.";
      listEl.appendChild(li);
      return;
    }

    filtered.forEach(u => {
      const li = document.createElement("li");
      li.className = "user-select-item";

      //User info
      const info = document.createElement("div");
      info.className = "user-select-info";
      info.innerHTML = `<strong>${escapeHtml(u.username)}</strong>
                        <div class="user-select-email">${escapeHtml(u.email)}</div>`;

      //Select button
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn user-select-btn";
      btn.textContent = "Select";
      btn.addEventListener("click", () => {
        selectEl.value = u.chatId;

        [...listEl.querySelectorAll(".is-selected")]
          .forEach(x => x.classList.remove("is-selected"));
        li.classList.add("is-selected");
      });

      li.appendChild(info);
      li.appendChild(btn);
      listEl.appendChild(li);
    });
  }

  //Initial render with all users
  searchEl.value = "";
  render(usersArray);

  searchEl.oninput = () => {
    const q = norm(searchEl.value);
    const filtered = !q ? usersArray : usersArray.filter(u =>
      norm(u.username).includes(q) || norm(u.email).includes(q)
    );
    render(filtered);
  };

  if (usersArray.length) selectEl.value = usersArray[0].chatId;
}



function openShareArtistModal(artist) {
  const modal = document.getElementById("shareArtistModal");
  const nameEl = document.getElementById("shareArtistName");
  const select = document.getElementById("chatSelect");

  nameEl.innerText = artist.name;

  //Store artist data in modal's dataset
  modal.dataset.artistId = artist.id;
  modal.dataset.artistName = artist.name;
  modal.dataset.artistImage = artist.image;

  //Load de users into the custom picker
  loadUsersForShare(select, { modalId: "shareArtistModal", pickerId: "shareArtistUserPicker" });

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

//------------------SONGS---------------------
async function searchSong(query) {
  const token = getSpotifyUserToken(); //Get spotify user acces token

  //make a reques to spotify search api
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

    //If a different track is currently playing, pause it first
    if (currentPlayingUri && currentPlayingUri !== uri) {
        await fetch(
            `https://api.spotify.com/v1/me/player/pause?device_id=${deviceId}`,
            { method: "PUT", headers: { Authorization: `Bearer ${token}` } }
        );

        if (currentActivePlayButton) {
            currentActivePlayButton.textContent = "▶ Play";
        }
    }

    //If the same track is playing, pause it
    if (currentPlayingUri === uri && currentPlayingUri && playButton.textContent === "⏹ Stop") {
        await fetch(
            `https://api.spotify.com/v1/me/player/pause?device_id=${deviceId}`,
            { method: "PUT", headers: { Authorization: `Bearer ${token}` } }
        );

        playButton.textContent = "▶ Play";
        currentPlayingUri = null;
        return;
    }

    //Play the selected track
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

    //Update current playing state
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
    resultContainer.innerHTML = "<p>Error searching songs.</p>";
  }
});


function openShareSongModal(track) {
  const modal = document.getElementById("shareSongModal");
  const nameEl = document.getElementById("shareSongName");
  const select = document.getElementById("chatSelectSong");

  nameEl.innerText = track.name;

  //Save songs in modal
  modal.dataset.trackId = track.id;
  modal.dataset.trackTitle = track.title;
  modal.dataset.trackArtist = track.artist;
  modal.dataset.trackAlbum = track.album;
  modal.dataset.trackImage = track.albumImageUrl;
  modal.dataset.trackAudioUrl = track.previewUrl;

  loadUsersForShare(select, { modalId: "shareSongModal", pickerId: "shareSongUserPicker" });

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

  //create a track object from modal dataset
  const track = {
    id: modal.dataset.trackId,
    title: modal.dataset.trackTitle,
    artist: modal.dataset.trackArtist,
    album: modal.dataset.trackAlbum,
    albumImageUrl: modal.dataset.trackImage || modal.dataset.trackimage,
    previewUrl: modal.dataset.trackAudioUrl
  };

  await shareSongToChat(chatId, track); //share song to selected chat

  modal.style.display = "none";
  alert("Song shared!");
});

//Create a global object shared between modules
if (!globalThis.MelodyStreamAPI) {
    globalThis.MelodyStreamAPI = {};
}

//Function to open a folder modal and display its podcast
async function openFolderModal(folderId, folderName = '') {
  let modal = document.getElementById('folder-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'folder-modal';
    document.body.appendChild(modal);
  }

  //Modal content structure
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

    //Render each podcast card
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

      //Show uploader info if avaliable
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

      //Share button for each podcast
      const share = document.createElement('button');
      share.className = 'btn btn-outline-primary mt-2';
      share.textContent = 'Share';
      share.addEventListener('click', () => {
        if (typeof promptSharePodcast === 'function') promptSharePodcast(it.id, p);
      });
      card.appendChild(share);

      listEl.appendChild(card); //Add poscast card to the list
    }
  } catch (err) {
    listEl.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--color-blanco)">Error al cargar podcasts.</p>';
  }
}



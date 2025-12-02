// --- IMPORTACIONES ---
// Módulos de App y Autenticación (como los tenías)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";
import { saveFavouriteSong, saveFavouriteArtist } from "./favourites.js";

// Módulos de Realtime Database (RTDB)
import { getDatabase, ref, onValue, set, get, update, push, remove } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-database.js";
const databaseRef = ref;

// Módulos de Storage
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-storage.js";

// --- CONFIGURACIÓN DE FIREBASE ---
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

// --- INICIALIZACIÓN DE SERVICIOS ---
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const storage = getStorage(app);
let currentUser = null; // Guardaremos el usuario aquí para que la función de subida lo vea

// --- FUNCIÓN DE CARGA DE DATOS
function cargarDatosDePerfil() {
  const imagenElemento = document.getElementById('fotoPerfilUsuario');
  const msgElemento = document.getElementById('msg');

  if (!imagenElemento || !msgElemento) {
    console.error("Faltan elementos HTML (msg o fotoPerfilUsuario)");
    return;
  }

  onAuthStateChanged(auth, async (user) => {
    currentUser = user; // Guardamos el usuario actual

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
          // Mostrar datos de perfil
          userDataDiv.style.display = 'block';
          userDataDiv.innerHTML = `
            <h2 class="profileInformation">Profile Information</h2>
            <p><strong>Username:</strong> ${userData.username || "—"}</p>
            <p><strong>Phone:</strong> ${userData.phone || "—"}</p>
            <p><strong>Email:</strong> ${user.email}</p>
          `;

          // Mostrar foto de perfil si existe
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


      // Cargar y mostrar los podcasts subidos por este usuario
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

      // Limpiar lista de podcasts al cerrar sesión
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

        // Imagen
        const img = document.createElement('img');
        img.src = p.iconURL || 'images/logos/silueta.png';
        img.alt = (p.nombre || 'podcast') + ' icon';
        item.appendChild(img);

        // Título
        const title = document.createElement('h4');
        title.textContent = p.nombre || '(no title)';
        item.appendChild(title);

        // Descripción
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

        // Select de carpetas
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

        // Botón "Add to folder"
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

        // Título
        const title = document.createElement("h4");
        title.textContent = f.name || "(no name)";
        item.appendChild(title);

        // Descripción
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

    // 1. Validaciones
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
    const sRef = storageRef(storage, filePath); // Usamos storageRef

    try {
      // 3. Subir el archivo
      alert("Uploading photo...");
      const snapshot = await uploadBytes(sRef, file);
      console.log('Photo uploaded!', snapshot);

      // 4. Obtener la URL de descarga
      const downloadURL = await getDownloadURL(snapshot.ref);
      console.log('File URL:', downloadURL);

      // 5. Guardar la URL en Realtime Database
      const userDbRef = databaseRef(db, 'users/' + currentUser.uid + '/urlFotoPerfil');
      await set(userDbRef, downloadURL);

      // 6. Actualizar la imagen en la página (la silueta)
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

  // Audio player si existe
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

// --- INICIAR LAS FUNCIONES ---
// Cuando el HTML esté cargado, ejecuta ambas funciones
document.addEventListener('DOMContentLoaded', () => {
  cargarDatosDePerfil(); // Carga el email y la foto existente
  setupFormUploadListener(); // Prepara el formulario de subida
});

// handlers globales que usan los elementos si existen
const goToChatBtn = document.getElementById('goToChatBtn');
if (goToChatBtn) {
  goToChatBtn.addEventListener('click', () => {
    window.location.href = 'chat.html';
  });
}

/*const logOutBtn = document.getElementById('logOutBtn');
if (logOutBtn) {
  logOutBtn.addEventListener('click', async () => {
    const msgElemento = document.getElementById('msg');
    const fotoElemento = document.getElementById('fotoPerfilUsuario');

    try {
      await signOut(auth);

      if (msgElemento) msgElemento.textContent = "You have successfully logged out.";

      if (fotoElemento) {
        fotoElemento.src = "images/logos/silueta.png";
      }

      const userDataDiv = document.getElementById('userData');
      if (userDataDiv) userDataDiv.style.display = "none";

      window.location.href = 'login.html';
    } catch (error) {
      console.error("Log out error:", error);
      if (msgElemento) msgElemento.textContent = "Error logging out.";
    }
  });
}*/

// Evento para abrir modal al hacer click en botón .view-folder (delegación)
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.view-folder');
  if (!btn) return;
  e.preventDefault();
  const fid = btn.dataset.folderId || btn.getAttribute('data-folder-id');
  const fname = btn.dataset.folderName || btn.getAttribute('data-folder-name') || '';
  if (!fid) return console.warn('El botón view necesita data-folder-id');
  loadFolderPodcasts(fid, fname);
});

// Cerrar modal - botones existentes en DOM
document.getElementById('folder-modal-close')?.addEventListener('click', closeModal);
document.getElementById('folder-form-close')?.addEventListener('click', closeModal);

// cerrar al hacer click fuera del contenido
document.getElementById('folder-modal')?.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'folder-modal') closeModal();
});




//-----------------------------------------------------------------------------------------------------------------------------------------------------------------------
//SECCION DE ARTISTAS FAVORITOS
function getSpotifyUserToken() {
  return localStorage.getItem("spotify_access_token");
}

async function searchArtist(query) {
  const token = getSpotifyUserToken();
  if (!token) {
    alert("Please sign in with Spotify first.");
    return [];
  }

  const resp = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=artist&limit=6`,
    { headers: { "Authorization": "Bearer " + token } }
  );

  const data = await resp.json();
  return data.artists.items;
}

function loadFavouriteArtists(userId) {
  const db = getDatabase();
  const favRef = ref(db, `users/${userId}/favourite_artists`);

  onValue(favRef, async snapshot => {
    const favData = snapshot.val() || {};

    const artistIds = Object.keys(favData);

    const artists = [];

    for (const id of artistIds) {
      const artistSnap = await get(ref(db, `artistas/${id}`));
      if (artistSnap.exists()) {
        artists.push({ id, ...artistSnap.val() });
      }
    }

    renderSavedArtists(artists);
  });
}

async function removeFavouriteArtist(artistId) {
  const db = getDatabase();
  const favRef = ref(db, `users/${currentUser.uid}/favourite_artists`);

  // obtenemos los favoritos actuales para saber la key exacta
  const snapshot = await get(favRef);
  const favs = snapshot.val() || {};

  // buscar la key que corresponde a ese artista
  const keyToDelete = Object.keys(favs).find(key => favs[key].id === artistId);

  if (!keyToDelete) {
    console.warn("Artist not found in favourites:", artistId);
    return;
  }

  // eliminar el artista
  await set(ref(db, `users/${currentUser.uid}/favourite_artists/${keyToDelete}`), null);

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

  resultContainer.innerHTML = ""; // limpia resultados previos

  if (query === "") {
    resultContainer.innerHTML = "<p>Please enter an artist name.</p>";
    return;
  }

  try {
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
        alert(`${artist.name} added to favourites`);
      });

      resultContainer.appendChild(card);
    });

  } catch (error) {
    console.error("Error searching artists:", error);
    resultContainer.innerHTML = "<p>Error searching artists.</p>";
  }
});

//----------SHARE ARTISTS-------------------------------------------------------------------------------------------------------------------

async function loadUserChatsForShare(selectEl) {
  const db = getDatabase();
  const chatsRef = ref(db, `userChats/${currentUser.uid}`);

  const snapshot = await get(chatsRef);
  const data = snapshot.val() || {};

  selectEl.innerHTML = "";

  for (const chatId in data) {

    // 1. Obtener los dos UIDs del chat
    const parts = chatId.split("_");
    const userA = parts[0];
    const userB = parts[1];

    // 2. Saber quién es el otro usuario
    const otherUid = (userA === currentUser.uid) ? userB : userA;

    // 3. Obtener datos del otro usuario
    const userSnap = await get(ref(db, `users/${otherUid}`));
    const userData = userSnap.val();

    const displayedName = userData?.username || userData?.email || otherUid;

    // 4. Crear la opción
    const option = document.createElement("option");
    option.value = chatId;
    option.textContent = displayedName;

    selectEl.appendChild(option);
  }
}


function openShareArtistModal(artist) {
  const modal = document.getElementById("shareArtistModal");
  const nameEl = document.getElementById("shareArtistName");
  const select = document.getElementById("chatSelect");

  nameEl.innerText = artist.name;

  // guardamos datos del artista en el modal
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
  const messagesRef = ref(db, `chats/${chatId}/messages`);
  const chatRef = ref(db, `chats/${chatId}`);
  const timestamp = Date.now();

  const message = {
    sender: currentUser.uid,
    timestamp,
    attachment: {
      id: artist.id,
      title: artist.name,
      imageURL: artist.image,
      author: "Favourite Artist",
      audioURL: "" // no hay audio
    },
    text: `Shared artist: ${artist.name}`
  };

  const msgKey = push(messagesRef).key;
  await set(ref(db, `chats/${chatId}/messages/${msgKey}`), message);

  // Actualizar createdAt solo
  await update(chatRef, { createdAt: timestamp });


  // actualizar lista userChats
  const lastMessageObj = {
    sender: currentUser.uid,
    text: `[Artist] ${artist.name}`,
    timestamp
  };

  await update(ref(db, `userChats/${currentUser.uid}/${chatId}`), {
    lastMessage: lastMessageObj
  });

  // para el otro usuario
  const parts = chatId.split("_");
  const otherUser = parts[0] === currentUser.uid ? parts[1] : parts[0];

  await update(ref(db, `userChats/${otherUser}/${chatId}`), {
    lastMessage: lastMessageObj
  });
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
  if (!token) {
    alert("Please sign in with Spotify first.");
    return [];
  }

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

async function removeFavSongs(songId){
  const db = getDatabase();

  const favSongRef = ref(db, `users/${currentUser.uid}/favoritos/${songId}`);
  await remove(favSongRef);

  const songRef = ref(db, `canciones/${songId}`);
  await remove(songRef);

  console.log(`Song with id ${songId} removed from favorites`);
}

function renderSavedSongs(songIds, favorites) {
  const container = document.getElementById("savedSongs");
  container.innerHTML = "";

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
        div.innerHTML = `
          <img src="${data.albumImageUrl || 'images/logos/silueta.png'}" style="width:80px; border-radius:10px;">
          <p><strong>${data.title}</strong></p>
          <p>${artistNames}</p>
          ${data.previewUrl ? `<audio controls src="${data.previewUrl}" style="width:100%"></audio>` : "<p>No preview available</p>"}

          <button class="shareSongBtn">Share</button>
          <button class="removeSongBtn">Remove</button>
        `;

        //REMOVE
        div.querySelector(".removeSongBtn").addEventListener("click", async () => {
          removeFavSongs(songId);
        });

        //SHARE
        div.querySelector(".shareSongBtn").addEventListener("click", () => {
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
        alert(`${song.name} added to favourites`);
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

  nameEl.innerText = track.name;

  //Save songs in modal
  modal.dataset.trackId = track.id;
  modal.dataset.trackTitle = track.title;
  modal.dataset.trackArtist = track.artist;
  modal.dataset.trackAlbum = track.album;
  modal.dataset.trackImage = track.albumImageUrl;
  modal.dataset.trackAudioUrl = track.previewUrl;

  loadUserChatsForShare(select);

  modal.style.display = "flex";
}

document.getElementById("shareSongCancel").addEventListener("click", () => {
  document.getElementById("shareSongModal").style.display = "none";
});

async function shareSongToChat(chatId, track) {
  const db = getDatabase();
  const messagesRef = ref(db, `chats/${chatId}/messages`);
  const chatRef = ref(db, `chats/${chatId}`);
  const timestamp = Date.now();

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

  const msgKey = push(messagesRef).key;
  await set(ref(db, `chats/${chatId}/messages/${msgKey}`), message);

  await update(chatRef, { createdAt: timestamp });

  const lastMessageObj = {
    sender: currentUser.uid,
    text: `[Song] ${track.title}`,
    timestamp
  };

  await update(ref(db, `userChats/${currentUser.uid}/${chatId}`), {
    lastMessage: lastMessageObj
  });

  const parts = chatId.split("_");
  const otherUser = parts[0] === currentUser.uid ? parts[1] : parts[0];

  await update(ref(db, `userChats/${otherUser}/${chatId}`), {
    lastMessage: lastMessageObj
  });
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

// Crea un objeto global compartido entre módulos
if (!globalThis.MelodyStreamAPI) {
    globalThis.MelodyStreamAPI = {};
}



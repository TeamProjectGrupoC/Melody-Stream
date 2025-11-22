// ...existing code...
// --- IMPORTACIONES ---
// Módulos de App y Autenticación (como los tenías)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";

// Módulos de Realtime Database (RTDB)
import { getDatabase, ref as databaseRef, onValue, set, get, update, push } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-database.js";

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
            <h3>Profile Information</h3>
            <p><strong>Username:</strong> ${userData.username || "—"}</p>
            <p><strong>Phone:</strong> ${userData.phone || "—"}</p>
            <p><strong>Email:</strong> ${user.email}</p>
            <p><strong>Favorite Songs:</strong> ${
              userData.favorite_songs
                ? Object.keys(userData.favorite_songs).join(", ")
                : "—"
            }</p>
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


      // Cargar y mostrar los podcasts subidos por este usuario
      loadUserPodcasts(user.uid);
      loadUserFolders(user.uid);
      loadFavouriteArtists(user.uid);


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

    }
  });
}

async function loadUserPodcasts(uid) {
  // Asegurarse de que exista un contenedor en el HTML para mostrar los podcasts
  let container = document.getElementById('userPodcasts');
  if (!container) {
    container = document.createElement('div');
    container.id = 'userPodcasts';
    const heading = document.createElement('h3');
    heading.textContent = 'My Podcasts';
    const profileMain = document.querySelector('main') || document.body;
    profileMain.appendChild(heading);
    profileMain.appendChild(container);
  }

  container.innerHTML = 'Loading your podcasts...';

  try {
    const podcastsRef = databaseRef(db, 'podcasts');
    const snapshot = await get(podcastsRef);

    if (!snapshot.exists()) {
      container.innerHTML = '<p>You have not uploaded any podcasts.</p>';
      return;
    }

    const podcasts = snapshot.val();
    const list = document.createElement('div');
    let found = false;

    // cargar las carpetas del usuario una sola vez para reutilizar en cada podcast
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
        item.className = 'podcast-item';
        item.style.border = '1px solid #ccc';
        item.style.padding = '8px';
        item.style.marginBottom = '10px';
        item.style.borderRadius = '6px';

        const title = document.createElement('h4');
        title.textContent = p.nombre || '(no title)';
        item.appendChild(title);

        if (p.iconURL) {
          const img = document.createElement('img');
          img.src = p.iconURL;
          img.alt = (p.nombre || '') + ' icon';
          img.style.maxWidth = '120px';
          img.style.display = 'block';
          img.style.marginBottom = '8px';
          item.appendChild(img);
        }

        if (p.descripcion) {
          const desc = document.createElement('p');
          desc.textContent = p.descripcion;
          item.appendChild(desc);
        }

        if (p.audioURL || p.audioUrl || p.audio) {
          const audio = document.createElement('audio');
          audio.controls = true;
          audio.src = p.audioURL || p.audioUrl || p.audio;
          audio.style.width = '100%';
          item.appendChild(audio);
        }

        // Select para asignar a carpeta (usa las carpetas del usuario)
        const folderRow = document.createElement('div');
        folderRow.style.marginTop = '8px';
        const folderLabel = document.createElement('label');
        folderLabel.textContent = 'Folder: ';
        folderLabel.htmlFor = `folder-select-${pid}`;
        folderRow.appendChild(folderLabel);

        const select = document.createElement('select');
        select.id = `folder-select-${pid}`;
        const noneOpt = document.createElement('option');
        noneOpt.value = '';
        noneOpt.textContent = '-- No folder --';
        select.appendChild(noneOpt);

        // añadir opciones de las carpetas del usuario
        for (const fid in userFolders) {
          const opt = document.createElement('option');
          opt.value = fid;
          opt.textContent = userFolders[fid].name || fid;
          if (p.folderId && String(p.folderId) === String(fid)) opt.selected = true;
          select.appendChild(opt);
        }

        // Si no tienes carpetas, mostrar enlace para crear una
        if (Object.keys(userFolders).length === 0) {
          const hint = document.createElement('small');
          hint.style.display = 'block';
          hint.style.marginTop = '6px';
          hint.innerHTML = 'You have no folders. <a href="folder_upload.html">Create one</a>';
          folderRow.appendChild(select);
          item.appendChild(folderRow);
          item.appendChild(hint);
        } else {
          folderRow.appendChild(select);
          item.appendChild(folderRow);
        }

        // Botón único: "Add to folder" (usa el select para asignar/quitar carpeta)
        const addBtn = document.createElement('button');
        addBtn.textContent = 'Add to folder';
        addBtn.style.marginLeft = '8px';
        addBtn.addEventListener('click', async () => {
          const chosen = select.value || null;
          try {
            await update(databaseRef(db, `podcasts/${pid}`), { folderId: chosen });
            addBtn.textContent = 'Saved';
            setTimeout(() => (addBtn.textContent = 'Add to folder'), 900);
          } catch (err) {
            console.error('Error updating podcast folder:', err);
            alert('Error updating folder: ' + (err.message || err));
          }
        });
        folderRow.appendChild(addBtn);

        // Nota: para ver los podcasts de una carpeta, usa la lista de carpetas (se muestra en "My Folders")
        item.appendChild(folderRow);
        list.appendChild(item);
      }
    }

    container.innerHTML = '';
    if (found) {
      container.appendChild(list);
    } else {
      container.innerHTML = '<p>You have not uploaded any podcasts.</p>';
    }

  } catch (err) {
    console.error('Error loading user podcasts:', err);
    container.innerHTML = '<p>Failed to load your podcasts.</p>';
  }
}

// carga las carpetas del usuario y crea botón "View" que abre modal en la misma página
async function loadUserFolders(uid) {
  let container = document.getElementById("userFolders");
  if (!container) {
    container = document.createElement("div");
    container.id = "userFolders";
    const heading = document.createElement("h3");
    heading.textContent = "My Folders";
    const profileMain = document.querySelector("main") || document.body;
    profileMain.appendChild(heading);
    profileMain.appendChild(container);
  }

  container.innerHTML = "Loading your folders...";

  try {
    const foldersRef = databaseRef(db, "folders");
    const snap = await get(foldersRef);
    if (!snap.exists()) {
      container.innerHTML = "<p>You have not created any folders.</p>";
      return;
    }

    const folders = snap.val();
    const list = document.createElement("div");
    let found = false;
    for (const fid in folders) {
      const f = folders[fid];
      if (f.createdBy === uid) {
        found = true;
        const item = document.createElement("div");
        item.className = "folder-item";
        item.style.border = "1px solid #ccc";
        item.style.padding = "8px";
        item.style.marginBottom = "10px";
        item.style.borderRadius = "6px";

        const title = document.createElement("h4");
        title.textContent = f.name || "(no name)";
        item.appendChild(title);

        if (f.iconURL) {
          const img = document.createElement("img");
          img.src = f.iconURL;
          img.alt = f.name + " icon";
          img.style.maxWidth = "120px";
          img.style.display = "block";
          img.style.marginBottom = "8px";
          item.appendChild(img);
        }

        // View button: NO redirige, abre modal y carga podcasts en la misma página
        const viewBtn = document.createElement("button");
        viewBtn.textContent = "View";
        viewBtn.className = "view-folder";
        viewBtn.setAttribute('data-folder-id', fid);
        viewBtn.setAttribute('data-folder-name', f.name || '');
        viewBtn.style.marginRight = "8px";
        item.appendChild(viewBtn);

        list.appendChild(item);
      }
    }

    container.innerHTML = "";
    if (found) container.appendChild(list);
    else container.innerHTML = "<p>You have not created any folders.</p>";
  } catch (err) {
    console.error("Error loading user folders:", err);
    container.innerHTML = "<p>Failed to load your folders.</p>";
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

// --- Modal + helpers para listar podcasts en la misma página ---
function createPodcastCard(p) {
  const wrapper = document.createElement('div');
  wrapper.className = 'podcast-card';
  wrapper.style.display = 'flex';
  wrapper.style.gap = '12px';
  wrapper.style.alignItems = 'flex-start';
  wrapper.style.border = '1px solid #eee';
  wrapper.style.padding = '8px';
  wrapper.style.borderRadius = '6px';

  const thumb = document.createElement('img');
  thumb.src = p.thumbnail || 'images/logos/default.png';
  thumb.alt = p.title || 'thumbnail';
  thumb.style.width = '120px';
  thumb.style.height = 'auto';
  thumb.style.objectFit = 'cover';
  thumb.style.borderRadius = '4px';

  const meta = document.createElement('div');
  meta.style.flex = '1';

  const title = document.createElement('h3');
  title.textContent = p.title || 'Sin título';
  title.style.margin = '0 0 6px 0';

  const author = document.createElement('p');
  author.textContent = p.author ? `Autor: ${p.author}` : '';
  author.style.margin = '0 0 6px 0';
  author.style.fontSize = '0.9rem';
  author.style.color = '#555';

  const desc = document.createElement('p');
  desc.textContent = p.description || '';
  desc.style.margin = '0 0 8px 0';
  desc.style.color = '#444';

  const metaRow = document.createElement('div');
  metaRow.style.display = 'flex';
  metaRow.style.gap = '12px';
  metaRow.style.flexWrap = 'wrap';

  if (p.duration) {
    const dur = document.createElement('span');
    dur.textContent = `Duración: ${p.duration}`;
    dur.style.fontSize = '0.85rem';
    dur.style.color = '#666';
    metaRow.appendChild(dur);
  }

  if (p.date) {
    const date = document.createElement('span');
    date.textContent = p.date;
    date.style.fontSize = '0.85rem';
    date.style.color = '#666';
    metaRow.appendChild(date);
  }

  const actions = document.createElement('div');
  actions.style.marginTop = '8px';
  actions.style.display = 'flex';
  actions.style.flexDirection = 'column';
  actions.style.gap = '8px';

  // Reproducir en el modal: crear elemento audio si hay URL
  const audioSrc = p.audioURL || p.audioUrl || p.audio || p.url || p.audio_src || '';
  if (audioSrc) {
    const audioEl = document.createElement('audio');
    audioEl.controls = true;
    audioEl.src = audioSrc;
    audioEl.style.width = '100%';
    actions.appendChild(audioEl);

    // Añadir botón de descargar (opcional)
    const dl = document.createElement('a');
    dl.href = audioSrc;
    dl.download = '';
    dl.textContent = 'Download';
    dl.style.display = 'inline-block';
    dl.style.padding = '6px 10px';
    dl.style.border = '1px solid #ccc';
    dl.style.borderRadius = '4px';
    dl.style.background = '#fafafa';
    dl.style.textDecoration = 'none';
    dl.style.color = '#222';
    actions.appendChild(dl);
  } else {
    const noAudio = document.createElement('small');
    noAudio.textContent = 'No audio disponible';
    noAudio.style.color = '#777';
    actions.appendChild(noAudio);
  }

  meta.appendChild(title);
  meta.appendChild(author);
  meta.appendChild(desc);
  meta.appendChild(metaRow);
  meta.appendChild(actions);

  wrapper.appendChild(thumb);
  wrapper.appendChild(meta);

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
  titleEl.textContent = 'Cargando...';
  listEl.innerHTML = '';
  openModal();

  try {
    const podsSnap = await get(databaseRef(db, 'podcasts'));
    if (!podsSnap.exists()) {
      listEl.textContent = 'No hay podcasts en esta carpeta.';
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
          author: p.autor || p.author || '',
          description: p.descripcion || p.description || '',
          thumbnail: p.iconURL || p.thumbnail || '',
          audioURL: p.audioURL || p.audioUrl || p.audio || p.url || p.audio_src || '',
          duration: p.duracion || p.duration || '',
          date: p.fecha || p.date || ''
        });
      }
    }

    titleEl.textContent = folderName && folderName.trim() !== '' ? folderName : `Carpeta ${folderId}`;
    if (items.length === 0) {
      listEl.textContent = 'No hay podcasts en esta carpeta.';
      return;
    }
    items.forEach(p => listEl.appendChild(createPodcastCard(p)));
  } catch (err) {
    console.error(err);
    titleEl.textContent = 'Error al cargar';
    listEl.textContent = 'No se pudieron cargar los podcasts. Revisa la consola.';
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

const logOutBtn = document.getElementById('logOutBtn');
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

    } catch (error) {
      console.error("Log out error:", error);
      if (msgElemento) msgElemento.textContent = "Error logging out.";
    }
  });
}

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


function saveFavouriteArtist(userId, artist) {
  const db = getDatabase();
  const favRef = ref(db, `users/${userId}/favourite_artists/`);
  const newFav = push(favRef);

  return set(newFav, {
    id: artist.id,
    name: artist.name,
    image: artist.images?.[0]?.url || "",
    followers: artist.followers.total,
    genres: artist.genres
  });
}


function loadFavouriteArtists(userId) {
  const db = getDatabase();
  const favRef = ref(db, `users/${userId}/favourite_artists`);

  onValue(favRef, snapshot => {
    const data = snapshot.val() || {};
    renderSavedArtists(Object.values(data));
  });
}

function renderSavedArtists(artists) {
  const container = document.getElementById("savedArtists");
  container.innerHTML = "";

  artists.forEach(a => {
    const div = document.createElement("div");
    div.classList.add("artistCard");
    div.innerHTML = `
      <img src="${a.image}" style="width:80px;border-radius:50%">
      <p>${a.name}</p>
    `;
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
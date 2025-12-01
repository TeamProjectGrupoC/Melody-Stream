// --- IMPORTACIONES DE FIREBASE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js";
import { getDatabase, ref, onValue, query, orderByChild, equalTo } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-database.js";

// --- TU CONFIGURACIÓN (Asegúrate que sea la correcta) ---
const firebaseConfig = {
    apiKey: "TU_API_KEY", // <--- PON TU API KEY AQUÍ O MANTÉN LA QUE YA TENGAS
    authDomain: "melodystream123.firebaseapp.com",
    databaseURL: "https://melodystream123-default-rtdb.europe-west1.firebasedatabase.app", // <--- REVISA QUE SEA ESTA URL
    projectId: "melodystream123",
    storageBucket: "melodystream123.firebasestorage.app",
    messagingSenderId: "640160988809",
    appId: "1:640160988809:web:d0995d302123ccf0431058"
};

// Inicializar
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ID de Chopin según tu base de datos (marioartista -> chopin -> idartista: 1)
const ARTIST_ID = 1; 

document.addEventListener('DOMContentLoaded', () => {
    cargarAlbums();
});

// --- 1. CARGAR ÁLBUMES AL DESPLEGABLE ---
function cargarAlbums() {
    const albumsRef = ref(db, 'marioalbums');
    const selectElement = document.getElementById('albumSelect');

    // Escuchamos 'marioalbums'
    onValue(albumsRef, (snapshot) => {
        selectElement.innerHTML = '<option value="" disabled selected>Selecciona un álbum...</option>';
        const data = snapshot.val();

        if (data) {
            // Recorremos todos los álbumes para buscar los de Chopin (idartista == 1)
            Object.keys(data).forEach(key => {
                const album = data[key];
                // 'key' es el nombre del álbum (ej: "Nocturnos de Chopin")
                // 'album' es el objeto {idalbum: X, idartista: Y}
                
                if (album.idartista == ARTIST_ID) {
                    const option = document.createElement('option');
                    option.value = album.idalbum; // El valor será el ID numérico (ej: 4)
                    option.textContent = key;     // El texto visible será el nombre del álbum
                    selectElement.appendChild(option);
                }
            });
        }
    });

    // Añadimos el evento para cuando el usuario cambie de álbum
    selectElement.addEventListener('change', (e) => {
        const albumIdSeleccionado = e.target.value;
        cargarCanciones(albumIdSeleccionado);
    });
}

// --- 2. CARGAR CANCIONES DEL ÁLBUM SELECCIONADO ---
function cargarCanciones(albumId) {
    const cancionesRef = ref(db, 'mariocanciones');
    const songsContainer = document.getElementById('songsContainer');
    const songList = document.getElementById('songList');
    
    // Mostramos el contenedor
    songsContainer.style.display = 'block';
    songList.innerHTML = 'Cargando canciones...';

    onValue(cancionesRef, (snapshot) => {
        songList.innerHTML = ''; // Limpiar lista
        const data = snapshot.val();

        if (data) {
            let cancionesEncontradas = false;

            Object.keys(data).forEach(key => {
                const cancion = data[key];
                // Filtramos por idalbum. Nota: albumId viene del select como string, convertimos a int si es necesario
                if (cancion.idalbum == albumId) {
                    cancionesEncontradas = true;
                    
                    const li = document.createElement('li');
                    li.textContent = key; // 'key' es el nombre de la canción (ej: "AHORA QUÉ")
                    li.className = 'song-item';
                    
                    // Al hacer click, reproducimos
                    li.addEventListener('click', () => {
                        // AQUÍ BUSCAMOS EL LINK DE SPOTIFY
                        // Asumimos que añadiste el campo "spotify_uri" en la base de datos
                        // Si no existe, usamos uno de prueba o mostramos alerta
                        const uri = cancion.spotify_uri || ""; 
                        reproducirSpotify(uri);
                    });

                    songList.appendChild(li);
                }
            });

            if (!cancionesEncontradas) {
                songList.innerHTML = '<li>No hay canciones en este álbum todavía.</li>';
            }
        }
    });
}

// --- 3. REPRODUCIR (INSERTAR IFRAME) ---
function reproducirSpotify(uri) {
    const playerContainer = document.getElementById('playerContainer');
    const embedContainer = document.getElementById('spotifyEmbed');

    if (!uri) {
        alert("Esta canción no tiene enlace de Spotify configurado en la base de datos.");
        return;
    }

    // Convertir URI de Spotify (spotify:track:...) a URL Embed (https://open.spotify.com/embed/...)
    // O si guardas el link entero "https://open.spotify.com/track/...", hay que ajustarlo.
    // Asumiremos que guardas la URI tipo "spotify:track:XXXXX"
    
    // Truco: Reemplazamos los dos puntos para formar la URL
    // De: spotify:track:12345 
    // A:  https://open.spotify.com/embed/track/12345
    
    let embedUrl = "";
    if (uri.startsWith('spotify:')) {
        const parts = uri.split(':');
        embedUrl = `https://open.spotify.com/embed/${parts[1]}/${parts[2]}`;
    } else {
        // Si pegaste el link HTTP directo
        embedUrl = uri; 
    }

    playerContainer.style.display = 'block';
    embedContainer.innerHTML = `
        <iframe 
            src="${embedUrl}" 
            width="100%" 
            height="152" 
            frameBorder="0" 
            allowfullscreen="" 
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
            loading="lazy">
        </iframe>
    `;
}
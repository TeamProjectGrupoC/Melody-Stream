// ============================================================================
// 1. IMPORT FIREBASE MODULES (Version 9.0.0)
// ============================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js";
import { getStorage, ref, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-storage.js";

// ============================================================================
// 2. FIREBASE CONFIGURATION
// ============================================================================
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

// Initialize App and Storage
const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

// ============================================================================
// 3. ARTIST DATA (Maria Pages)
// ============================================================================
const datosMaria = {
    "album_1": {
        "nombre": "RECOPILATORIO",
        "canciones": [
            { 
                "titulo": "FIREDANCE", 
                "fileName": "Firedance.mp3"
            },
            { 
                "titulo": "YO CARMEN", 
                "fileName": "yocarmen.mp3"
            },
            { 
                "titulo": "AUTORRETRATO", 
                "fileName": "autorretrato.mp3"
            },
            { 
                "titulo": "UNA ODA AL TIEMPO", 
                "fileName": "odatiempo.mp3"
            }
        ]
    }
};

// ============================================================================
// 4. MAIN DOM LOGIC
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    const albumSelect = document.getElementById('albumSelect');
    const songsContainer = document.getElementById('songsContainer');
    const songList = document.getElementById('songList');

    // Hide Dropdown
    if (albumSelect) {
        const selectorBox = albumSelect.closest('.selector-container');
        if (selectorBox) selectorBox.classList.add('hidden');
    }

    const onlyAlbumKey = Object.keys(datosMaria)[0];
    const album = datosMaria[onlyAlbumKey];
    if (!album) return;

    songList.innerHTML = '';
    songsContainer.classList.remove('hidden');
    songsContainer.style.display = 'block';
    

    // Iterate through songs
    album.canciones.forEach(cancion => {
        const li = document.createElement('li');
        li.textContent = "🎵 " + cancion.titulo;
        
        li.classList.add("song-item");

        // CLICK EVENT: Play Song
        li.addEventListener('click', async () => {
            const playerContainer = document.getElementById('playerContainer');
            
            // Show loading state
            playerContainer.innerHTML = '<p style="color:white; text-align:center;">Loading audio from Firebase...</p>';

            // 1. DETERMINE FILENAME
            // Check if specific 'fileName' exists in JSON. If not, auto-generate it.
            let finalFileName;
            if (cancion.fileName) {
                finalFileName = cancion.fileName;
            } else {
                finalFileName = formatFilename(cancion.titulo);
            }
            
            // 2. Define path
            const pathStorage = `/songsLibrary/maria/${finalFileName}`;
            
            let mp3Url = null;

            try {
                // 3. Attempt to get download URL
                const fileRef = ref(storage, pathStorage);
                mp3Url = await getDownloadURL(fileRef);
                console.log(`Audio found for ${cancion.titulo}:`, mp3Url);
            } catch (error) {
                console.warn(`File not found in Storage: ${pathStorage}`);
                // mp3Url remains null
            }

            // 4. Render players
            displayPlayer(cancion.spotifyLink, mp3Url, cancion.titulo, pathStorage);
        });

        songList.appendChild(li);
    });
});

// ============================================================================
// 5. HELPER FUNCTIONS
// ============================================================================

/**
 * Fallback function: Formats a song title into a standardized filename
 * if no manual filename is provided.
 */
function formatFilename(title) {
    return title
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
        .trim()
        .replace(/\s+/g, '_') // Replace spaces with underscores
        + ".mp3";
}

/**
 * Renders the HTML for both players.
 */
function displayPlayer(spotifyLink, mp3Link, songTitle, debugPath) {
    const playerContainer = document.getElementById('playerContainer');
    if (!playerContainer) return;

    let htmlAudioFirebase = '';

    if (mp3Link) {
        htmlAudioFirebase = `
            <div class="firebase-player">
                <p>Melody Stream MP3:</p>
                <audio controls autoplay>
                    <source src="${mp3Link}" type="audio/mpeg">
                    Your browser does not support the audio element.
                </audio>
            </div>
        `;
    } else {
        htmlAudioFirebase = `
            <div class="firebase-error">
                ⚠️ MP3 file not found in Firebase Storage.<br>
                <small>(Tried path: ${debugPath})</small>
            </div>
        `;
    }

    const htmlSpotify = `
        <h4 class="spotify-player-title">Spotify:</h4>
        <div class="spotify-unavailable">
            Songs unaviable in Spotify for this artist
        </div>
        `;


    playerContainer.innerHTML = `
        <h2 class="player-title">${songTitle}</h2>
        ${htmlAudioFirebase}
        ${htmlSpotify}
    `;
}

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

const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

// ============================================================================
// 3. ARTIST DATA
// IMPORTANT: You can now add a "fileName" property if the file in Firebase 
// has a different name than the title.
// ============================================================================
const datosChopin = {
    "album_1": {
        "nombre": "NOCTURNES",
        "canciones": [
            { 
                "titulo": "NOCTURNE IN E-flat major Op.9 No.2", 
                "spotifyLink": "https://open.spotify.com/embed/track/61YM5SkqqeUjIBL7It56cs?utm_source=generator",
                "fileName": "NEOp9N2.mp3"
            },
            { 
                "titulo": "NOCTURNE IN B-flat minor Op.9 No.1", 
                "spotifyLink": "https://open.spotify.com/embed/track/2d6ml9Qkx8r4EjuUyrdpRV?utm_source=generator",
                "fileName": "NBOp9N1.mp3"
            },
            { 
                "titulo": "NOCTURNE IN C minor Op.48 No.1", 
                "spotifyLink": "https://open.spotify.com/embed/track/1vU8oht1BqabFD6A3cqS6M?utm_source=generator",
                "fileName": "NOp48N1.mp3"
            }
        ]
    },
    "album_2": {
        "nombre": "WALTZS",
        "canciones": [
            { 
                "titulo": "WALTZ IN C-sharp minor Op.64 No.2", 
                "spotifyLink": "https://open.spotify.com/embed/track/1lOVilzLQuYY2fnFrQ76DK?utm_source=generator",
                "fileName": "WCOp64.mp3"
            },
            { 
                "titulo": "WALTZ IN A minor Op.posth No.19", 
                "spotifyLink": "https://open.spotify.com/embed/track/71MpmxCJ1TW05c7Fvv1SfI?utm_source=generator",
                "fileName": "WA.mp3"
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

    // Initialize Dropdown
    albumSelect.innerHTML = '<option value="" disabled selected>-- Select an album --</option>';
    
    // Populate Album Options
    for (const key in datosChopin) {
        const album = datosChopin[key];
        const option = document.createElement('option');
        option.value = key;
        option.textContent = album.nombre;
        albumSelect.appendChild(option);
    }

    // Event Listener: Album Selection Change
    albumSelect.addEventListener('change', (e) => {
        const albumKey = e.target.value;
        const album = datosChopin[albumKey];
        
        if (!album) return;

        // Reset list and show container
        songList.innerHTML = '';
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
                const pathStorage = `/songsLibrary/chopin/${finalFileName}`;
                
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
        <div class="spotify-player">
            <iframe
                src="${spotifyLink}"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy">
            </iframe>
        </div>
    `;

    playerContainer.innerHTML = `
        <h2 class="player-title">${songTitle}</h2>
        ${htmlAudioFirebase}
        ${htmlSpotify}
    `;
}

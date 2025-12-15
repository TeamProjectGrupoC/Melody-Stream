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
const datosQuevedo = {
    "album_1": {
        "nombre": "DONDE QUIERO ESTAR",
        "canciones": [
            { 
                "titulo": "VISTA AL MAR", 
                "spotifyLink": "https://open.spotify.com/embed/track/3aVC2o93aAvQxCSAPlj9Uo?utm_source=generator",
                "fileName": "vistaalmar.mp3"
            },
            { 
                "titulo": "PLAYA DEL INGLÉS", 
                "spotifyLink": "https://open.spotify.com/embed/track/3y33vvSSP8dNie0hDK4CvF?utm_source=generator",
                "fileName": "platadelingles.mp3"
            },
            { 
                "titulo": "PUNTO G", 
                "spotifyLink": "https://open.spotify.com/embed/track/1fcP2ZJG2ouG99iU2nI6HT?utm_source=generator",
                "fileName": "puntog.mp3"
            }
        ]
    },
    "album_2": {
        "nombre": "BUENAS NOCHES",
        "canciones": [
            { 
                "titulo": "BUENAS NOCHES", 
                "spotifyLink": "https://open.spotify.com/embed/track/1JkI7KcMNuIBZZoWQkcveV?utm_source=generator",
                "fileName": "buenasnoches.mp3"
            },
            { 
                "titulo": "KASSANDRA", 
                "spotifyLink": "https://open.spotify.com/embed/track/6mP16Mr2X3ZU2bNmWBUqzK?utm_source=generator",
                "fileName": "kassandra.mp3"
            },
            { 
                "titulo": "DURO", 
                "spotifyLink": "https://open.spotify.com/embed/track/18ngz35nTD4rzldysVtN4o?utm_source=generator" ,
                "fileName": "duro.mp3"
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
    for (const key in datosQuevedo) {
        const album = datosQuevedo[key];
        const option = document.createElement('option');
        option.value = key;
        option.textContent = album.nombre;
        albumSelect.appendChild(option);
    }

    // Event Listener: Album Selection Change
    albumSelect.addEventListener('change', (e) => {
        const albumKey = e.target.value;
        const album = datosQuevedo[albumKey];
        
        if (!album) return;

        // Reset list and show container
        songList.innerHTML = '';
        songsContainer.style.display = 'block';

        // Iterate through songs
        album.canciones.forEach(cancion => {
            const li = document.createElement('li');
            li.textContent = "🎵 " + cancion.titulo;
            
            // Apply Styles
            li.style.cursor = "pointer";
            li.style.padding = "10px";
            li.style.borderBottom = "1px solid rgba(255,255,255,0.2)";
            li.style.color = "white"; 
            li.style.textAlign = "left";

            // Hover Effects
            li.onmouseover = () => li.style.backgroundColor = "rgba(255,255,255,0.1)";
            li.onmouseout = () => li.style.backgroundColor = "transparent";

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
                const pathStorage = `/songsLibrary/quevedo/${finalFileName}`;
                
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
    if(!playerContainer) return;

    // A. Build Firebase MP3 Player HTML
    let htmlAudioFirebase = '';
    
    if (mp3Link) {
        htmlAudioFirebase = `
            <div style="background: rgba(255, 255, 255, 0.1); padding: 15px; border-radius: 12px; margin-bottom: 20px;">
                <p style="color: #ccc; margin: 0 0 5px 0; font-size: 0.9rem;">Melody Stream MP3:</p>
                <audio controls autoplay style="width: 100%; height: 40px;">
                    <source src="${mp3Link}" type="audio/mpeg">
                    Your browser does not support the audio element.
                </audio>
            </div>
        `;
    } else {
        htmlAudioFirebase = `
            <div style="margin-bottom: 20px; color: #ff6b6b; font-size: 0.9em; background: rgba(0,0,0,0.3); padding: 10px; border-radius: 8px;">
                ⚠️ MP3 file not found in Firebase Storage.<br>
                <small>(Tried path: ${debugPath})</small>
            </div>
        `;
    }

    // B. Build Spotify Player HTML
    let htmlSpotify = `
        <h4 style="color:white; margin-bottom:10px;">Spotify:</h4>
        <iframe style="border-radius:12px" src="${spotifyLink}" width="100%" height="152" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>
    `;

    // C. Inject into DOM
    playerContainer.innerHTML = `
        <h2 style="color:white; margin-bottom:20px; border-bottom: 1px solid #444; padding-bottom: 10px;">${songTitle}</h2>
        ${htmlAudioFirebase}
        ${htmlSpotify}
    `;
}
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
        "nombre": "Luna 5: Jaleo",
        "canciones": [
            {
                "titulo": "Luna 5: Jaleo",
                "spotifyLink": "https://open.spotify.com/embed/track/2eGrPWHycj8dBj3Kp64EBa?utm_source=generator",
                // MANUAL FILENAME: This tells the code to look for "jaleo5.mp3"
                // instead of auto-generating "luna5jaleo.mp3"
                "fileName": "jaleo5.mp3" 
            }
        ]
    }
};

// ============================================================================
// 4. MAIN DOM LOGIC
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {

    // Get DOM elements
    const albumSelect = document.getElementById('albumSelect');
    const songsContainer = document.getElementById('songsContainer');
    const songList = document.getElementById('songList');

    // Initialize Dropdown
    albumSelect.innerHTML = '<option value="" disabled selected>-- Select an album --</option>';
    
    // Populate Album Options
    for (const key in datosMaria) {
        const album = datosMaria[key];
        const option = document.createElement('option');
        option.value = key;             
        option.textContent = album.nombre; 
        albumSelect.appendChild(option);
    }

    // Event Listener: Album Selection Change
    albumSelect.addEventListener('change', (e) => {
        const albumKey = e.target.value;
        const album = datosMaria[albumKey];
        
        if (!album) return;

        // Reset list and show container
        songList.innerHTML = '';
        songsContainer.style.display = 'block';

        // Iterate through songs and create list items
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

            // CLICK EVENT: Play Song (Async for Firebase Fetch)
            li.addEventListener('click', async () => {
                const playerContainer = document.getElementById('playerContainer');
                
                // Show loading state
                playerContainer.innerHTML = '<p style="color:white; text-align:center;">Loading audio from Firebase...</p>';

                // 1. DETERMINE FILENAME
                let finalFileName;
                if (cancion.fileName) {
                    finalFileName = cancion.fileName; // Use manual filename (jaleo5.mp3)
                } else {
                    finalFileName = formatFilename(cancion.titulo); // Auto-generate
                }
                
                // 2. DEFINE STORAGE PATH
                // NOTE: We are using a new folder "maria"
                const pathStorage = `songsLibrary/maria/${finalFileName}`;
                
                let mp3Url = null;

                try {
                    // 3. GET DOWNLOAD URL
                    const fileRef = ref(storage, pathStorage);
                    mp3Url = await getDownloadURL(fileRef);
                    console.log(`Audio found: ${mp3Url}`);
                } catch (error) {
                    console.warn(`Error finding file: ${pathStorage}`, error);
                    // mp3Url remains null, error message will be shown in displayPlayer
                }

                // 4. RENDER PLAYER
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
 * Formats title to filename (removes spaces/accents).
 * "Luna 5" -> "luna5.mp3"
 */
function formatFilename(title) {
    return title
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
        .trim()
        .replace(/\s+/g, '') // Removes spaces completely
        + ".mp3";
}

/**
 * Renders the HTML for both players (Firebase MP3 + Spotify Iframe)
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
                <small>Path tried: ${debugPath}</small><br>
                <small>Ensure file is in: <b>songsLibrary/maria/</b></small>
            </div>
        `;
    }

    // B. Build Spotify Player HTML
    let htmlSpotify = `
        <h4 style="color:white; margin-bottom:10px;">Spotify:</h4>
        <iframe 
            style="border-radius:12px" 
            src="${spotifyLink}" 
            width="100%" 
            height="152" 
            frameBorder="0" 
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
            loading="lazy">
        </iframe>
    `;

    // C. Inject into DOM
    playerContainer.innerHTML = `
        <h2 style="color:white; margin-bottom:20px; border-bottom: 1px solid #444; padding-bottom: 10px;">${songTitle}</h2>
        ${htmlAudioFirebase}
        ${htmlSpotify}
    `;
}
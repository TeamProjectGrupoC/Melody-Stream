import { initializeApp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-database.js";

// Configuración básica (si la necesitas para otras cosas, si no, este código funciona localmente con los datos de abajo)
const firebaseConfig = {
    // ... tu configuración de firebase ...
};
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// --- DATOS DE CHOPIN (Basados en tus capturas) ---
const datosChopin = {
    "album_1": {
        "nombre": "Chopin: Piano Concerto No. 1 in E Minor, Op. 11, B. 53",
        "canciones": [
            {
                "titulo": "Piano Concerto No. 1 in E Minor: I. Allegro maestoso",
                // 👇 AQUÍ PEGAS EL LINK DE LA API DE SPOTIFY PARA ESTA CANCIÓN
                "spotifyLink": "https://open.spotify.com/embed/track/6mP16Mr2X3ZU2bNmWBUqzK?utm_source=generator" width="100%" height="352" 
            },
            {
                "titulo": "Piano Concerto No. 1 in E Minor: II. Romance. Larghetto",
                // 👇 AQUÍ PEGAS EL LINK DE LA API DE SPOTIFY PARA ESTA CANCIÓN
                "spotifyLink": "https://open.spotify.com/embed/track/TU_ID_DE_CANCION_AQUI_2"
            },
            {
                "titulo": "Piano Concerto No. 1 in E Minor: III. Rondo. Vivace",
                // 👇 AQUÍ PEGAS EL LINK DE LA API DE SPOTIFY PARA ESTA CANCIÓN
                "spotifyLink": "https://open.spotify.com/embed/track/TU_ID_DE_CANCION_AQUI_3"
            }
        ]
    },
    "album_2": {
        "nombre": "Debussy & Chopin: The Shape of Sound",
        "canciones": [
            {
                "titulo": "Nocturnes, Op. 9: No. 1, Larghetto in B-Flat Minor",
                "spotifyLink": "https://open.spotify.com/embed/track/TU_ID_DE_CANCION_AQUI_4"
            },
            {
                "titulo": "Nocturnes, Op. 55: No. 1, Andante in F Minor",
                "spotifyLink": "https://open.spotify.com/embed/track/TU_ID_DE_CANCION_AQUI_5"
            },
            {
                "titulo": "Nocturnes, Op. 15: No. 1, Andante Cantabile in F Major",
                "spotifyLink": "https://open.spotify.com/embed/track/TU_ID_DE_CANCION_AQUI_6"
            },
            {
                "titulo": "Nocturnes, Op. 37: No. 1, Andante Sostenuto in G Minor",
                "spotifyLink": "https://open.spotify.com/embed/track/TU_ID_DE_CANCION_AQUI_7"
            },
            {
                "titulo": "Scherzo No. 1 in B Minor, Op. 20",
                "spotifyLink": "https://open.spotify.com/embed/track/TU_ID_DE_CANCION_AQUI_8"
            }
        ]
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const albumSelect = document.getElementById('albumSelect');
    const songsContainer = document.getElementById('songsContainer');
    const songList = document.getElementById('songList');

    // 1. Llenar el menú desplegable
    for (const key in datosChopin) {
        const album = datosChopin[key];
        const option = document.createElement('option');
        option.value = key;
        option.textContent = album.nombre;
        albumSelect.appendChild(option);
    }

    // 2. Evento al cambiar de álbum
    albumSelect.addEventListener('change', (e) => {
        const albumKey = e.target.value;
        const album = datosChopin[albumKey];
        
        // Limpiar lista anterior
        songList.innerHTML = '';
        songsContainer.style.display = 'block';

        // Crear lista de canciones
        album.canciones.forEach(cancion => {
            const li = document.createElement('li');
            li.textContent = "🎵 " + cancion.titulo;
            li.style.cursor = "pointer";
            li.style.padding = "10px";
            li.style.borderBottom = "1px solid #444";
            
            // Efecto Hover simple
            li.onmouseover = () => li.style.backgroundColor = "rgba(255,255,255,0.1)";
            li.onmouseout = () => li.style.backgroundColor = "transparent";

            // 3. Evento Click para reproducir
            li.addEventListener('click', () => {
                mostrarReproductor(cancion.spotifyLink);
            });

            songList.appendChild(li);
        });
    });
});

function mostrarReproductor(link) {
    const playerContainer = document.getElementById('playerContainer');
    
    // Si el link es solo el ID, lo formateamos. Si ya pones el iframe completo, ajusta esto.
    // Asumiré que pones el link tipo "https://open.spotify.com/embed/track/..."
    
    playerContainer.innerHTML = `
        <iframe style="border-radius:12px" 
        src="${link}" 
        width="100%" 
        height="152" 
        frameBorder="0" 
        allowfullscreen="" 
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
        loading="lazy"></iframe>
    `;
}
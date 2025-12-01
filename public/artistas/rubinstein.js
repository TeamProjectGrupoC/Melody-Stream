const datosRubinstein = {
    "album_1": {
        "nombre": "Fine Piano Tunes (2023)",
        "canciones": [
            {
                "titulo": "Mazurka Op. 67 No. 2 For Piano",
                "spotifyLink": "https://open.spotify.com/embed/track/5GG2WTUsFEE5dV1uvOCr2L?utm_source=generator" 
            },
            {
                "titulo": "3 Movements Perpetuels - No. 1",
                "spotifyLink": "https://open.spotify.com/embed/track/313TBejqmLskZwwqSyVvjp?utm_source=generator"
            },
            {
                "titulo": "3 Movements Perpetuels - No. 2",
                "spotifyLink": "https://open.spotify.com/embed/track/30paQ7xSwKOtMsdSFxJv8y?utm_source=generator"
            },
            {
                "titulo": "Hungarian Rhapsody No. 10",
                "spotifyLink": "https://open.spotify.com/embed/track/57VgIgqAI76khUbXu3fsmQ?utm_source=generator"
            }
        ]
    },
    "album_2": {
        "nombre": "Dvořák: Quintet in A Major, Op. 81",
        "canciones": [
            {
                "titulo": "1. Allegro ma non tanto",
                "spotifyLink": "https://open.spotify.com/embed/track/6mq2sYTv7s8EUp6GYFbEYs?utm_source=generator"
            },
            {
                "titulo": "2. Dumka. Andante con moto",
                "spotifyLink": "https://open.spotify.com/embed/track/0JftRsesM4sMAaNXMLM57O?utm_source=generator"
            },
            {
                "titulo": "3. Scherzo. Molto vivace",
                "spotifyLink": "https://open.spotify.com/embed/track/4GoiB9mD4JGO1A13aOrVox?utm_source=generator"
            },
            {
                "titulo": "4. Finale. Allegro",
                "spotifyLink": "https://open.spotify.com/embed/track/2PwwyOBhmKn4Y2Od96pqU6?utm_source=generator"
            }
        ]
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const albumSelect = document.getElementById('albumSelect');
    const songsContainer = document.getElementById('songsContainer');
    const songList = document.getElementById('songList');

    albumSelect.innerHTML = '<option value="" disabled selected>-- Elige un álbum --</option>';
    
    for (const key in datosRubinstein) {
        const album = datosRubinstein[key];
        const option = document.createElement('option');
        option.value = key;
        option.textContent = album.nombre;
        albumSelect.appendChild(option);
    }

    albumSelect.addEventListener('change', (e) => {
        const albumKey = e.target.value;
        const album = datosRubinstein[albumKey];
        
        if (!album) return;

        songList.innerHTML = '';
        songsContainer.style.display = 'block';

        album.canciones.forEach(cancion => {
            const li = document.createElement('li');
            li.textContent = "🎵 " + cancion.titulo;
            li.style.cursor = "pointer";
            li.style.padding = "10px";
            li.style.borderBottom = "1px solid rgba(255,255,255,0.2)";
            li.style.color = "white"; 
            li.style.textAlign = "left";

            li.onmouseover = () => li.style.backgroundColor = "rgba(255,255,255,0.1)";
            li.onmouseout = () => li.style.backgroundColor = "transparent";

            li.addEventListener('click', () => {
                mostrarReproductor(cancion.spotifyLink);
            });

            songList.appendChild(li);
        });
    });
});

function mostrarReproductor(link) {
    const playerContainer = document.getElementById('playerContainer');
    if(!playerContainer) return;

    if (!link || link.includes("AQUI_LINK_SPOTIFY")) {
         playerContainer.innerHTML = `<h3 style="color:red;">Error: Falta el enlace de Spotify.</h3>`;
         return;
    }
    
    playerContainer.innerHTML = `
        <h3 style="color:white; margin-bottom:10px;">Reproduciendo:</h3>
        <iframe style="border-radius:12px" src="${link}" width="100%" height="152" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>
    `;
}
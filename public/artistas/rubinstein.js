const datosRubinstein = {
    "album_1": {
        "nombre": "Fine Piano Tunes (2023)",
        "canciones": [
            {
                "titulo": "Mazurka Op. 67 No. 2 For Piano",
                "spotifyLink": "AQUI_LINK_SPOTIFY" 
            },
            {
                "titulo": "3 Movements Perpetuels - No. 1",
                "spotifyLink": "AQUI_LINK_SPOTIFY"
            },
            {
                "titulo": "3 Movements Perpetuels - No. 2",
                "spotifyLink": "AQUI_LINK_SPOTIFY"
            },
            {
                "titulo": "Hungarian Rhapsody No. 10",
                "spotifyLink": "AQUI_LINK_SPOTIFY"
            }
        ]
    },
    "album_2": {
        "nombre": "Dvořák: Quintet in A Major, Op. 81",
        "canciones": [
            {
                "titulo": "1. Allegro ma non tanto",
                "spotifyLink": "AQUI_LINK_SPOTIFY"
            },
            {
                "titulo": "2. Dumka. Andante con moto",
                "spotifyLink": "AQUI_LINK_SPOTIFY"
            },
            {
                "titulo": "3. Scherzo. Molto vivace",
                "spotifyLink": "AQUI_LINK_SPOTIFY"
            },
            {
                "titulo": "4. Finale. Allegro",
                "spotifyLink": "AQUI_LINK_SPOTIFY"
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
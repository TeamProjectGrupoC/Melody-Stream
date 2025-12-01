const datosQuevedo = {
    "album_1": {
        "nombre": "DONDE QUIERO ESTAR",
        "canciones": [
            {
                "titulo": "AHORA QUÉ",
                "spotifyLink": "https://open.spotify.com/embed/track/0qnJAwl50LPoswiUUiKfm7?utm_source=generator" 
            },
            {
                "titulo": "VISTA AL MAR",
                "spotifyLink": "https://open.spotify.com/embed/track/3aVC2o93aAvQxCSAPlj9Uo?utm_source=generator"
            },
            {
                "titulo": "PLAYA DEL INGLÉS",
                "spotifyLink": "https://open.spotify.com/embed/track/3y33vvSSP8dNie0hDK4CvF?utm_source=generator"
            },
            {
                "titulo": "PUNTO G",
                "spotifyLink": "https://open.spotify.com/embed/track/1fcP2ZJG2ouG99iU2nI6HT?utm_source=generator"
            }
        ]
    },
    "album_2": {
        "nombre": "BUENAS NOCHES",
        "canciones": [
            {
                "titulo": "BUENAS NOCHES",
                "spotifyLink": "https://open.spotify.com/embed/track/1JkI7KcMNuIBZZoWQkcveV?utm_source=generator"
            },
            {
                "titulo": "KASSANDRA",
                "spotifyLink": "https://open.spotify.com/embed/track/6mP16Mr2X3ZU2bNmWBUqzK?utm_source=generator"
            },
            {
                "titulo": "DURO",
                "spotifyLink": "https://open.spotify.com/embed/track/18ngz35nTD4rzldysVtN4o?utm_source=generator"
            }
        ]
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const albumSelect = document.getElementById('albumSelect');
    const songsContainer = document.getElementById('songsContainer');
    const songList = document.getElementById('songList');

    albumSelect.innerHTML = '<option value="" disabled selected>-- Elige un álbum --</option>';
    
    for (const key in datosQuevedo) {
        const album = datosQuevedo[key];
        const option = document.createElement('option');
        option.value = key;
        option.textContent = album.nombre;
        albumSelect.appendChild(option);
    }

    albumSelect.addEventListener('change', (e) => {
        const albumKey = e.target.value;
        const album = datosQuevedo[albumKey];
        
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
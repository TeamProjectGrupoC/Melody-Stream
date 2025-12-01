const datosQuevedo = {
    "album_1": {
        "nombre": "DONDE QUIERO ESTAR",
        "canciones": [
            {
                "titulo": "AHORA QUÉ",
                "spotifyLink": "AQUI_LINK_SPOTIFY" 
            },
            {
                "titulo": "VISTA AL MAR",
                "spotifyLink": "AQUI_LINK_SPOTIFY"
            },
            {
                "titulo": "PLAYA DEL INGLÉS",
                "spotifyLink": "AQUI_LINK_SPOTIFY"
            },
            {
                "titulo": "PUNTO G",
                "spotifyLink": "AQUI_LINK_SPOTIFY"
            }
        ]
    },
    "album_2": {
        "nombre": "BUENAS NOCHES",
        "canciones": [
            {
                "titulo": "BUENAS NOCHES",
                "spotifyLink": "AQUI_LINK_SPOTIFY"
            },
            {
                "titulo": "Canción 2 (Rellena el nombre)",
                "spotifyLink": "AQUI_LINK_SPOTIFY"
            },
            {
                "titulo": "Canción 3 (Rellena el nombre)",
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
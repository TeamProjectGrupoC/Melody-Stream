const datosMaria = {
    "album_1": {
        "nombre": "Luna 5: Jaleo",
        "canciones": [
            {
                "titulo": "Luna 5: Jaleo",

                "spotifyLink": "https://open.spotify.com/embed/track/2eGrPWHycj8dBj3Kp64EBa?utm_source=generator" 
            }
    
        ]
    }
};

document.addEventListener('DOMContentLoaded', () => {

    const albumSelect = document.getElementById('albumSelect');
    const songsContainer = document.getElementById('songsContainer');
    const songList = document.getElementById('songList');

    albumSelect.innerHTML = '<option value="" disabled selected>-- Select an album --</option>';
    
    for (const key in datosMaria) {
        const album = datosMaria[key];
        const option = document.createElement('option');
        option.value = key;             
        option.textContent = album.nombre; 
        albumSelect.appendChild(option);
    }


    albumSelect.addEventListener('change', (e) => {
        const albumKey = e.target.value;
        const album = datosMaria[albumKey];
        
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

/**
 * 
 * @param {string} link - 
 */
function mostrarReproductor(link) {
    const playerContainer = document.getElementById('playerContainer');
    if(!playerContainer) return;

    if (!link || link.includes("AQUI_PEGAS_EL_CODIGO_DE_SPOTIFY")) {
         playerContainer.innerHTML = `<h3 style="color:red;">Error: Falta el enlace de Spotify para esta canción.</h3>`;
         return;
    }
    
    playerContainer.innerHTML = `
        <h3 style="color:white; margin-bottom:10px;">Playing:</h3>
        <iframe 
            style="border-radius:12px" 
            src="${link}" 
            width="100%" 
            height="152" 
            frameBorder="0" 
            allowfullscreen="" 
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
            loading="lazy">
        </iframe>
    `;
}
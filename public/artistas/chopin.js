const datosChopin = {
    "album_1": {
        "nombre": "Chopin: Piano Concerto No. 1 in E Minor, Op. 11, B. 53",
        "canciones": [
            {
                "titulo": "I. Allegro maestoso",

                "spotifyLink": "https://open.spotify.com/embed/track/4vvIqOWB5BH14ai8RluY50?utm_source=generator" 
            },
            {
                "titulo": "II. Romance. Larghetto",
                "spotifyLink": "https://open.spotify.com/embed/track/35GtVdmBJSSU1uHitWby9R?utm_source=generator"
            },
            {
                "titulo": "III. Rondo. Vivace",
                "spotifyLink": "https://open.spotify.com/embed/track/4YeAyCsoMGM0c6OjrVPZyw?utm_source=generator"
            }
        ]
    },
    "album_2": {
        "nombre": "Debussy & Chopin: The Shape of Sound",
        "canciones": [
            {
                "titulo": "Prelude, Livre I: No. 1,Danseuses de Delphes",
                "spotifyLink": "https://open.spotify.com/embed/track/1sJuKWmOPqtZLaHqB1Q7NV?utm_source=generator"
            },
            {
                "titulo": "Prelude, Livre II: No.8, Ondine",
                "spotifyLink": "https://open.spotify.com/embed/track/26g7KVLyFfWxOQtiJyL0bX?utm_source=generator"
            },
            {
                "titulo": "Preludes, Livre I: No.10, La Cathedrale Engloutie",
                "spotifyLink": "https://open.spotify.com/embed/track/4svE7BJZwBNfWEnulNEwGO?utm_source=generator"
            }
        ]
    }
};

document.addEventListener('DOMContentLoaded', () => {

    const albumSelect = document.getElementById('albumSelect');
    const songsContainer = document.getElementById('songsContainer');
    const songList = document.getElementById('songList');

    albumSelect.innerHTML = '<option value="" disabled selected>-- Select an album --</option>';
    
    for (const key in datosChopin) {
        const album = datosChopin[key];
        const option = document.createElement('option');
        option.value = key;             
        option.textContent = album.nombre; 
        albumSelect.appendChild(option);
    }


    albumSelect.addEventListener('change', (e) => {
        const albumKey = e.target.value;
        const album = datosChopin[albumKey];
        
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
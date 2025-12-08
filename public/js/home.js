import { initializeApp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";

// Módulos de Realtime Database (RTDB)
import { getDatabase, ref as databaseRef, onValue, set } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-database.js";

// Módulos de Firebase Storage (Solo una vez)
import { getStorage, ref as storageRef, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-storage.js";

// --- FIREBASE CONFIGURATION ---
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

// --- INITIALIZATION ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const storage = getStorage(app);

let currentAudioPlayer = null;

const trendingSongsData = {
    "song_1": {
        "titulo": "Mniej niz zero",
        "artista": "Lady Pank",
        "audioFile": "songsIndex/Mniej niż zero - Lady Pank ft. K. Kowalska, G. Markowski, T. Organek, P. Rogucki, M. Wyrostek.mp3" 
    },
    "song_2": {
        "titulo": "Ave María",
        "artista": "David Bisbal",
        "audioFile": "songsIndex/David Bisbal - Ave María.mp3"
    },
    "song_3": {
        "titulo": "Firedance",
        "artista": "Maria Pages",
        "audioFile": "songsIndex/Maria Pages - Firedance.mp3"
    },
    "song_4": {
        "titulo": "September",
        "artista": "Earth, Wind & Fire",
        "audioFile": "songsIndex/Earth, Wind & Fire - September (Official HD Video).mp3"
    }
};

const featuredArtistsData = {
    "Rosalía": "Rosalía is a two-time GRAMMY® and 13-time Latin GRAMMY® Award-winning artist & producer redefining global pop with fearless musical fusion and singular visual language. Her breakthrough El Mal Querer reimagined flamenco for a new era & earned her a GRAMMY plus eight Latin GRAMMYs including Album of the Year, making her the first Spanish-language artist nominated for Best New Artist at the GRAMMYs. In 2022, she released MOTOMAMI, which she wrote, performed, recorded, & produced; it debuted at #1 on Spotify’s Global Album Chart, scored the highest Metacritic rating of the year & powered her sold-out MOTOMAMI WORLD TOUR.",
    "Ed Sheeran": "Ed Sheeran borrows from any style that crosses his path, molding genres to fit a musical character all his own that's charming, personable, and popular on a global scale. Elements of folk, hip-hop, pop, dance, soul, and rock can be heard in his big hits The A Team, Sing, Thinking Out Loud and Shape of You -- which gives him a broad appeal among different demographics. It also helped elevate him to international acclaim not long after the release of his 2011 debut LP, +, and took 2014's x and 2017's ÷ to the top of both the U.K. albums chart and the Billboard 200. Sheeran maintained his stardom with savvy collaborations -- his 2019 album No. 6 Collaborations Project featured an eclectic roster including Khalid, Camila Cabello, Cardi B, Justin Bieber, Chris Stapleton, and Bruno Mars -- and by continuing to write candidly about his life: his 2021 album = was filled with songs about being a new father. Sheeran's musical explorations continued on -, a 2023 album that featured several tracks co-written and co-produced by Aaron Dessner of the National, and its swiftly released companion, Autumn Variations, both of which reached the Top Five in the U.K. and on the Billboard 200.",
    "The Rapants": "The Rapants is a Galician indie and garage rock band from Muros, formed in 2018, known for their explosive live energy and their festive style that blends pop, garage, disco, and rock, with lyrics in Galician and Spanish about everyday life and good vibes, capturing the essence of youth and partying. They are famous for their laid-back attitude, their connection with the audience, and their ability to make everyone dance, standing out at festivals and venues across the Iberian Peninsula"
};


function updateHeaderLinks(user) {
    const loginProfileLink = document.getElementById('loginProfileLink');
    const headerUserPic = document.getElementById('headerUserPic');
    
    if (user) {
        // Usuario logueado
        if (loginProfileLink) {
            loginProfileLink.textContent = 'PROFILE';
            loginProfileLink.href = 'profile.html';
        }
        // Asumiendo que guardas la URL de la foto de perfil en localStorage o tienes una forma de obtenerla
        const profilePicUrl = localStorage.getItem('headerProfilePic') || 'images/logos/silueta.png';
        if (headerUserPic) headerUserPic.src = profilePicUrl;

    } else {
        // Usuario no logueado
        if (loginProfileLink) {
            loginProfileLink.textContent = 'LOG IN';
            loginProfileLink.href = 'login.html';
        }
        if (headerUserPic) headerUserPic.src = 'images/logos/silueta.png';
    }
}


function startApp() {
    onAuthStateChanged(auth, (user) => {
        updateHeaderLinks(user);
    });

    initializeHomeInteractions();
}

document.addEventListener('DOMContentLoaded', startApp);

async function loadPlayFirebaseAudio(audioFilePath, title, artist){

    const audioWrapper = document.getElementById('audioElementWrapper');
    const playPauseButton = document.getElementById('playPauseButton');
    const currentTitleSpan = document.getElementById('currentTitle');
    const currentArtistSpan = document.getElementById('currentArtist');  

    if (currentAudioPlayer) {
        currentAudioPlayer.pause();
        currentAudioPlayer.currentTime = 0;
    }
    audioWrapper.innerHTML = '';
    
    try{
        const fileRef = storageRef(storage, audioFilePath);
        const audioUrl = await getDownloadURL(fileRef);

        audioWrapper.innerHTML = `
            <audio id="audioPlayerSource">
                <source src="${audioUrl}" type="audio/mpeg">
            </audio>
        `;

        currentAudioPlayer = document.getElementById('audioPlayerSource');
        currentTitleSpan.textContent = title;
        currentArtistSpan.textContent = artist;

        currentAudioPlayer.play().catch(e => {
            console.log(`Reproducción bloqueada para ${title}. Esperando la interacción del usuario.`);
        });

        playPauseButton.textContent = currentAudioPlayer.paused ? '▶️' : '⏸️';
        playPauseButton.classList.toggle('paused', currentAudioPlayer.paused);

    }
    catch (error){
        console.error(`Error uploading the audio "${title}"`, error);
        alert("This song cannot be played");
    };
}

function initializeHomeInteractions() {
    /*TRENDING SONGS*/
    const playButtons = document.querySelectorAll('.module-songs .play-button');
    
    setupPlayerControls();

    playButtons.forEach(button => {
        const songCard = button.closest('.song-card');
        
        const songId = songCard ? songCard.dataset.songId : null; 
        
        if (songId) {
            button.addEventListener('click', () => {
                const song = trendingSongsData[songId];

                if (song && song.audioFile) {
                    loadPlayFirebaseAudio(song.audioFile, song.titulo, song.artista);
                } 
                else {
                    console.warn(`Link not found for song ID ${songId}`);
                }
            });
        }
    });

    ArtistDescription();
}

function setupPlayerControls(){
    const playPauseButton = document.getElementById('playPauseButton');

    playPauseButton.addEventListener('click', ()=> {

        if(!currentAudioPlayer){
            console.warn("There is no song loaded to play");
            return;
        }

        if(currentAudioPlayer.paused){
            currentAudioPlayer.play();
            playPauseButton.classList.remove('paused');
        }
        else{
            currentAudioPlayer.pause();
            playPauseButton.classList.add('paused');
        }
    }
    )
}

function ArtistDescription(){
    const artistChips = document.querySelectorAll('.artist-chip');
    const modalBackdrop = document.getElementById('artistModalBackdrop');
    const modalArtistName = document.getElementById('modalArtistName');
    const modalArtistDescription = document.getElementById('modalArtistDescription');
    const closeModalButton = document.getElementById('closeModalButton');

    function openModal(artistName) {
        modalArtistName.textContent = artistName;
        modalArtistDescription.textContent = featuredArtistsData[artistName] || "No hay descripción disponible.";
        modalBackdrop.classList.add('active');
    }

    function closeModal() {
        modalBackdrop.classList.remove('active');
    }

    artistChips.forEach(chip => {
        chip.addEventListener('click', (event) => {
            const artistNameElement = chip.querySelector('.artist-name-text');
            if (artistNameElement) {
                const artistName = artistNameElement.textContent.trim();
                openModal(artistName);
            }
        });
    });

    closeModalButton.addEventListener('click', closeModal);

    modalBackdrop.addEventListener('click', (event) => {
        if (event.target === modalBackdrop) {
            closeModal();
        }
    });
    
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modalBackdrop.classList.contains('active')) {
            closeModal();
        }
    });
}



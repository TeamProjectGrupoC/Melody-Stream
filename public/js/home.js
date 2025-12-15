/**
 * ============================================================================
 * MELODY STREAM - MAIN CONTROLLER
 * ============================================================================
 * * IMPLEMENTATION OVERVIEW:
 * This script serves as the main entry point for the application's home page. 
 * It integrates Firebase services (Auth, Realtime Database, Storage) to handle 
 * user sessions, dynamic UI updates, and media streaming.

 * ============================================================================
 * * 1. updateHeaderLinks(user)
 * - Updates the navigation bar based on the authentication state.
 * - If logged in: Shows "PROFILE" link and fetches the user's avatar from localStorage.
 * - If logged out: Shows "LOG IN" link and a default silhouette avatar.
 * * 2. startApp()
 * - The main initialization function triggered when the DOM is ready.
 * - Sets up the `onAuthStateChanged` listener to trigger UI updates (`updateHeaderLinks`, `updateRegisterModule`).
 * - Calls `initializeHomeInteractions` to set up event listeners.
 * * 3. loadPlayFirebaseAudio(audioFilePath, title, artist) [Async]
 * - Stops any currently playing audio.
 * - Fetches the download URL for a specific audio file from Firebase Storage.
 * - Dynamically creates and injects an HTML `<audio>` element into the DOM.
 * - Updates the "Now Playing" UI (Title, Artist) and starts playback.
 * * 4. initializeHomeInteractions()
 * - Selects all "Play" buttons in the trending songs section.
 * - Binds click events to specific songs using data attributes (`data-song-id`).
 * - Links the local `trendingSongsData` object to the Firebase storage logic.
 * - Initializes the player controls and artist modal logic.
 * * 5. setupPlayerControls()
 * - Manages the global Play/Pause button logic.
 * - Toggles the playback state of the `currentAudioPlayer` and updates button visual classes.
 * * 6. ArtistDescription()
 * - Encapsulates all logic for the Artist Detail Modal.
 * - Handles opening the modal with data from `featuredArtistsData`.
 * - Manages closing the modal via button click, backdrop click, or Escape key.
 * * 7. updateRegisterModule(user) [Async]
 * - personalized the "Call to Action" section.
 * - If logged in: Fetches the username from Realtime Database (`/users/{uid}`) 
 * to display a "Welcome Back" message and hides the register button.
 * - If logged out: Displays a generic "Join Us" message and shows the register button.
 * * ============================================================================
 */
//------ IMPORTING MODULES ------
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";
import { getDatabase, ref as databaseRef, onValue, set, get } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-database.js";
import { getStorage, ref as storageRef, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-storage.js";
import { showAlert } from "./alert.js";

//----- FIREBASE CONFIGURATION ---
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

//------ INITIALIZATION ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const storage = getStorage(app);

let currentAudioPlayer = null;


//----- SAMPLE DATA -----------

//Data for trending songs
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

//Data for featured artist with descriptions
const featuredArtistsData = {
    "Rosalía": "Rosalía is a two-time GRAMMY® and 13-time Latin GRAMMY® Award-winning artist & producer redefining global pop with fearless musical fusion and singular visual language. Her breakthrough El Mal Querer reimagined flamenco for a new era & earned her a GRAMMY plus eight Latin GRAMMYs including Album of the Year, making her the first Spanish-language artist nominated for Best New Artist at the GRAMMYs. In 2022, she released MOTOMAMI, which she wrote, performed, recorded, & produced; it debuted at #1 on Spotify’s Global Album Chart, scored the highest Metacritic rating of the year & powered her sold-out MOTOMAMI WORLD TOUR.",
    "Ed Sheeran": "Ed Sheeran borrows from any style that crosses his path, molding genres to fit a musical character all his own that's charming, personable, and popular on a global scale. Elements of folk, hip-hop, pop, dance, soul, and rock can be heard in his big hits The A Team, Sing, Thinking Out Loud and Shape of You -- which gives him a broad appeal among different demographics. It also helped elevate him to international acclaim not long after the release of his 2011 debut LP, +, and took 2014's x and 2017's ÷ to the top of both the U.K. albums chart and the Billboard 200. Sheeran maintained his stardom with savvy collaborations -- his 2019 album No. 6 Collaborations Project featured an eclectic roster including Khalid, Camila Cabello, Cardi B, Justin Bieber, Chris Stapleton, and Bruno Mars -- and by continuing to write candidly about his life: his 2021 album = was filled with songs about being a new father. Sheeran's musical explorations continued on -, a 2023 album that featured several tracks co-written and co-produced by Aaron Dessner of the National, and its swiftly released companion, Autumn Variations, both of which reached the Top Five in the U.K. and on the Billboard 200.",
    "The Rapants": "The Rapants is a Galician indie and garage rock band from Muros, formed in 2018, known for their explosive live energy and their festive style that blends pop, garage, disco, and rock, with lyrics in Galician and Spanish about everyday life and good vibes, capturing the essence of youth and partying. They are famous for their laid-back attitude, their connection with the audience, and their ability to make everyone dance, standing out at festivals and venues across the Iberian Peninsula"
};

//-------- HEADER LINKS UPDATE BASED ON AUTHENTICATION STATE ------
//Update header links base on whether the user is logged in or not
function updateHeaderLinks(user) {
    const loginProfileLink = document.getElementById('loginProfileLink');
    const headerUserPic = document.getElementById('headerUserPic');
    
    if (user) {
        //User logged in, update de profile link and picture
        if (loginProfileLink) {
            loginProfileLink.textContent = 'PROFILE';
            loginProfileLink.href = 'profile.html';
        }
        const profilePicUrl = localStorage.getItem('headerProfilePic') || 'images/logos/silueta.png';
        if (headerUserPic) headerUserPic.src = profilePicUrl;

    } 
    else {
        //If user is not logged in
        if (loginProfileLink) {
            loginProfileLink.textContent = 'LOG IN';
            loginProfileLink.href = 'login.html';
        }
        if (headerUserPic) headerUserPic.src = 'images/logos/silueta.png';
    }
}

//------- INITIALIZE APP ---------

function startApp() {
    //Check authentication
    onAuthStateChanged(auth, (user) => {
        updateHeaderLinks(user);
        updateRegisterModule(user); 
    });

    initializeHomeInteractions(); //initializing interactions
}

//------ WAIT FOR THE DOM TO BE FULLY LOADED BEFORE STARTING THE APP ------
document.addEventListener('DOMContentLoaded', startApp);


//-------------------------------------------------//

//----- PLAY AUDIO FROM FIREBASE STORAGE-------
async function loadPlayFirebaseAudio(audioFilePath, title, artist){

    //Get references to the HTML elements
    const audioWrapper = document.getElementById('audioElementWrapper');
    const playPauseButton = document.getElementById('playPauseButton');
    const currentTitleSpan = document.getElementById('currentTitle');
    const currentArtistSpan = document.getElementById('currentArtist');  

    //Stop and reset the previus audio player if there is one playing
    if (currentAudioPlayer) {
        currentAudioPlayer.pause();
        currentAudioPlayer.currentTime = 0;
    }
    audioWrapper.innerHTML = '';
    
    try{
        const fileRef = storageRef(storage, audioFilePath); //Get reference to the audio file stored in Firebase
        const audioUrl = await getDownloadURL(fileRef); //Fetch download URL of the audio

        //Create new audio element 
        audioWrapper.innerHTML = `
            <audio id="audioPlayerSource">
                <source src="${audioUrl}" type="audio/mpeg">
            </audio>
        `;

        currentAudioPlayer = document.getElementById('audioPlayerSource');

        //Update the song title and artist name
        currentTitleSpan.textContent = title;
        currentArtistSpan.textContent = artist;

        //Toggle the "paused" class on the play/pause button depending on whether the audio is paused
        playPauseButton.classList.toggle('paused', currentAudioPlayer.paused);

    }
    catch (error){
        //console.error(`Error uploading the audio "${title}"`, error);
        showAlert("This song cannot be played", "error");
    };
}

//------------------------------------------
//---------- INITIALIZE HOME ITERACTIONS--------

function initializeHomeInteractions() {
    //Set up play buttons for trending songs
    const playButtons = document.querySelectorAll('.module-songs .play-button');
    
    //Initialize player controls
    setupPlayerControls();

    playButtons.forEach(button => {
        const songCard = button.closest('.song-card');
        
        //Retrieve the song ID from the 'data-song-id' attribute of the song card
        const songId = songCard ? songCard.dataset.songId : null; 
        
        if (songId) {
            button.addEventListener('click', () => {
                const song = trendingSongsData[songId];  //Retrieve the song data

                //If the song exists and has a valid audio file, try to play it
                if (song && song.audioFile) {
                    loadPlayFirebaseAudio(song.audioFile, song.titulo, song.artista);
                } 
                else {
                    //console.warn(`Link not found for song ID ${songId}`);
                }
            });
        }
    });

    //Initialize artist descriptions modal
    ArtistDescription();
}



// --------- SETUP PLAYER CONTROLS ---------
function setupPlayerControls(){
    const playPauseButton = document.getElementById('playPauseButton');

    playPauseButton.addEventListener('click', ()=> {

        if(!currentAudioPlayer){
            //console.warn("There is no song loaded to play");
            return;
        }

        //if the audio player is paused, play the audio and update the button state
        if(currentAudioPlayer.paused){
            currentAudioPlayer.play(); //play audio
            playPauseButton.classList.remove('paused'); //remove 'paused' class
        }
        else{
            //If the audio is playing, pause it and update the button state
            currentAudioPlayer.pause(); //pause audio
            playPauseButton.classList.add('paused'); //add 'paused' class
        }
    }
    )
}

//------------- ARTIST DESCRIPTION MODAL ------------
function ArtistDescription(){
    const artistChips = document.querySelectorAll('.artist-chip');

    const modalBackdrop = document.getElementById('artistModalBackdrop');
    const modalArtistName = document.getElementById('modalArtistName');
    const modalArtistDescription = document.getElementById('modalArtistDescription');
    const closeModalButton = document.getElementById('closeModalButton');

    //Open the modal and display the artist information
    function openModal(artistName) {
        modalArtistName.textContent = artistName;
        //Look for the artist description
        modalArtistDescription.textContent = featuredArtistsData[artistName] || "No description avaliable.";
        modalBackdrop.classList.add('active'); //Make de modal backdrop visible
    }

    function closeModal() {
        //Remove active class from de modal
        modalBackdrop.classList.remove('active');
    }

    artistChips.forEach(chip => {
        chip.addEventListener('click', (event) => {
            const artistNameElement = chip.querySelector('.artist-name-text');
            
            if (artistNameElement) {
                const artistName = artistNameElement.textContent.trim(); //Get artist name
                openModal(artistName); //open the modal with the artist`s name and description
            }
        });
    });

    //Event listener to the close modal button
    closeModalButton.addEventListener('click', closeModal);

    //Event listener to the modal backdrop so that clickin on it will also close modal
    modalBackdrop.addEventListener('click', (event) => {
        if (event.target === modalBackdrop) {
            closeModal();
        }
    });
    
    //Event listener to close the modal when Escape key is pressed
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modalBackdrop.classList.contains('active')) {
            closeModal();
        }
    });
}

//------------- SESION INITIALIZED ------------

async function updateRegisterModule(user) {
    const registerModule = document.getElementById("registerCtaModule");
    if (!registerModule) return;

    const title = registerModule.querySelector("h2");
    const text = registerModule.querySelector("p");
    const button = document.getElementById("registerCtaButton");

    if (user) {
        // exists session
        const userRef = databaseRef(db, `users/${user.uid}`);
        const snap = await get(userRef);

        if (!snap.exists()) {
            showAlert("ERROR: User not found", "error");
        }
        const userDb = snap.val();

        title.textContent = "Welcome back!";
        text.textContent = `We are glad to see you again, ${userDb.username}.`;

        if (button) button.style.display = "none";
    } else {
        // no session
        title.textContent = "Ready to start?";
        text.textContent =
            "Join Melody Stream to listen to your favorite music, upload podcasts, and connect with artists and friends.";

        if (button) button.style.display = "inline-block";
    }
}





import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getDatabase, ref, push, set } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";

// Firebase configuration
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

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const storage = getStorage(app);

const nameInput = document.getElementById('podcastName');
const descInput = document.getElementById('podcastDesc');
const iconInput = document.getElementById('podcastIcon');
const fileInput = document.getElementById('podcastFile');
const uploadBtn = document.getElementById('uploadBtn');
const backBtn = document.getElementById('backBtn');
const msg = document.getElementById('msg');
const formContainer = document.getElementById('formContainer');
const loginBtn = document.getElementById('loginBtn');

let currentUser = null;

// Detect active session
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    msg.textContent = `✅ Logged in as ${user.email}`;
    formContainer.style.display = 'block';
    loginBtn.style.display = 'none';
  } else {
    currentUser = null;
    msg.textContent = "⚠️ You must be logged in to upload a podcast.";
    formContainer.style.display = 'none';
    loginBtn.style.display = 'inline-block';
  }
});

// Save podcast
uploadBtn.addEventListener('click', async () => {
  if (!currentUser) {
    msg.textContent = "❌ Error: You are not logged in.";
    return;
  }

  const nombre = nameInput.value.trim();
  const descripcion = descInput.value.trim();
  const iconFile = iconInput.files[0];
  const audioFile = fileInput.files[0];

  if (!nombre || !descripcion || !iconFile || !audioFile) {
    msg.textContent = "All fields are required.";
    return;
  }

  try {
    // Generate a unique ID for the podcast using push()
    const podcastsRef = ref(db, 'podcasts');
    const newPodcastRef = push(podcastsRef); // This generates a unique ID
    const podcastId = newPodcastRef.key;

    // Upload the podcast icon
    const iconPath = `podcasts/${podcastId}/icon.jpg`;
    const iconRef = storageRef(storage, iconPath);
    await uploadBytes(iconRef, iconFile);
    const iconURL = await getDownloadURL(iconRef);

    // Upload the podcast audio
    const audioPath = `podcasts/${podcastId}/audio.mp3`;
    const audioRef = storageRef(storage, audioPath);
    await uploadBytes(audioRef, audioFile);
    const audioURL = await getDownloadURL(audioRef);

    // Save podcast metadata to Firebase Database
    await set(newPodcastRef, {
      nombre: nombre,
      descripcion: descripcion,
      iconURL: iconURL,
      audioURL: audioURL,
      idcreador: currentUser.uid
    });

    msg.textContent = "✅ Podcast saved successfully!";
    nameInput.value = '';
    descInput.value = '';
    iconInput.value = '';
    fileInput.value = '';
  } catch (err) {
    console.error(err);
    msg.textContent = `❌ Error saving podcast: ${err.message}`;
  }
});

// Botones de navegación
backBtn.addEventListener('click', () => window.location.href = 'index.html');
loginBtn.addEventListener('click', () => window.location.href = 'login.html');

// Nuevo botón para ir a la pestaña de ver podcasts
const viewPodcastsBtn = document.getElementById('viewPodcastsBtn');
viewPodcastsBtn.addEventListener('click', () => {
  window.location.href = 'podcast.html'; // Redirige a la página de ver podcasts
});
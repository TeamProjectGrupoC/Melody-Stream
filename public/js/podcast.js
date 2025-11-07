import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getDatabase,
  ref,
  get,
  remove,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import {
  getStorage,
  ref as storageRef,
  deleteObject,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCCWExxM4ACcvnidBWMfBQ_CJk7KimIkns",
  authDomain: "melodystream123.firebaseapp.com",
  databaseURL:
    "https://melodystream123-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "melodystream123",
  storageBucket: "melodystream123.firebasestorage.app",
  messagingSenderId: "640160988809",
  appId: "1:640160988809:web:d0995d302123ccf0431058",
  measurementId: "G-J97KEDLYMB",
};

// Firebase Initialization
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const storage = getStorage(app);

// Get the podcast list container and search input
const podcastList = document.getElementById("podcastList");
const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");

let allPodcasts = {}; // Variable para almacenar todos los podcasts

// Function to list podcasts
async function listPodcasts() {
  try {
    // Reference to the "podcasts" node in the database
    const podcastsRef = ref(db, "podcasts");
    const snapshot = await get(podcastsRef);

    if (snapshot.exists()) {
      allPodcasts = snapshot.val(); // Guardar todos los podcasts en la variable global
      displayPodcasts(allPodcasts); // Mostrar todos los podcasts inicialmente
    } else {
      podcastList.textContent = "No podcasts available.";
    }
  } catch (error) {
    console.error("Error listing podcasts:", error);
    podcastList.textContent = "Failed to load podcasts.";
  }
}

// Function to display podcasts
function displayPodcasts(podcasts) {
  podcastList.innerHTML = "";

  for (const podcastId in podcasts) {
    const podcast = podcasts[podcastId];

    const podcastItem = document.createElement("div");
    podcastItem.classList.add("podcast-card");

    // Icono
    const img = document.createElement("img");
    img.src = podcast.iconURL;
    img.alt = `${podcast.nombre} icon`;
    img.style.width = "100%";
    img.style.maxHeight = "180px";
    img.style.objectFit = "cover";
    img.style.borderRadius = "10px";
    img.style.marginBottom = "0.8rem";
    podcastItem.appendChild(img);

    // Título
    const title = document.createElement("h3");
    title.textContent = podcast.nombre;
    podcastItem.appendChild(title);

    // Descripción
    const description = document.createElement("p");
    description.textContent = podcast.descripcion;
    podcastItem.appendChild(description);

    // Reproductor de audio
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.src = podcast.audioURL;
    audio.style.width = "100%";
    podcastItem.appendChild(audio);

    // Botón Delete
    const deleteButton = document.createElement("button");
    deleteButton.textContent = "Delete";
    deleteButton.className = "btn btn-outline-danger mt-3";
    deleteButton.addEventListener("click", () => {
      deletePodcast(podcastId, podcast.audioURL, podcast.iconURL);
    });
    podcastItem.appendChild(deleteButton);

    podcastList.appendChild(podcastItem);
  }
}


// Function to delete a podcast
async function deletePodcast(podcastId, audioURL, iconURL) {
  const confirmDelete = confirm(
    `Are you sure you want to delete the podcast "${podcastId}"?`
  );
  if (!confirmDelete) return;

  try {
    // Delete the audio file from Firebase Storage
    const audioRef = storageRef(storage, audioURL);
    await deleteObject(audioRef);

    // Delete the icon file from Firebase Storage
    const iconRef = storageRef(storage, iconURL);
    await deleteObject(iconRef);

    // Delete the podcast entry from Firebase Database
    const podcastRef = ref(db, `podcasts/${podcastId}`);
    await remove(podcastRef);

    // Remove the podcast from the UI
    delete allPodcasts[podcastId];
    displayPodcasts(allPodcasts);

    alert(`Podcast "${podcastId}" deleted successfully.`);
  } catch (error) {
    console.error("Error deleting podcast:", error);
    alert("Failed to delete the podcast.");
  }
}

// Function to filter podcasts based on the search query
function filterPodcasts(query) {
  const filteredPodcasts = {};

  for (const podcastId in allPodcasts) {
    const podcast = allPodcasts[podcastId];
    if (podcast.nombre.toLowerCase().includes(query.toLowerCase())) {
      filteredPodcasts[podcastId] = podcast;
    }
  }

  displayPodcasts(filteredPodcasts); // Mostrar los podcasts filtrados
}

// Call the function to list podcasts on page load
listPodcasts();

// Add event listener to the search button
searchButton.addEventListener("click", () => {
  const query = searchInput.value.trim();
  filterPodcasts(query);
});

searchInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    const query = searchInput.value.trim();
    filterPodcasts(query);
  }
});



// Add event listener to the "Upload Podcast" button
const goToUploadButton = document.getElementById("goToUpload");
goToUploadButton.addEventListener("click", () => {
  window.location.href = "podcast_upload.html"; // Redirect to podcast_upload.html
});
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
  podcastList.innerHTML = ""; // Limpiar la lista antes de mostrar los resultados

  for (const podcastId in podcasts) {
    const podcast = podcasts[podcastId];

    // Create a container for each podcast
    const podcastItem = document.createElement("div");
    podcastItem.classList.add("podcast-item");

    // Add the podcast icon
    const img = document.createElement("img");
    img.src = podcast.iconURL;
    img.alt = `${podcast.nombre} icon`;
    podcastItem.appendChild(img);

    // Add the podcast name
    const title = document.createElement("h3");
    title.textContent = podcast.nombre;
    podcastItem.appendChild(title);

    // Add the podcast description
    const description = document.createElement("p");
    description.textContent = podcast.descripcion;
    podcastItem.appendChild(description);

    // Add the audio player
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.src = podcast.audioURL;
    podcastItem.appendChild(audio);

    // Add the delete button
    const deleteButton = document.createElement("button");
    deleteButton.textContent = "Delete";
    deleteButton.style.marginTop = "10px";
    deleteButton.addEventListener("click", () => {
      deletePodcast(podcastId, podcast.audioURL, podcast.iconURL);
    });
    podcastItem.appendChild(deleteButton);

    // Append the podcast item to the list
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

// Add event listener to the "Back to Index" button
const backToIndexButton = document.getElementById("backToIndex");
backToIndexButton.addEventListener("click", () => {
  window.location.href = "index.html"; // Redirect to index.html
});

// Add event listener to the "Upload Podcast" button
const goToUploadButton = document.getElementById("goToUpload");
goToUploadButton.addEventListener("click", () => {
  window.location.href = "podcast_upload.html"; // Redirect to podcast_upload.html
});
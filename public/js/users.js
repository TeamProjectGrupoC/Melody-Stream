// --- IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

/**
 * ============================================================================
 * SEARCH_USERS.JS – USER DIRECTORY (RTDB) + AUTH GATE + PROFILE REDIRECT
 * ============================================================================
 *
 * FIREBASE SERVICES USED:
 *
 * Firebase Authentication
 * - onAuthStateChanged(auth, callback)
 *   -> This page is protected: only logged-in users can see/search the directory.
 *   -> If the user is not logged in, the script replaces the results area with
 *      a warning message and a "Go to Login" button.
 *
 * Firebase Realtime Database (RTDB)
 * - /users/{uid}
 *   -> Public profile data used for search/listing.
 *   -> Fields used in this file:
 *      - username: string
 *      - urlFotoPerfil: string (optional avatar URL)
 *
 * DATABASE STRUCTURE (NODES READ HERE):
 * - /users
 *   -> The script reads the full "users" node once (get()) and then:
 *      - loads the first 10 users on page load
 *      - filters users by username for search
 *
 * SPECIAL CASE / "MASTER USER":
 * - If the logged-in Firebase user's email is "teamprojectgrupoc@gmail.com"
 *   the UI shows a message indicating this user can see all info without following.
 *   (Only affects UI text; it does not change database reads in this file.)
 *
 * MAIN FLOW (WHAT THIS FILE DOES):
 * 1) Initialize Firebase App + Auth + RTDB.
 * 2) Wait for Firebase session (onAuthStateChanged):
 *    - If not logged in:
 *        - Render warning + login redirect button inside #searchResults
 *        - Stop execution (return)
 *    - If logged in:
 *        - Optionally show "Master User" text
 *        - Load initial users list (first 10)
 * 3) loadInitialUsers():
 *    - Reads /users once
 *    - Takes the first 10 entries
 *    - Displays them in the results container
 * 4) searchUsers():
 *    - Reads /users once
 *    - Filters by username containing the typed search term (case-insensitive)
 *    - Displays matches
 * 5) displayUsers(list):
 *    - Renders each user as a clickable card with image + username
 *    - Click redirects to: viewprofile.html?uid={uid}
 *
 * UI ELEMENTS USED:
 * - #searchInput     → Text input for username search
 * - #searchBtn       → Button that triggers searchUsers()
 * - #searchResults   → Container where the users list / messages are rendered
 * - #masterText      → Optional element to show Master User label
 *
 * IMPORTANT NOTES / LIMITATIONS:
 * - This implementation reads the entire /users node (get()) for listing/search.
 *   Works fine for small/medium datasets; for large datasets, consider indexing
 *   and querying (orderByChild("username") + startAt/endAt).
 * - If a user has no profile picture, a default silhouette image is used.
 * ============================================================================
 */


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
const auth = getAuth(app);
const db = getDatabase(app);

// --- HTML ELEMENTS ---
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const resultsContainer = document.getElementById("searchResults");

searchBtn.addEventListener("click", searchUsers);

// --------------------------------------------------
//  WAIT FOR LOGGED IN USER
// --------------------------------------------------
onAuthStateChanged(auth, (user) => {
  if (!user) {
    //console.warn("User not logged in.");

    // ---  Show message and button on the web ---
    resultsContainer.innerHTML = `
      <div style="text-align: center; margin-top: 20px;">
        <p style="color: red; font-weight: bold; margin-bottom: 10px;">
            You must be logged in to view this content.
        </p>
        <button id="btnLoginRedirect" style="padding: 10px 20px; background-color: #333; color: white; border: none; cursor: pointer; border-radius: 5px;">
            Go to Login
        </button>
      </div>
    `;

    // Add event listener to the newly created button
    document.getElementById("btnLoginRedirect").addEventListener("click", () => {
        window.location.href = "login.html"; 
    });
   

    return; // Stop execution here
  }

  // Detect master
  if (user.email === "teamprojectgrupoc@gmail.com") {
    const masterText = document.getElementById("masterText");
    if (masterText) {
        masterText.textContent = "Master User : You can see all information without following";
    }
  }

  //console.log("Auth OK. Loading users...");
  loadInitialUsers();
});

// --------------------------------------------------
// 1. Automatically load 10 users
// --------------------------------------------------
async function loadInitialUsers() {
  resultsContainer.innerHTML = "Loading users...";

  try {
    const usersRef = ref(db, "users");
    const snapshot = await get(usersRef);

    if (!snapshot.exists()) {
      resultsContainer.innerHTML = "<p>No users found.</p>";
      return;
    }

    const usersObj = snapshot.val();

    const users = Object.entries(usersObj)
      .slice(0, 10)
      .map(([uid, data]) => ({
        uid,
        username: data.username,
        urlFotoPerfil: data.urlFotoPerfil
      }));

    displayUsers(users);

  } catch (err) {
    //console.error("Error loading users:", err);
    resultsContainer.innerHTML = "<p>Error loading users.</p>";
  }
}

// --------------------------------------------------
// 2. Search users
// --------------------------------------------------
async function searchUsers() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  resultsContainer.innerHTML = "Searching...";

  if (!searchTerm) {
    resultsContainer.innerHTML = "<p>Enter a username to search.</p>";
    return;
  }

  try {
    const usersRef = ref(db, "users");
    const snapshot = await get(usersRef);

    if (!snapshot.exists()) {
      resultsContainer.innerHTML = "<p>No users found.</p>";
      return;
    }

    const usersObj = snapshot.val();

    const matched = Object.entries(usersObj)
      .filter(([uid, user]) =>
        user.username?.toLowerCase().includes(searchTerm)
      )
      .map(([uid, data]) => ({
        uid,
        username: data.username,
        urlFotoPerfil: data.urlFotoPerfil
      }));

    if (matched.length === 0) {
      resultsContainer.innerHTML = "<p>No users match your search.</p>";
      return;
    }

    displayUsers(matched);

  } catch (err) {
    //console.error("Error searching users:", err);
    resultsContainer.innerHTML = "<p>Error searching users.</p>";
  }
}

// --------------------------------------------------
// 3. Display users + redirect to viewprofile.html
// --------------------------------------------------
function displayUsers(list) {
  resultsContainer.innerHTML = "";

  list.forEach(user => {
    const div = document.createElement("div");
    div.className = "search-user";
    div.style.cursor = "pointer";

    div.addEventListener("click", () => {
      window.location.href = `viewprofile.html?uid=${user.uid}`;
    });

    const img = document.createElement("img");
    img.src = user.urlFotoPerfil || "images/logos/silueta.png";
    img.alt = user.username;
    img.width = 100;
    img.height = 100;

    const name = document.createElement("p");
    name.textContent = user.username || "Unknown";

    div.appendChild(img);
    div.appendChild(name);

    resultsContainer.appendChild(div);
  });
}
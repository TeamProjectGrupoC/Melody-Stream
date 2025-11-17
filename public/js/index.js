// --- IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";

// Módulos de Realtime Database (RTDB)
// y renombramos 'ref' a 'databaseRef' para evitar conflictos
import { getDatabase, ref as databaseRef, onValue, set } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-database.js";

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

// --- SHOW "HELLO, USERNAME" IN THE H2 ELEMENT ---
document.addEventListener("DOMContentLoaded", () => {
    const h2 = document.getElementById("helloUser");
    if (!h2) return; // Page does not contain the H2 element → do nothing

    // Detect if the user is logged in
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // Reference to the user's data in Realtime Database
            const userRef = databaseRef(db, "users/" + user.uid);

            // Listen for changes in the user's data
            onValue(userRef, (snapshot) => {
                const data = snapshot.val();

                // If the user has a username stored, show it
                if (data && data.username) {
                    h2.textContent = "Hello, " + data.username;
                } else {
                    h2.textContent = "Hello!";
                }
            });
        } else {
            // If the user is not logged in
            h2.textContent = "Hello, guest!";
        }
    });
});

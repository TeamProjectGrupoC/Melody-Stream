/**
 * ============================================================================
 * LOGIN & AUTHENTICATION CONTROLLER
 * ============================================================================
 * This module manages the user sign-in process, session validation, and synchronization 
 * between Firebase Authentication (Identity) and the Realtime Database (User Data).
 *
 * * KEY WORKFLOWS:
 * 1. Initialization:
 * - Fetches Firebase configuration dynamically (supports Hosting auto-config).
 * - Initializes Auth and Database services.
 *
 * 2. Authentication Logic (signInBtn):
 * - Validates credentials and calls `signInWithEmailAndPassword`.
 * - 
 * - SECURITY ENFORCEMENT: Checks `user.emailVerified`. If false, forces logout 
 * and blocks access until the user verifies their email.
 *
 * 3. Database Synchronization:
 * - Fetches user profile from `users/{uid}`.
 * - If Profile Exists: Loads and displays user data.
 * - If Profile Missing (Edge Case): Triggers the "Extra Info Form" to collect 
 * missing details (Username/Phone) before creating the DB record.
 *
 * 4. Session Management:
 * - `onAuthStateChanged`: Protecs the "Profile" navigation link (redirects to 
 * login or shows error if not authenticated).
 * - Logout: Clears Firebase session, LocalStorage, and resets the UI.
 * ============================================================================
 */
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getDatabase, ref, set, get, child } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

async function main() {
  // --- 1. FIREBASE CONFIGURATION & INITIALIZATION ---
  let firebaseConfig;
  let app;

  try {
    // Attempt to fetch auto-generated configuration (common in Firebase Hosting environments)
    const response = await fetch('/__/firebase/init.json');
    firebaseConfig = await response.json();
  } catch (e) {
    console.warn("No se pudo cargar /__/firebase/init.json:", e);
  }

  // Logic to prevent multiple Firebase app initializations
  if (!getApps().length) {
    // If no app exists, we initialize a new one
    if (!firebaseConfig) {
      console.error("No hay configuración de Firebase disponible para inicializar la app.");
      return;
    }
    app = initializeApp(firebaseConfig);
  } else {
    // If an app already exists, we retrieve the existing instance
    app = getApp();
  }

  // Initialize Auth and Database services
  const auth = getAuth(app);
  const db = getDatabase(app);

  // --- 2. DOM ELEMENT SELECTION ---
  // Capturing all necessary HTML elements for interaction
  const emailLogin = document.getElementById('emailLogin');
  const passwordLogin = document.getElementById('passwordLogin');
  const signInBtn = document.getElementById('signInBtn');
  const toRegisterBtn = document.getElementById('toRegisterBtn');
  const signOutBtn = document.getElementById('signOutBtn');
  const msg = document.getElementById('msg'); // Element for status messages
  const dataDiv = document.getElementById('data'); // Container for user profile data
  
  // Elements for the "Extra Info" flow (if user data is missing in DB)
  const extraInfoForm = document.getElementById('extraInfoForm');
  const usernameInput = document.getElementById('usernameInput');
  const phoneInput = document.getElementById('phoneInput');
  const saveExtraBtn = document.getElementById('saveExtraBtn');
  const profileLink = document.getElementById('profileLink');

  // --- 3. AUTH STATE OBSERVER ---
  // This listener runs every time the user logs in or out
  onAuthStateChanged(auth, (user) => {
    if (profileLink) {
      if (user) {
        // If logged in: Link points to the profile page
        profileLink.href = '../profile.html';
        profileLink.onclick = null;
      } 
      else {
        // If logged out: Link points to login, but we intercept the click to show an error
        profileLink.href = 'login.html';
        profileLink.onclick = (e) => {
          e.preventDefault();
          displayStyledError("You must be logged in to access your profile");
        };
      }
    }
  });

  // --- 4. DATABASE HELPER FUNCTIONS ---

  /**
   * Saves user details to the Realtime Database.
   * Initializes empty objects for favorites and spotify integration.
   */
  async function saveToDB(uid, email, username, phone) {
    return set(ref(db, 'users/' + uid), { 
        email, 
        username, 
        phone, 
        favorite_songs: {}, 
        spotify: {} 
    });
  }

  /**
   * Fetches user data strictly once (no realtime listener).
   * Returns the data object or null if not found.
   */
  async function fetchUserData(uid) {
    try {
      const rootRef = ref(db);
      const snap = await get(child(rootRef, `users/${uid}`));
      return snap.exists() ? snap.val() : null;
    } catch (e) {
      console.error(e);
      return null;
    }
  }

  /**
   * Renders the fetched user data into the HTML container.
   */
  function showUserData(ud, uid) {
    dataDiv.style.display = 'block';
    dataDiv.innerHTML = `
            <h3>My Data</h3>
            <p><strong>Username:</strong> ${ud.username}</p>
            <p><strong>Phone:</strong> ${ud.phone}</p>
            <p><strong>Email:</strong> ${ud.email}</p>
        `;
    signOutBtn.style.display = 'inline-block';
  }

  // --- 5. EVENT LISTENERS (INTERACTIONS) ---

  // [Login Button Click]
  signInBtn?.addEventListener('click', async () => {
    // 1. Reset UI messages and hide previous data
    msg.textContent = '';
    if (dataDiv) dataDiv.style.display = 'none';
    if (extraInfoForm) extraInfoForm.style.display = 'none';

    // 2. Get input values
    const email = emailLogin?.value.trim();
    const password = passwordLogin?.value;

    // 3. Validation
    if (!email || !password) { 
        if (msg) msg.textContent = 'Email and password required.'; 
        return; 
    }

    try {
      // 4. Attempt Firebase Sign In
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const user = cred.user;

      // 5. SECURITY CHECK: Email Verification
      // If the user hasn't verified their email link, force logout and deny access.
      if (!user.emailVerified) {
        if (msg) msg.textContent = 'Your email is not verified yet. Check your inbox.';
        await signOut(auth);
        return;
      }

      // 6. Fetch User Data from Database
      const ud = await fetchUserData(user.uid);

      // 7. Handle Missing Data (Edge Case)
      // If user exists in Auth but not in DB, show the form to complete profile.
      if (!ud) {
        if (extraInfoForm) {
          extraInfoForm.style.display = 'block';
          if (msg) msg.textContent = 'Please complete your profile to save your info.';
        }
        return;
      }

      // 8. Success: Show user data
      showUserData(ud, user.uid);
    } catch (err) {
      console.error(err);
      if (msg) msg.textContent = `Login error: ${err.message}`;
    }
  });

  // 

  // [Save Extra Info Button Click]
  // Used when a user is logged in (Auth) but lacks a DB entry
  saveExtraBtn?.addEventListener('click', async () => {
    const user = auth.currentUser;
    const username = usernameInput?.value.trim();
    const phone = phoneInput?.value.trim();

    if (!username || !phone) { 
        if (msg) msg.textContent = 'Username and phone required.'; 
        return; 
    }

    try {
      // Save new data to DB using the current Auth UID
      await saveToDB(user.uid, user.email, username, phone);
      
      // Update UI
      if (extraInfoForm) extraInfoForm.style.display = 'none';
      const ud = await fetchUserData(user.uid);
      showUserData(ud, user.uid);
      
      if (msg) msg.innerHTML = `Profile saved! Logged in as <span class="user-email">${user.email}</span>.`;
    } 
    catch (err) {
      console.error(err);
      if (msg) msg.textContent = `Error saving profile: ${err.message}`;
    }
  });

  // [Register Button] - Simple redirect
  toRegisterBtn?.addEventListener('click', () => window.location.href = 'register.html');

  // [Sign Out Button]
  signOutBtn?.addEventListener('click', async () => {
    try {
      await signOut(auth); // Firebase SignOut
      
      // UI Cleanup
      if (msg) msg.textContent = 'Signed out.';
      if (dataDiv) dataDiv.style.display = 'none';
      if (extraInfoForm) extraInfoForm.style.display = 'none';
      if (signOutBtn) signOutBtn.style.display = 'none';
      
      // Local Storage Cleanup (Remove cached profile pic)
      localStorage.removeItem('profilePic');
      const headerPic = document.getElementById('headerUserPic');
      if (headerPic) headerPic.src = "images/logos/silueta.png";
    } catch (e) {
      console.error("Error signing out:", e);
    }
  });

} // end main

// --- 6. UTILITY FUNCTIONS ---

/**
 * Displays a temporary error message that disappears after 4 seconds.
 * Used primarily for the protected profile link.
 */
function displayStyledError(message) {
    const errorDisplay = document.getElementById('authErrorDisplay');
    if (errorDisplay) {
        errorDisplay.innerHTML = message;
        errorDisplay.style.display = 'block';

        setTimeout(() => {
            errorDisplay.style.display = 'none';
            errorDisplay.innerHTML = '';
        }, 4000);
    }
}

main();
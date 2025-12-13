/**
 * ============================================================================
 * GLOBAL HEADER & NAVIGATION CONTROLLER
 * ============================================================================
 * This script manages the state of the main navigation header across the application.
 * It handles authentication UI (Login vs Profile/Logout), loads user avatars, 
 * and provides real-time notifications for incoming chat messages.
 *
 * * KEY FEATURES & LOGIC:
 *
 * 1. DEFENSIVE DOM MANIPULATION:
 * - Checks if header elements (Nav, Profile Link, User Pic) exist.
 * - If missing, it dynamically creates and injects them to prevent errors.
 *
 * 2. AUTHENTICATION STATE MANAGEMENT (onAuthStateChanged):
 * 
 * - LOGGED OUT:
 * > Resets header to "Guest" mode (Log In link, default silhouette).
 * > Removes the "Log Out" button.
 * - LOGGED IN:
 * > Updates link to "MY PROFILE".
 * > Inserts a "LOG OUT" button dynamically.
 * > Fetches the specific user's profile picture from Realtime DB (`users/{uid}`).
 * > "Master User" Logic: Applies special Gold styling if the email matches the admin.
 *
 * 3. REAL-TIME NOTIFICATIONS (onChildChanged):
 * - Sets a listener on `userChats/{uid}`.
 * - When a chat updates, checks if the last message was sent by someone else.
 * - Triggers `showNewMessagesButton()`:
 * > Injects a temporary "New Messages!" button into the nav.
 * > Button auto-removes itself after 10 seconds via setTimeout.
 *
 * 4. LOGOUT HANDLING:
 * - Signs the user out of Firebase.
 * - Clears local storage tokens (Spotify).
 * - Redirects the user based on their current page (e.g., restricted pages go to login).
 * ============================================================================
 */
// --- IMPORTS ---
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getDatabase, ref, get, onChildChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

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

if (!getApps().length) initializeApp(firebaseConfig);
const auth = getAuth();
const db = getDatabase();

document.addEventListener("DOMContentLoaded", () => {
  const header = document.getElementById("headerPrincipal") || document.querySelector("header");
  const nav = header?.querySelector("#NavPrincipal") || header?.querySelector("nav");

  let isMaster = false;
  
  // Variable to control the message button timer
  let messageButtonTimeout;

  // --- LOGIN/PROFILE LINK LOGIC ---
  let loginProfileLink = document.getElementById("loginProfileLink");
  if (!loginProfileLink) {
    if (nav) {
      const ul = nav.querySelector("ul") || (() => { const u = document.createElement("ul"); nav.appendChild(u); return u; })();
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.id = "loginProfileLink";
      a.href = "login.html";
      a.textContent = "LOG IN";
      li.appendChild(a);
      ul.appendChild(li);
      loginProfileLink = a;
    } else if (header) {
      const a = document.createElement("a");
      a.id = "loginProfileLink";
      a.href = "login.html";
      a.textContent = "LOG IN";
      header.appendChild(a);
      loginProfileLink = a;
    }
  }

  // --- HEADER PROFILE PICTURE LOGIC ---
  let headerPic = document.getElementById("headerUserPic");
  if (!headerPic) {
    const profileWrap = document.getElementById("headerProfileIm");
    if (profileWrap) {
      let anchor = profileWrap.querySelector("a");
      if (!anchor) {
        anchor = document.createElement("a");
        anchor.href = "profile.html";
        profileWrap.appendChild(anchor);
      }
      const img = document.createElement("img");
      img.id = "headerUserPic";
      img.src = "images/logos/silueta.png";
      img.alt = "User Profile Icon";
      anchor.appendChild(img);
      headerPic = img;
    }
  }

 // --- Create the Logout Button Element ---
  function createLogoutListItem() {
    // 1. Create DOM elements (List Item & Anchor)
    const li = document.createElement("li");
    li.id = "logoutLi";
    const a = document.createElement("a");
    a.id = "header-logout-link";
    a.href = "#";
    a.textContent = "LOG OUT";
    a.style.cursor = "pointer";

    // 2. Attach Click Listener
    a.addEventListener("click", async (ev) => {
      ev.preventDefault(); // Stop default link behavior
      try {
        // 3. Perform Firebase Sign Out
        await signOut(auth);
        
        // 4. Clear sensitive data (Spotify Token)
        localStorage.removeItem("spotify_access_token");
        
        // 5. Smart Redirect Logic: Check current page to decide destination
        if (window.location.pathname.endsWith("test_spotify.html")) {
          window.location.href = "test_register_spotify.html";
        } else if (window.location.pathname.endsWith("profile.html")){
          window.location.href = "login.html" // Protect profile page
        } else if (window.location.pathname.endsWith("chat.html")){
          window.location.href = "login.html" // Protect chat page
        } else {
          window.location.reload(); // Just reload for public pages
        }
      } catch (err) {
        // 6. Error Handling: Force cleanup and reload if sign-out fails
        console.error("Sign out error:", err);
        localStorage.removeItem("spotify_access_token");
        window.location.reload();
      }
    });

    li.appendChild(a);
    return li;
  }

  // --- Insert Logout Button into DOM ---
  function insertLogoutButton() {
    if (!header) return;
    if (document.getElementById("logoutLi")) return; // Prevent duplicates

    // Find the main navigation list
    const targetNav = header.querySelector("#NavPrincipal") || header.querySelector("nav");
    const ul = targetNav?.querySelector("ul") || targetNav;
    
    // Strategy 1: Insert it immediately AFTER the Profile link (User UX)
    if (loginProfileLink) {
      const parentLi = loginProfileLink.closest("li");
      if (parentLi && parentLi.parentNode) {
        parentLi.parentNode.insertBefore(createLogoutListItem(), parentLi.nextSibling);
        return;
      }
    }
    // Strategy 2: Fallback (Append to the end of the list)
    if (ul) ul.appendChild(createLogoutListItem());
    else header.appendChild(createLogoutListItem());
  }

  // --- Remove Logout Button (Cleanup) ---
  function removeLogoutButton() {
    const li = document.getElementById("logoutLi");
    // Remove only if it exists and has a parent
    if (li && li.parentNode) li.parentNode.removeChild(li);
  }

  // --- Remove Duplicate "Log In" Links ---
  function removeExtraLoginLinks() {
    const targetNav = header?.querySelector("#NavPrincipal") || header?.querySelector("nav");
    if (!targetNav) return;

    // Scan all links to remove hardcoded or legacy "Log In" buttons
    const anchors = targetNav.querySelectorAll("a");
    anchors.forEach(a => {
      // Condition: It says "LOG IN" but is NOT our main controlled link
      if (a !== loginProfileLink && a.textContent && a.textContent.trim().toUpperCase() === "LOG IN") {
        const li = a.closest("li");
        // Remove the entire LI if possible, otherwise just the anchor
        if (li && li.parentNode) li.parentNode.removeChild(li);
        else a.remove();
      }
    });
  }

  // --- NEW FUNCTION: Show New Messages Button ---
  function showNewMessagesButton() {
    const targetNav = header.querySelector("#NavPrincipal") || header.querySelector("nav");
    const ul = targetNav?.querySelector("ul");
    
    if (!ul) return;

    // 1. Check if it already exists
    let msgLi = document.getElementById("new-msg-li");

    // 2. If not, create it
    if (!msgLi) {
        msgLi = document.createElement("li");
        msgLi.id = "new-msg-li";
        
        const link = document.createElement("a");
        link.href = "chat.html";
        link.textContent = "New Messages!";
        
        // CSS Class applied here
        link.className = "new-messages-btn";
        
        msgLi.appendChild(link);
        
        // Insert at the BEGINNING (before Home)
        ul.prepend(msgLi);
    }

    // 3. Reset the timer
    if (messageButtonTimeout) clearTimeout(messageButtonTimeout);

    messageButtonTimeout = setTimeout(() => {
        if (msgLi && msgLi.parentNode) {
            msgLi.parentNode.removeChild(msgLi);
        }
    }, 10000); // 10 seconds
  }

  // --- AUTH LISTENER ---
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      if (loginProfileLink) {
        loginProfileLink.textContent = "LOG IN";
        loginProfileLink.href = "login.html";
        loginProfileLink.style.display = "";
      }
      removeLogoutButton();
      removeExtraLoginLinks();
      if (headerPic) headerPic.src = "images/logos/silueta.png";
      document.body.classList.add("header-ready");
      return;
    }

    // LOGGED IN State
    
    // --- Listen for incoming messages ---
    const userChatsRef = ref(db, `userChats/${user.uid}`);
    onChildChanged(userChatsRef, (snapshot) => {
        const chatData = snapshot.val();
        const lastMsg = chatData.lastMessage;

        if (lastMsg && lastMsg.sender !== user.uid) {
            showNewMessagesButton();
        }
    });

    // Detect master user
    if (user.email === "teamprojectgrupoc@gmail.com") {
      isMaster = true;
      header.style.background = `linear-gradient(135deg, #FFD700 0%, #FFB700 25%, #FFE599 50%, #FFD700 75%, #FFA500 100%)`;
      header.style.border = "2px solid #B8860B"; 
      header.style.color = "#fff";
      header.style.fontWeight = "bold";
    }

    if (loginProfileLink) {
      loginProfileLink.textContent = "MY PROFILE";
      loginProfileLink.href = "profile.html";
      loginProfileLink.style.display = "";
    }

    insertLogoutButton();
    removeExtraLoginLinks();

    // Load profile photo
    try {
      const userRef = ref(db, `users/${user.uid}`);
      const snap = await get(userRef);
      if (snap.exists()) {
        const data = snap.val();
        if (headerPic && data.urlFotoPerfil) headerPic.src = data.urlFotoPerfil;
        else if (headerPic) headerPic.src = "images/logos/silueta.png";
      } else if (headerPic) {
        headerPic.src = "images/logos/silueta.png";
      }
    } catch (err) {
      console.error("Error loading header data:", err);
      if (headerPic) headerPic.src = "images/logos/silueta.png";
    }

    document.body.classList.add("header-ready");
  });
});
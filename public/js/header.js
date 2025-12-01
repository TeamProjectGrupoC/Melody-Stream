// --- IMPORTS ---
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

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
  // asegurar que exista el nav/ul
  const nav = header?.querySelector("#NavPrincipal") || header?.querySelector("nav");

  let isMaster = false;
  
  // buscar o crear el enlace de login/profile
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

  // asegurar imagen de header (headerUserPic)
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

    function createLogoutListItem() {
    const li = document.createElement("li");
    li.id = "logoutLi";
    const a = document.createElement("a");
    a.id = "header-logout-link";
    a.href = "#";
    a.textContent = "LOG OUT";
    a.style.cursor = "pointer";

    a.addEventListener("click", async (ev) => {
      ev.preventDefault();
      try {
        await signOut(auth);

        localStorage.removeItem("spotify_access_token");

        // Redirigir si estamos en test_spotify.html
        if (window.location.pathname.endsWith("test_spotify.html")) {
          window.location.href = "test_register_spotify.html";
        } else {
          window.location.reload();
        }
      } catch (err) {
        console.error("Sign out error:", err);

        localStorage.removeItem("spotify_access_token");

        if (window.location.pathname.endsWith("test_spotify.html")) {
          window.location.href = "test_register_spotify.html";
        } else {
          window.location.reload();
        }
      }
    });

    li.appendChild(a);
    return li;
  }

  function insertLogoutButton() {
    if (!header) return;
    if (document.getElementById("logoutLi")) return;
    const targetNav = header.querySelector("#NavPrincipal") || header.querySelector("nav");
    const ul = targetNav?.querySelector("ul") || targetNav;
    if (loginProfileLink) {
      const parentLi = loginProfileLink.closest("li");
      if (parentLi && parentLi.parentNode) {
        parentLi.parentNode.insertBefore(createLogoutListItem(), parentLi.nextSibling);
        return;
      }
    }
    if (ul) ul.appendChild(createLogoutListItem());
    else header.appendChild(createLogoutListItem());
  }

  function removeLogoutButton() {
    const li = document.getElementById("logoutLi");
    if (li && li.parentNode) li.parentNode.removeChild(li);
  }

  function removeExtraLoginLinks() {
    const targetNav = header?.querySelector("#NavPrincipal") || header?.querySelector("nav");
    if (!targetNav) return;
    const anchors = targetNav.querySelectorAll("a");
    anchors.forEach(a => {
      if (a !== loginProfileLink && a.textContent && a.textContent.trim().toUpperCase() === "LOG IN") {
        const li = a.closest("li");
        if (li && li.parentNode) li.parentNode.removeChild(li);
        else a.remove();
      }
    });
  }

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

    // Detect master
    if (user.email === "teamprojectgrupoc@gmail.com") {
      isMaster = true;
      header.style.backgroundColor = "gold";
    }

    if (loginProfileLink) {
      loginProfileLink.textContent = "MY PROFILE";
      loginProfileLink.href = "profile.html";
      loginProfileLink.style.display = "";
    }

    insertLogoutButton();
    removeExtraLoginLinks();

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

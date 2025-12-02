import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getDatabase, ref, set, get, child } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

console.log("✅ login.js cargado correctamente");

async function main() {
  let firebaseConfig;
  let app;

  try {
    const response = await fetch('/__/firebase/init.json');
    firebaseConfig = await response.json();
  } catch (e) {
    console.warn("No se pudo cargar /__/firebase/init.json:", e);
  }

  // Inicializar solo si no hay apps; si ya existe, reutilizarla
  if (!getApps().length) {
    if (!firebaseConfig) {
      console.error("No hay configuración de Firebase disponible para inicializar la app.");
      return;
    }
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }

  const auth = getAuth(app);
  const db = getDatabase(app);

  const emailLogin = document.getElementById('emailLogin');
  const passwordLogin = document.getElementById('passwordLogin');
  const signInBtn = document.getElementById('signInBtn');
  const toRegisterBtn = document.getElementById('toRegisterBtn');
  const signOutBtn = document.getElementById('signOutBtn');
  const msg = document.getElementById('msg');
  const dataDiv = document.getElementById('data');
  const extraInfoForm = document.getElementById('extraInfoForm');
  const usernameInput = document.getElementById('usernameInput');
  const phoneInput = document.getElementById('phoneInput');
  const saveExtraBtn = document.getElementById('saveExtraBtn');
  const profileLink = document.getElementById('profileLink');

  onAuthStateChanged(auth, (user) => {
    if (profileLink) {
      if (user) {
        profileLink.href = '../profile.html';
        profileLink.onclick = null;
      } 
    else {
        profileLink.href = 'login.html';
        profileLink.onclick = (e) => {
          e.preventDefault();
          displayStyledError("You must be logged in to access your profile");
      };
    }
    }
  });

  async function saveToDB(uid, email, username, phone) {
    return set(ref(db, 'users/' + uid), { email, username, phone, favorite_songs: {}, spotify: {} });
  }

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

  // Login
  signInBtn?.addEventListener('click', async () => {
    msg.textContent = '';
    if (dataDiv) dataDiv.style.display = 'none';
    if (extraInfoForm) extraInfoForm.style.display = 'none';

    const email = emailLogin?.value.trim();
    const password = passwordLogin?.value;

    if (!email || !password) { if (msg) msg.textContent = 'Email and password required.'; return; }

    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const user = cred.user;

      if (!user.emailVerified) {
        if (msg) msg.textContent = 'Your email is not verified yet. Check your inbox.';
        await signOut(auth);
        return;
      }

      const ud = await fetchUserData(user.uid);

      if (!ud) {
        if (extraInfoForm) {
          extraInfoForm.style.display = 'block';
          if (msg) msg.textContent = 'Please complete your profile to save your info.';
        }
        return;
      }

      showUserData(ud, user.uid);
    } catch (err) {
      console.error(err);
      if (msg) msg.textContent = `Login error: ${err.message}`;
    }
  });

  // Save extra info
  saveExtraBtn?.addEventListener('click', async () => {
    const user = auth.currentUser;
    const username = usernameInput?.value.trim();
    const phone = phoneInput?.value.trim();

    if (!username || !phone) { if (msg) msg.textContent = 'Username and phone required.'; return; }

    try {
      await saveToDB(user.uid, user.email, username, phone);
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

  toRegisterBtn?.addEventListener('click', () => window.location.href = 'register.html');

  signOutBtn?.addEventListener('click', async () => {
    try {
      await signOut(auth);
      if (msg) msg.textContent = 'Signed out.';
      if (dataDiv) dataDiv.style.display = 'none';
      if (extraInfoForm) extraInfoForm.style.display = 'none';
      if (signOutBtn) signOutBtn.style.display = 'none';
      localStorage.removeItem('profilePic');
      const headerPic = document.getElementById('headerUserPic');
      if (headerPic) headerPic.src = "images/logos/silueta.png";
    } catch (e) {
      console.error("Error signing out:", e);
    }
  });

} // end main

//Displays a temporary error meessaged to the user (when you are not log in and try to access profile.html)
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
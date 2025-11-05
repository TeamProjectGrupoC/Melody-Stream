
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getDatabase, ref, set, get, child } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

console.log("✅ login.js cargado correctamente");

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

async function saveToDB(uid, email, username, phone) {
    return set(ref(db, 'users/' + uid), { email, username, phone, favorite_songs:{}, spotify:{} });
}

async function fetchUserData(uid) {
    try {
        const rootRef = ref(db);
        const snap = await get(child(rootRef, `users/${uid}`));
        return snap.exists() ? snap.val() : null;
    } catch(e){ console.error(e); return null; }
}

function showUserData(ud, uid){
    dataDiv.style.display='block';
    dataDiv.innerHTML = `
        <h3>My Data (${uid})</h3>
        <p><strong>Username:</strong> ${ud.username}</p>
        <p><strong>Phone:</strong> ${ud.phone}</p>
        <p><strong>Email:</strong> ${ud.email}</p>
        <p><strong>Favorite Songs:</strong> ${JSON.stringify(ud.favorite_songs,null,2)}</p>
    `;
    signOutBtn.style.display='inline-block';
}

// Login
signInBtn.addEventListener('click', async () => {
    msg.textContent = '';
    dataDiv.style.display='none';
    extraInfoForm.style.display='none';

    const email = emailLogin.value.trim();
    const password = passwordLogin.value;

    if(!email || !password){ msg.textContent='Email and password required.'; return; }

    try{
        const cred = await signInWithEmailAndPassword(auth,email,password);
        const user = cred.user;

        if(!user.emailVerified){
            msg.textContent='Your email is not verified yet. Check your inbox.';
            await signOut(auth);
            return;
        }

        let ud = await fetchUserData(user.uid);

        if(!ud){
            // Show extra info form to complete profile
            extraInfoForm.style.display='block';
            msg.textContent='Please complete your profile to save your info.';
            return;
        }

        // Show data if already exists
        showUserData(ud, user.uid);
    } catch(err){ msg.textContent=`Login error: ${err.message}`; console.error(err);}
});

// Save extra info
saveExtraBtn.addEventListener('click', async () => {
    const user = auth.currentUser;
    const username = usernameInput.value.trim();
    const phone = phoneInput.value.trim();

    if(!username || !phone){ msg.textContent='Username and phone required.'; return; }

    try{
        await saveToDB(user.uid, user.email, username, phone);
        extraInfoForm.style.display='none';
        const ud = await fetchUserData(user.uid);
        showUserData(ud, user.uid);
        msg.textContent = `Profile saved! Logged in as ${user.email}.`;
    } catch(err){ msg.textContent=`Error saving profile: ${err.message}`; console.error(err);}
});

toRegisterBtn.addEventListener('click',()=>window.location.href='register.html');

signOutBtn.addEventListener('click', async ()=>{
    await signOut(auth);
    msg.textContent='Signed out.';
    dataDiv.style.display='none';
    extraInfoForm.style.display='none';
    signOutBtn.style.display='none';
});

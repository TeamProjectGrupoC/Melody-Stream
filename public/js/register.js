import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, sendEmailVerification } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

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

const emailInput = document.getElementById('emailRegister');
const passwordInput = document.getElementById('passwordRegister');
const signUpBtn = document.getElementById('signUpBtn');
const goLoginBtn = document.getElementById('goLoginBtn');
const msg = document.getElementById('msg');

signUpBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if(!email || !password){ msg.textContent = 'Email and password are required.'; return; }

    try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const user = cred.user;
        await sendEmailVerification(user);
        msg.textContent = `Registration successful! Verification email sent to ${user.email}. Please verify before logging in.`;
    } catch(err) {
        msg.textContent = `Registration error: ${err.message}`;
        //console.error(err);
    }
});

goLoginBtn.addEventListener('click', () => window.location.href='login.html');

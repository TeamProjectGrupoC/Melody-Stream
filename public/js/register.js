import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, sendEmailVerification } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

/**
 * ============================================================================
 * REGISTER.JS – USER REGISTRATION & EMAIL VERIFICATION
 * ============================================================================
 *
 * FIREBASE SERVICES USED:
 *
 * Firebase Authentication
 * - createUserWithEmailAndPassword
 * - sendEmailVerification
 *
 * AUTHENTICATION FLOW:
 *
 * 1) Firebase App is initialized using the global project configuration.
 * 2) Firebase Authentication service is obtained from the initialized app.
 * 3) User provides email and password via the registration form.
 * 4) On "Sign Up" button click:
 *    - Input validation is performed (email & password required).
 *    - A new Firebase Auth user is created.
 *    - A verification email is sent to the registered email address.
 * 5) The user is informed that they must verify their email before logging in.
 *
 * UI ELEMENTS USED:
 * - #emailRegister      → Email input
 * - #passwordRegister   → Password input
 * - #signUpBtn          → Registration trigger
 * - #goLoginBtn         → Redirect to login page
 * - #msg                → Status / error messages
 *
 * IMPORTANT NOTES:
 * - User profile data is NOT created here (handled elsewhere after login).
 * - Email verification is mandatory before allowing access to the platform.
 * - Errors are shown to the user but console logging is optional/commented.
 * ============================================================================
 */


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

// --- IMPORTACIONES ---
// Módulos de App y Autenticación (como los tenías)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";

// Módulos de Realtime Database (RTDB)
// ¡CAMBIO! Importamos 'set' para poder escribir en la base de datos
// y renombramos 'ref' a 'databaseRef' para evitar conflictos
import { getDatabase, ref as databaseRef, onValue, set } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-database.js";

// Módulos de Storage (¡NUEVO!)
// Importamos todo lo necesario para subir archivos y obtener la URL
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-storage.js";

// --- CONFIGURACIÓN DE FIREBASE ---
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

// --- INICIALIZACIÓN DE SERVICIOS ---
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const storage = getStorage(app);
let currentUser = null; // Guardaremos el usuario aquí para que la función de subida lo vea

// --- FUNCIÓN DE CARGA DE DATOS (LA QUE TENÍAS) ---
function cargarDatosDePerfil() {
    const imagenElemento = document.getElementById('fotoPerfilUsuario');
    const msgElemento = document.getElementById('msg');
    
    if (!imagenElemento || !msgElemento) {
        console.error("Faltan elementos HTML (msg o fotoPerfilUsuario)");
        return;
    }

    onAuthStateChanged(auth, (user) => {
    currentUser = user; // Guardamos el usuario actual

    const msgElemento = document.getElementById('msg');
    const imagenElemento = document.getElementById('fotoPerfilUsuario');
    const userDataDiv = document.getElementById('userData');

    if (user) {
        msgElemento.textContent = `✅ Logged in as ${user.email}`;

        // Referencia al usuario en la base de datos
        const userRef = databaseRef(db, 'users/' + user.uid);

        onValue(userRef, (snapshot) => {
        const userData = snapshot.val();

        if (userData) {
            // Mostrar datos de perfil
            userDataDiv.style.display = 'block';
            userDataDiv.innerHTML = `
            <h3>Profile Information</h3>
            <p><strong>Username:</strong> ${userData.username || "—"}</p>
            <p><strong>Phone:</strong> ${userData.phone || "—"}</p>
            <p><strong>Email:</strong> ${user.email}</p>
            <p><strong>Favorite Songs:</strong> ${
                userData.favorite_songs
                ? Object.keys(userData.favorite_songs).join(", ")
                : "—"
            }</p>
            `;

            // Mostrar foto de perfil si existe
            if (userData.urlFotoPerfil) {
            imagenElemento.src = userData.urlFotoPerfil;
            }
        } else {
            userDataDiv.style.display = 'none';
        }
        });

    } else {
        msgElemento.textContent = "⚠️ You must be logged in to see your profile.";
        imagenElemento.src = "images/logos/silueta.png";
        userDataDiv.style.display = 'none';
    }
    });
}

// --- ¡NUEVA FUNCIÓN! MANEJAR LA SUBIDA DEL FORMULARIO ---
function setupFormUploadListener() {
    const form = document.getElementById('uploadForm');
    const fileInput = document.getElementById('fotoArchivo');
    
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault(); // ¡CLAVE! Detiene el envío normal del formulario

        // 1. Validaciones
        if (!currentUser) {
            alert("Debes estar logueado para subir una foto.");
            return;
        }
        const file = fileInput.files[0];
        if (!file) {
            alert("Por favor, selecciona un archivo.");
            return;
        }

        // 2. Crear la ruta de subida en Firebase Storage
        // Ej: 'profile_images/UID_DEL_USUARIO/nombre_del_archivo.jpg'
        const filePath = `profile_images/${currentUser.uid}/${file.name}`;
        const sRef = storageRef(storage, filePath); // Usamos storageRef

        try {
            // 3. Subir el archivo
            alert("Subiendo foto...");
            const snapshot = await uploadBytes(sRef, file);
            console.log('¡Foto subida!', snapshot);

            // 4. Obtener la URL de descarga
            const downloadURL = await getDownloadURL(snapshot.ref);
            console.log('URL del archivo:', downloadURL);

            // 5. Guardar la URL en Realtime Database
            const userDbRef = databaseRef(db, 'users/' + currentUser.uid + '/urlFotoPerfil');
            await set(userDbRef, downloadURL);
            
            // 6. Actualizar la imagen en la página (la silueta)
            document.getElementById('fotoPerfilUsuario').src = downloadURL;
            alert("¡Foto de perfil actualizada!");

        } catch (error) {
            console.error("Error al subir el archivo:", error);
            alert("Error al subir la foto. Revisa la consola.");
        }
    });
}

// --- INICIAR LAS FUNCIONES ---
// Cuando el HTML esté cargado, ejecuta ambas funciones
document.addEventListener('DOMContentLoaded', () => {
    cargarDatosDePerfil(); // Carga el email y la foto existente
    setupFormUploadListener(); // Prepara el formulario de subida
});

document.getElementById('goToChatBtn').addEventListener('click', () => {
  window.location.href = 'chat.html';
});

document.getElementById('logOutBtn').addEventListener('click', async () => {
    const msgElemento = document.getElementById('msg');
    const fotoElemento = document.getElementById('fotoPerfilUsuario');

    try {
        await signOut(auth);

        msgElemento.textContent = "You have successfully logged out.";

        if (fotoElemento) {
            fotoElemento.src = "images/logos/silueta.png";
        }

        const userDataDiv = document.getElementById('userData');
        if (userDataDiv) userDataDiv.style.display = "none";

    } catch (error) {
        console.error("Log out error:", error);
        msgElemento.textContent = "Error logging out.";
    }
});
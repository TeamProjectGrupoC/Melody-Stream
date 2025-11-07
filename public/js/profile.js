// --- IMPORTACIONES ---
// Módulos de App y Autenticación (como los tenías)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";

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
        currentUser = user; // ¡IMPORTANTE! Guardamos el usuario actual
        if (user) {
            msgElemento.textContent = `✅ Logged in as ${user.email}`;
            
            const userRef = databaseRef(db, 'users/' + user.uid); // Usamos databaseRef
            onValue(userRef, (snapshot) => {
                const userData = snapshot.val();
                if (userData && userData.urlFotoPerfil) {
                    imagenElemento.src = userData.urlFotoPerfil;
                    imagenElemento.alt = "Foto de perfil del usuario";
                } else {
                    console.log("No se encontró una URL de foto de perfil en RTDB. Se usa la silueta.");
                }
            }, { onlyOnce: true });

        } else {
            msgElemento.textContent = "⚠️ You must be logged in to see your profile.";
            console.log("Usuario no autenticado, asegurando que se muestra la silueta.");
            imagenElemento.src = "images/logos/silueta.png";
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
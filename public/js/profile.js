// Importaciones de módulos
import { app } from './firebase-config.js'; 
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";

// ***** CAMBIO CLAVE: Importar Realtime Database *****
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-database.js";

// Inicializa los servicios
const auth = getAuth(app);
// ***** CAMBIO CLAVE: Inicializar RTDB *****
const db = getDatabase(app); 


/**
 * Verifica la autenticación y carga la foto de perfil desde Realtime Database.
 */
function cargarFotoDePerfil() {
    
    const imagenElemento = document.getElementById('fotoPerfilUsuario');
    
    if (!imagenElemento) {
        return;
    }

    onAuthStateChanged(auth, (user) => {
        if (user) {
            // USUARIO CONECTADO
            
            // ***** LÓGICA DE RTDB AQUÍ *****
            // 1. Referencia a la ubicación de los datos del usuario: usuarios/[uid]
            const userRef = ref(db, 'usuarios/' + user.uid);

            // 2. Lee los datos una sola vez desde esa ubicación
            onValue(userRef, (snapshot) => {
                
                // 3. Obtiene el objeto de datos del usuario
                const userData = snapshot.val();
                
                // ***** LA LÓGICA IF/ELSE CON RTDB *****
                
                // 4. Chequea si hay datos Y si existe el campo 'urlFotoPerfil'
                if (userData && userData.urlFotoPerfil) {
                    
                    const urlGuardada = userData.urlFotoPerfil;
                    
                    // 5. ACTUALIZAR EL HTML: Cambia el 'src' de la imagen
                    imagenElemento.src = urlGuardada;
                    imagenElemento.alt = "Foto de perfil del usuario";
                    
                } else {
                    // 6. NO HAY FOTO: Se mantiene la silueta por defecto del HTML
                    console.log("No se encontró una URL de foto de perfil en RTDB. Se usa la silueta.");
                }
            }, {
                // Configuración para leer una sola vez si solo te interesa el estado inicial
                onlyOnce: true 
            });


        } else {
            // USUARIO DESCONECTADO
            console.log("Usuario no autenticado, asegurando que se muestra la silueta.");
        }
    });
}

// Ejecuta la función principal tan pronto como el HTML esté completamente cargado
document.addEventListener('DOMContentLoaded', cargarFotoDePerfil);
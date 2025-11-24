const clientId = "bec926b86f644a3f976bddd2364f69d8"; 
const redirectUri = "https://melodystream123.web.app/test_spotify.html";
const scopes = "user-read-private user-read-email streaming user-read-playback-state user-modify-playback-state";

// ----------------------------------------------------------------------
// ENVOLVEMOS TODO EL CÓDIGO DENTRO DE DOMContentLoaded
// Esto resuelve cualquier problema de "elemento no encontrado" o "referencia no definida"
// al asegurar que el HTML se haya cargado completamente.
// ----------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {

    // 1. Manejador para el botón de Spotify
    const spotifyLoginButton = document.getElementById("spotifyLogin");
    if (spotifyLoginButton) {
        spotifyLoginButton.addEventListener("click", () => {
          const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}`;
          window.location.href = authUrl;
        });
    }

    // 2. Manejador para el botón de la Librería
    const botonlibreria = document.getElementById("musicLibrary");
    if (botonlibreria) {
        botonlibreria.addEventListener("click", function() {
            window.location.href = "musiclibrary.html";
        });
    } else {
        // Muestra un error útil en la consola si el botón no se encuentra.
        console.error("Error: El botón con ID 'musicLibrary' no se encontró en el HTML.");
    }

    // 3. Manejador para el botón 'volverhome'
    const boton = document.getElementById('volverhome');
    if (boton) {
        boton.addEventListener('click', function() {
            window.location.href = "index.html"; 
        });
    } else {
        // Muestra un error útil en la consola si el botón no se encuentra.
        // Nota: Este botón no existe en el HTML que me pasaste, por lo que es normal que falle aquí.
        console.warn("Advertencia: El botón con ID 'volverhome' no se encontró en el HTML actual.");
    }
});
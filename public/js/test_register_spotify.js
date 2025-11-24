    const clientId = "bec926b86f644a3f976bddd2364f69d8"; 
    const redirectUri = "https://melodystream123.web.app/test_spotify.html";
    const scopes = "user-read-private user-read-email streaming user-read-playback-state user-modify-playback-state";


    document.getElementById("spotifyLogin").addEventListener("click", () => {
      const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}`;
      window.location.href = authUrl;
    });

    const botonlibreria = document.getElementById("musicLibrary");
    botonlibreria.addEventListener("click", function() {
        window.location.href = "musiclibrary.html";
    });
    //ola
    const boton = document.getElementById('volverhome');
    boton.addEventListener('click', function() {
        window.location.href = "index.html"; 
    });
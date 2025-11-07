
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    let accessToken = null;

    async function getToken() {
      if (!code) {
        document.getElementById("trackInfo").innerHTML = "<p>Code not found. Try to Login again</p>";
        return;
      }

      try {
        const res = await fetch(`https://us-central1-melodystream123.cloudfunctions.net/getSpotifyToken?code=${code}`);
        const data = await res.json();
        accessToken = data.access_token;
      } catch (err) {
        console.error(err);
        document.getElementById("trackInfo").innerHTML = "<p>Error getting the token.</p>";
      }
    }

    async function searchTrack() {
      const query = document.getElementById("searchInput").value.trim();
      if (!query) return alert("Type a song name");
      if (!accessToken) return alert("Token not aviable.");

      try {
        const res = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        const data = await res.json();
        const track = data.tracks?.items[0];
        if (!track) {
          document.getElementById("trackInfo").innerHTML = "<p>No songs found.</p>";
          return;
        }

        document.getElementById("trackInfo").innerHTML = `
          <h2>${track.name}</h2>
          <p>${track.artists[0].name}</p>
          <img src="${track.album.images[0].url}" width="150">
          ${track.preview_url ? `<audio controls src="${track.preview_url}"></audio>` : "<p>No preview aviable.</p>"}
        `;
      } catch (err) {
        console.error(err);
        document.getElementById("trackInfo").innerHTML = "<p>Error searching for the song.</p>";
      }
    }

    document.getElementById("searchBtn").addEventListener("click", searchTrack);

    // Llamar al backend al cargar
    getToken();

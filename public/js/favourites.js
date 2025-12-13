// favourites.js
import { getDatabase, ref, get, set, push } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

export async function saveFavouriteSong(userId, track) {
    const db = getDatabase();
    const songRef = ref(db, `canciones/${track.id}`);
    const favSongRef = ref(db, `users/${userId}/favoritos/${track.id}`);

    const favSongSnapshot = await get(favSongRef);
    if(favSongSnapshot.exists()){
      alert("This song is already in your favourites.");
      return;
    }

    // Add to the user favourites
    await set(favSongRef, true);

    const songSnapshot = await get(songRef);
    if (!songSnapshot.exists()) {

        const songData = {
          title: track.name,
          artist: track.artists.map(a => a.name).join(", "),
          album: track.album.name,
          albumImageUrl: track.album.images[0].url,
        };

      // Save the song data to the "canciones" node in Firebase
      console.log("Voy a guardar en canciones:", track.id, track);
      await set(songRef, songData);
    }

    console.log(`Song ${track.name} added to favorites for user ${userId}`);
}

export async function saveFavouriteArtist(userId, artist) {
    const db = getDatabase();
    const artistRef = ref(db, `artistas/${artist.id}`);
    const favArtistRef = ref(db, `users/${userId}/favourite_artists/${artist.id}`);

    console.log("Artista: ", artist);

    const favSnapshot = await get(favArtistRef);
    if (favSnapshot.exists()) {
      alert("This artist is already in your favourites.");
      return;
    } 

    // Add to the user favourites
    await set(favArtistRef, true);

    const artistSnapshot = await get(artistRef);
    if (!artistSnapshot.exists()) {

        const artistData = {
          name: artist.name,
          image: artist.images?.[0]?.url || "",
          followers: artist.followers.total,
          genres: artist.genres || []
      };

      // Save the song data to the "artistas" node in Firebase
      await set(artistRef, artistData);
    }

    console.log(`Artist ${artist.name} added to favorites for user ${userId}`);
}


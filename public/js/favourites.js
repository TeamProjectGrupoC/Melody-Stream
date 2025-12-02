// favourites.js
import { getDatabase, ref, get, set, push } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

/* -------------------------------------------------------------
   SAVE FAVOURITE SONG (idéntico al de profile.js)
----------------------------------------------------------------*/
export async function saveFavouriteSong(userId, track) {
  const db = getDatabase();
  const songRef = ref(db, `canciones/${track.id}`);
  const favSongRef = ref(db, `users/${userId}/favoritos/${track.id}`);

  const favSnapshot = await get(favSongRef);
  if (favSnapshot.exists()) {
    alert("This song is already in your favourites.");
    return;
  }

  const songData = {
    id: track.id,
    title: track.name,
    artist: track.artists.map(a => a.name).join(", "),
    album: track.album.name,
    albumImageUrl: track.album.images[0].url,
    previewUrl: track.preview_url
  };

  await set(songRef, songData);
  await set(favSongRef, songData);

  console.log(`Song ${track.name} added to favorites for user ${userId}`);
}


/* -------------------------------------------------------------
   SAVE FAVOURITE ARTIST (idéntico al de profile.js)
----------------------------------------------------------------*/
export async function saveFavouriteArtist(userId, artist) {
  const db = getDatabase();
  const favRef = ref(db, `users/${userId}/favourite_artists/`);

  // 1. Leer favoritos actuales
  const snapshot = await get(favRef);
  const data = snapshot.val() || {};

  // 2. Comprobar si ya existe por ID
  const alreadySaved = Object.values(data).some(a => a.id === artist.id);

  if (alreadySaved) {
    alert("This artist is already in your favourites.");
    return;
  }

  // 3. Guardar
  const newFav = push(favRef);
  return set(newFav, {
    id: artist.id,
    name: artist.name,
    image: artist.images?.[0]?.url || "",
    followers: artist.followers.total,
    genres: artist.genres
  });
}



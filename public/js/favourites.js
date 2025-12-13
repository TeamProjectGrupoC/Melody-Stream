// favourites.js

/**
 * ============================================================================
 * FAVOURITES MANAGER MODULE
 * ============================================================================
 * * IMPLEMENTATION OVERVIEW:
 * This module handles the backend logic for saving user preferences (Songs and Artists)
 * to the Firebase Realtime Database. It employs the next strategy:
 * 1. Global Collections: Full metadata is stored in central nodes (`canciones`, `artistas`).
 * 2. User References: User profiles only store the IDs (keys) of their favorites.
 * * This approach reduces data duplication
 * 
 * * 1. saveFavouriteSong(userId, track) [Async]
 * - Purpose: adds a track to the user's specific "favoritos" list.
 * - Duplicate Check: Verifies if the user already has this song to prevent overwrites.
 * - Global Storage Check: Checks if the song's metadata exists in the global `/canciones` node.
 * > If missing: Extracts relevant data (Title, Artist, Album, Image) from the 
 * `track` object and saves it globally.
 * - Linking: Updates the user's profile by setting the song ID to `true` at 
 * `users/{userId}/favoritos/{trackId}`.
 * * * 2. saveFavouriteArtist(userId, artist) [Async]
 * - Purpose: adds an artist to the user's specific "favourite_artists" list.
 * - Duplicate Check: Verifies if the artist is already in the user's favorites.
 * - Global Storage Check: Checks if the artist's metadata exists in the global `/artistas` node.
 * > If missing: Extracts relevant data (Name, Image, Followers, Genres) from the 
 * `artist` object and saves it globally.
 * - Linking: Updates the user's profile by setting the artist ID to `true` at 
 * `users/{userId}/favourite_artists/{artistId}`.
 * * ============================================================================
 */
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

    // Add to the user favourites
    await set(favSongRef, true);

    console.log(`Song ${track.name} added to favorites for user ${userId}`);
}

export async function saveFavouriteArtist(userId, artist) {
    const db = getDatabase();
    const artistRef = ref(db, `artistas/${artist.id}`);
    const favArtistRef = ref(db, `users/${userId}/favourite_artists/${artist.id}`);

    const favSnapshot = await get(favArtistRef);
    if (favSnapshot.exists()) {
      alert("This artist is already in your favourites.");
      return;
    } 

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
    
    // Add to the user favourites
    await set(favArtistRef, true);

    console.log(`Artist ${artist.name} added to favorites for user ${userId}`);
}


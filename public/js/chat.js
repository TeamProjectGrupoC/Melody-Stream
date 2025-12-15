import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getDatabase, ref, get, child, set, push, onValue, off, update, onChildAdded } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { saveFavouriteArtist, saveFavouriteSong } from "./favourites.js";

/*
DATABASE STRUCTURE AND LOGIC:

/users/{uid} 
    - Stores user profiles.
    - Each user can read the list of users.
    - Each user can write only their own profile (and only if email verified).

/chats/{chatId} 
    - Stores the actual chat conversation between two users.
    - chatId = combination of both user IDs (lexicographical order).
    - Fields:
        - createdAt: timestamp of when the chat was created.
        - users: { [uid]: true } → participants of the chat.
        - messages/{msgId}: 
            - Each message pushed into this node.
            - Fields:
                - sender: UID of the sender.
                - text: message content.
                - timestamp: when the message was sent.

/userChats/{uid}/{chatId} 
    - Stores chat summaries for each user to render chat list.
    - Fields:
        - lastMessage: object with
            - sender: UID of the last message sender.
            - text: last message content.
            - timestamp: timestamp of the last message.
    - Purpose: Used by the UI to show last message in the chat list and sort chats by recent activity.

LOGIC WHEN SENDING A MESSAGE:
1. Compute chatId using currentUser.uid and selectedUser.uid.
2. Push the new message under /chats/{chatId}/messages/{msgId}.
3. If chat does not exist, create /chats/{chatId} with createdAt and users.
4. Update /userChats/{currentUser.uid}/{chatId}/lastMessage and /userChats/{selectedUser}/{chatId}/lastMessage.
   - This ensures each user's chat list reflects the last message and ordering.
5. Clear the input box in the UI.
6. Messages are displayed in real-time via onValue listener on /chats/{chatId}/messages.
*/

/**
 * MAIN EXECUTION FLOW & FUNCTION SUMMARY:
 * * 1. CONFIGURATION & STATE
 * - Initializes Firebase (App, Database, Auth).
 * - Selects all necessary DOM elements.
 * - Declares global state variables (currentUser, selectedUser, Spotify tokens).
 * * 2. HELPER: getChatId(uid1, uid2)
 * - Generates a unique, consistent Chat ID by sorting user UIDs lexicographically.
 * * 3. SPOTIFY INTEGRATION
 * - isSpotifyTokenValid(token): Verifies if the stored access token is still valid via fetch.
 * - initSpotifyPlaybackSDK(): Injects the Spotify script, initializes the Player, and connects to the device.
 * - IIFE (Async): Checks localStorage for token/premium status and triggers SDK initialization if valid.
 * * 4. AUTHENTICATION LISTENER (onAuthStateChanged)
 * - Handles user login state.
 * - On login: Fetches the global list of users (`usersMap`).
 * - Sets up a real-time listener on `userChats/{uid}` to trigger `renderUserList`.
 * * 5. UI RENDERER: renderUserList(userChats)
 * - Filters out the current user.
 * - Calculates "Read/Unread" status based on the last message sender.
 * - Sorts users by `lastMessageTimestamp` (newest first).
 * - Renders the sidebar list, applying visual styles for unread messages.
 * * 6. EVENT: SELECT USER (userListDiv click)
 * - Highlights the selected user and marks the chat as "read" in the DB.
 * - Resets the chat view and attaches a listener (`onChildAdded`) to `chats/{chatId}/messages`.
 * - MESSAGE RENDERING LOGIC:
 * - Distinguishes between "You" vs "Other" styles.
 * - Handles Status Messages (✅/❌).
 * - Handles "Follow Requests" (Renders Accept/Reject buttons and updates DB).
 * - Handles Text Messages.
 * - Handles Attachments (Calls `buildAttachmentCard`).
 * * 7. DATA NORMALIZATION
 * - normalizeArtistForFavourites(artistId): Formats artist data from DB for the "Favourites" module.
 * - normalizeSongForFavourites(songId): Formats song data from DB for the "Favourites" module.
 * * 8. PLAYBACK CONTROL: playTrack(uri, playButton)
 * - Controls the Spotify Player state.
 * - Handles Play/Pause toggling and manages the specific button UI (Play vs Stop).
 * - Sends PUT requests to the Spotify Web API.
 * * 9. UI COMPONENT: buildAttachmentCard(att, senderId)
 * - dynamically creates the DOM for shared content (Songs/Podcasts).
 * - Renders images, titles, and authors.
 * - Adds "Play" buttons (HTML5 Audio for podcasts, Spotify SDK for songs).
 * - Adds "Add to Favourites" buttons (checks sender's favorites, normalizes data, calls `saveFavourite...`).
 * * 10. CORE LOGIC: sendMessage(fileAttachment)
 * - Constructs the message object (text, timestamp, optional attachment).
 * - Updates the central `chats` node (pushes message).
 * - Updates `userChats` for both participants (sets `lastMessage`, read status).
 * * 11. SEARCH & NAVIGATION
 * - Search Listener: Filters the rendered user list by username.
 * - Chat Header Click: Redirects to the selected user's profile page.
 */

async function main() {
        // Firebase configuration
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
    const db = getDatabase(app);
    const auth = getAuth(app);

    // --- DOM selectors ---
    const statusMessage = document.getElementById('statusMessage');
    const userListDiv = document.getElementById('userList');
    const searchInput = document.getElementById('searchInput');
    const chatPlaceholder = document.getElementById('chatPlaceholder');
    const chatBox = document.getElementById('chatBox');
    const chatWith = document.getElementById('chatWith');
    const messagesDiv = document.getElementById('messages');
    const messageInput = document.getElementById('msgInput');
    const sendButton = document.getElementById('sendBtn');

    // --- App state ---
    let currentUser = null;
    let selectedUser = null;
    let currentMessagesRef = null;
    let usersMap = {}; // cache all users

    // --- Helper: generate chatId ---
    function getChatId(uid1, uid2) {
        return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
    }

    // Para el reproductor de los chats
    let playerReady = false;
    let isPlaying = false;
    let token = null;
    let isPremium = false;
    let deviceId = null;
    let currentPlayingUri = null;
    let currentActivePlayButton = null;


    token = localStorage.getItem("spotify_access_token");
    isPremium = localStorage.getItem("spotify_is_premium") === "1";

    async function isSpotifyTokenValid(token) {
        if (!token) return false;

        const res = await fetch("https://api.spotify.com/v1/me", {
            headers: { "Authorization": "Bearer " + token }
        });

        return res.status === 200;
    }


    function initSpotifyPlaybackSDK() {
        const script = document.createElement("script");
        script.src = "https://sdk.scdn.co/spotify-player.js";
        document.body.appendChild(script);

        window.onSpotifyWebPlaybackSDKReady = () => {
            window.spotifyPlayer = new Spotify.Player({
                name: "MelodyStream Chat Player",
                getOAuthToken: (cb) => cb(token),
                volume: 0.8
            });

            spotifyPlayer.addListener("ready", ({ device_id }) => {
                console.log("Device ready:", device_id);
                deviceId = device_id;
                playerReady = true;
            });

            spotifyPlayer.connect();
        };
    }

    
    (async () => {
        if (token && isPremium && await isSpotifyTokenValid(token)) {
            console.log("Spotify token OK, PREMIUM — Loading Web Playback SDK...");
            initSpotifyPlaybackSDK();

        } else if(token && !isPremium && await isSpotifyTokenValid(token)){
            console.log("Spotify token OK, NO PREMIUM — Loading Web Playback SDK...");
            initSpotifyPlaybackSDK();
            
        } else {
            console.log("Spotify not available — token invalid.");
        }
    })();

    // --- Auth listener ---
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            statusMessage.textContent = "You must be logged in.";
            return;
        }
        currentUser = user;

        try {
            // Load all users for display
            const usersNode = await get(child(ref(db), "users"));
            if (usersNode.exists()) {
                usersMap = usersNode.val();
            } else {
                statusMessage.textContent = "No users found.";
                return;
            }

            // Listen only to the user's chats (userChats/{uid})
            const userChatsRef = ref(db, `userChats/${currentUser.uid}`);
            onValue(userChatsRef, (snapshot) => {
                const chatIds = snapshot.val() || {};
                renderUserList(chatIds);
            });

        } catch (e) {
            console.error(e);
            statusMessage.textContent = "Error loading users.";
        }
    });

    // --- Render user list based on userChats ---
    function renderUserList(userChats) {
    if (!currentUser || !usersMap) return;

    const usersToRender = [];

    for (const uid in usersMap) {
        if (uid === currentUser.uid) continue;
        const userData = usersMap[uid];
        const chatId = getChatId(currentUser.uid, uid);

        // Get chat data
        const chatData = userChats[chatId];
        const lastMessage = chatData?.lastMessage;
        const timestamp = lastMessage?.timestamp || 0;
        const lastMessageText = lastMessage?.text || "Click to start a conversation";

        // It is considered unread if: 
        // 1. chatData exists
        // 2. isRead property is explicitly false
        // 3. The last message was NOT sent by me
        const isRead = chatData?.isRead !== false; // Default to true if undefined
        const isMyMessage = lastMessage?.sender === currentUser.uid;
        const isUnread = !isRead && !isMyMessage;

        usersToRender.push({
            uid,
            username: userData.username || "(no username)",
            lastMessageTimestamp: timestamp,
            lastMessageText,
            isUnread: isUnread // Save this state
        });
    }

    // Sort by last message time
    usersToRender.sort((a, b) => b.lastMessageTimestamp - a.lastMessageTimestamp);

    // Render list
    userListDiv.innerHTML = "";
    const fragment = document.createDocumentFragment();
    
    usersToRender.forEach(user => {
        const li = document.createElement("li");
        li.className = "user";
        
        //APPLY CSS CLASS IF UNREAD 
        if (user.isUnread) {
            li.classList.add("unread");
        }

        li.dataset.uid = user.uid;
        li.dataset.username = user.username;

        const usernameSpan = document.createElement("span");
        usernameSpan.className = "username";
        usernameSpan.textContent = user.username;

        const lastMessageSpan = document.createElement("span");
        lastMessageSpan.className = "last-message";
        
        // Visual dot prefix
        const prefix = user.isUnread ? "• " : "";

        lastMessageSpan.textContent = prefix + (user.lastMessageText.length > 30
            ? user.lastMessageText.substring(0, 30) + "..."
            : user.lastMessageText);

        li.appendChild(usernameSpan);
        li.appendChild(lastMessageSpan);
        fragment.appendChild(li);
    });
    userListDiv.appendChild(fragment);
    statusMessage.style.display = 'none';
}
   // --- Select user ---
    userListDiv.addEventListener("click", (e) => {
        const userLi = e.target.closest(".user");
        if (!userLi) return;

        // 1. Visual change: remove unread class immediately
        userLi.classList.remove("unread");

        document.querySelectorAll('#userList .user.active').forEach(el => el.classList.remove('active'));
        userLi.classList.add('active');

        selectedUser = userLi.dataset.uid;
        const selectedUsername = userLi.dataset.username;
        const chatId = getChatId(currentUser.uid, selectedUser);

        // 2. Database update: Mark chat as read for the current user
        update(ref(db, `userChats/${currentUser.uid}/${chatId}`), {
            isRead: true
        });

        if (currentMessagesRef) off(currentMessagesRef);

        const messagesRef = ref(db, `chats/${chatId}/messages`);
        currentMessagesRef = messagesRef;

        chatPlaceholder.style.display = "none";
        chatBox.style.display = "flex";
        chatWith.textContent = selectedUsername;
        messagesDiv.innerHTML = "";

        onChildAdded(messagesRef, async (childSnap) => {
            const data = childSnap.val();
            const div = document.createElement("div");
            
            // 1. Basic initial configuration
            div.className = "message";
            if (data.sender === currentUser.uid) {
                div.classList.add("you");
            } else {
                div.classList.add("other");
            }

            // 2. Append the div to HTML IMMEDIATELY
            // This guarantees messages appear in the correct chronological order
            // even if the content (like a song) takes time to load via await.
            messagesDiv.appendChild(div);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;

            // --- FROM HERE WE FILL THE CONTENT ---

            // --- Detect STATUS messages (Accepted/Rejected) ---
            if (data.text && (data.text.startsWith("✅") || data.text.startsWith("❌"))) {
                div.classList.add("status-message");
                const p = document.createElement("p");
                p.textContent = data.text;
                div.appendChild(p);
                return; // Already added to DOM, just exit
            }

            // --- Detect Follow Request ---
            if (data.text === "📩 Sent a follow request" && data.sender !== currentUser.uid) {
                div.classList.add("follow-request-card");

                const title = document.createElement("h4");
                title.textContent = "Follow Request";
                div.appendChild(title);

                const p = document.createElement("p");
                p.textContent = `${usersMap[data.sender]?.username || "A user"} wants to follow you.`;
                div.appendChild(p);

                // --- DYNAMIC CONTAINER ---
                const actionContainer = document.createElement("div");
                actionContainer.className = "request-actions";
                div.appendChild(actionContainer);

                const requestRef = ref(db, `users/${currentUser.uid}/followRequests/${data.sender}`);
                const followerRef = ref(db, `users/${currentUser.uid}/followers/${data.sender}`);

                // Check status in DB
                Promise.all([get(requestRef), get(followerRef)]).then(([reqSnap, followSnap]) => {
                    // CASE 1: ALREADY FOLLOWING
                    if (followSnap.exists()) {
                        actionContainer.innerHTML = `<p style="color: #4CAF50; font-weight: bold; font-size: 0.9em;">✅ Request accepted</p>`;
                    } 
                    // CASE 2: REJECTED OR EXPIRED
                    else if (!reqSnap.exists()) {
                        actionContainer.innerHTML = `<p style="color: #F44336; font-weight: bold; font-size: 0.9em;">❌ Request rejected or expired</p>`;
                    } 
                    // CASE 3: PENDING
                    else {
                        const acceptBtn = document.createElement("button");
                        acceptBtn.textContent = "Accept";
                        acceptBtn.className = "btn-action btn-accept";

                        const rejectBtn = document.createElement("button");
                        rejectBtn.textContent = "Reject";
                        rejectBtn.className = "btn-action btn-reject";

                        actionContainer.appendChild(rejectBtn);
                        actionContainer.appendChild(acceptBtn);

                        acceptBtn.addEventListener("click", async () => {
                            // 1. Update DB
                            await set(ref(db, `users/${currentUser.uid}/followers/${data.sender}`), true);
                            await set(ref(db, `users/${currentUser.uid}/followRequests/${data.sender}`), null);
                            
                            // 2. Send confirmation message
                            const chatId = getChatId(currentUser.uid, data.sender);
                            const msgRef = ref(db, `chats/${chatId}/messages`);
                            const newMsgKey = push(msgRef).key;
                            
                            await set(ref(db, `chats/${chatId}/messages/${newMsgKey}`), {
                                sender: currentUser.uid,
                                text: "✅ Follow request accepted",
                                timestamp: Date.now()
                            });
                            
                            // 3. Update UI visually
                            actionContainer.innerHTML = `<p style="color: #4CAF50; font-weight: bold; font-size: 0.9em;">✅ Request accepted</p>`;
                        });

                        rejectBtn.addEventListener("click", async () => {
                            // 1. Update DB
                            await set(ref(db, `users/${currentUser.uid}/followRequests/${data.sender}`), null);
                            
                            // 2. Send rejection message
                            const chatId = getChatId(currentUser.uid, data.sender);
                            const msgRef = ref(db, `chats/${chatId}/messages`);
                            const newMsgKey = push(msgRef).key;
                            
                            await set(ref(db, `chats/${chatId}/messages/${newMsgKey}`), {
                                sender: currentUser.uid,
                                text: "❌ Follow request rejected",
                                timestamp: Date.now()
                            });

                            // 3. Update UI visually
                            actionContainer.innerHTML = `<p style="color: #F44336; font-weight: bold; font-size: 0.9em;">❌ Request rejected</p>`;
                        });
                    }
                });
                
                return; // Already in DOM
            }

            // --- Normal Rendering (Text) ---
            if (data.text) {
                const p = document.createElement("p");
                p.textContent = data.text;
                div.appendChild(p);
            }

            // --- Attachment Rendering (Songs) ---
            if (data.attachment) {
                const card = await buildAttachmentCard(data.attachment, data.sender);

                if (card instanceof Node) {
                    div.appendChild(card);
                    // Scroll again because the div height changed after loading the card
                    messagesDiv.scrollTop = messagesDiv.scrollHeight;
                } else {
                    console.warn("Attachment card is not a node:", card);
                }
            }
        });
    });

    let cachedUser = null;
        onAuthStateChanged(auth, (user) => {
            cachedUser = user;
    });

    async function normalizeArtistForFavourites(artistId) {
        const db = getDatabase();

        const snap = await get(ref(db, `artistas/${artistId}`));
        if (!snap.exists()) {
            alert(`Artist ${artistId} not found in /artistas`);
        }

        const a = snap.val();

        return {
            id: artistId,
            name: a.name || "",
            images: [{ url: a.image || "" }],
            followers: { total: a.followers ?? 0 },
            genres: a.genres || []
        };
        
    }

    async function normalizeSongForFavourites(songId) {
        const db = getDatabase();

        const snap = await get(ref(db, `canciones/${songId}`));
        if (!snap.exists()) {
            alert(`Artist ${songId} not found in /canciones`);
        }

        const s = snap.val();

        return {
            id: songId,
            name: s.title,
            artists: s.artist.split(", ").map(name => ({ name })),
            album: {
            name: s.album,
            images: [{ url: s.albumImageUrl }]
            }
        };
    }

    async function playTrack(uri, playButton) {

        if (!playerReady || !deviceId) {
            console.warn("Spotify player not ready yet.");
            return;
        }

        // ---  if you click in another song ---
        if (currentPlayingUri && currentPlayingUri !== uri) {

            // pause currently playing
            await fetch(
                `https://api.spotify.com/v1/me/player/pause?device_id=${deviceId}`,
                { method: "PUT", headers: { Authorization: `Bearer ${token}` } }
            );

            isPlaying = false;

            // reset previous button
            if (currentActivePlayButton) {
                currentActivePlayButton.textContent = "▶ Play";
            }
        }

        // --- click on the same song ---
        if (currentPlayingUri === uri && isPlaying) {
            // then pause
            await fetch(
                `https://api.spotify.com/v1/me/player/pause?device_id=${deviceId}`,
                { method: "PUT", headers: { Authorization: `Bearer ${token}` } }
            );

            isPlaying = false;

            // update button
            playButton.textContent = "▶ Play";
            return;
        }

        // --- start playing ---
        await fetch(
            `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
            {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ uris: [uri] })
            }
        );

        console.log("Playing:", uri);

        //uodate state
        currentPlayingUri = uri;
        isPlaying = true;
        playButton.textContent = "⏹ Stop";
        currentActivePlayButton = playButton;
    }

    async function buildAttachmentCard(att, senderId) {

        if (!att || !att.imageURL) {
            const empty = document.createElement("p");
            empty.textContent = "[Attachment vacío]";
            empty.style.fontStyle = "italic";
            return empty;
        }

        const card = document.createElement("div");
        card.className = "attachment-card";

        // Logic to know who wheter i am the receptor or the sender
        const isMine = senderId === cachedUser.uid;

        // Image
        const img = document.createElement("img");
        img.src = att.imageURL;
        img.className = "attachment-image";
        card.appendChild(img);

        // Text
        const meta = document.createElement("div");
        meta.className = "attachment-meta";

        const title = document.createElement("h4");
        title.textContent = att.title;
        meta.appendChild(title);

        if (att.author) {
            const author = document.createElement("p");
            author.textContent = att.author;
            meta.appendChild(author);
        }

        const isSong = att.audioURL && att.audioURL !== "";
        const isPodcast = att.type === "podcast" || (att.audioURL && !att.id);

        // Podcast rendering
        if (isPodcast) {
            // Create the play/stop button
            const playBtn = document.createElement("button");
            playBtn.textContent = "▶ Play Podcast";
            playBtn.className = "main-button";
            playBtn.style.marginTop = "10px";
            playBtn.style.width = "100%"; // optional: make button full width of the card

            // Create a hidden audio element
            const audioEl = document.createElement("audio");
            audioEl.src = att.audioURL;
            audioEl.preload = "metadata"; // enough to load duration
            audioEl.style.display = "none"; // hide the default audio controls

            card.appendChild(audioEl); // append to DOM even though it's hidden

            let isPlaying = false;

            // Button click toggles play/pause
            playBtn.addEventListener("click", () => {
                if (!isPlaying) {
                    audioEl.play(); // start playing
                    playBtn.textContent = "⏹ Stop Podcast"; // update button text
                    isPlaying = true;
                } else {
                    audioEl.pause(); // pause playback
                    audioEl.currentTime = 0; // reset to start
                    playBtn.textContent = "▶ Play Podcast"; // revert button text
                    isPlaying = false;
                }
            });

            meta.appendChild(playBtn); // add button to the card metadata
        }


       if (isSong && !isPodcast) {

            // Validate token
            const tokenValid = token && await isSpotifyTokenValid(token);

            // No token → show "Connect Spotify" button
            if (!tokenValid) {
                const reconnectBtn = document.createElement("button");
                reconnectBtn.textContent = "Connect Spotify";
                reconnectBtn.className = "main-button";
                reconnectBtn.style.marginTop = "10px";

                reconnectBtn.addEventListener("click", () => {
                    window.location.href = "test_register_spotify.html";
                });

                meta.appendChild(reconnectBtn);
            }

            // Token is valid but user is NOT premium → show info message
            else if (!isPremium) {
                const info = document.createElement("p");
                info.textContent = "Playback not available";
                info.style.marginTop = "8px";
                info.style.fontStyle = "italic";
                info.style.color = "#aaa";

                meta.appendChild(info);
            }

            // Token valid AND user is premium → show Play button
            else {
                const playBtn = document.createElement("button");
                playBtn.textContent = "▶ Play";
                playBtn.className = "main-button";
                playBtn.style.marginTop = "10px";

                playBtn.addEventListener("click", async () => {
                    try {
                        const res = await fetch(`https://api.spotify.com/v1/tracks/${att.id}`, {
                            headers: { Authorization: `Bearer ${token}` }
                        });

                        const track = await res.json();
                        if (!track || !track.uri) return;
                        playTrack(track.uri, playBtn);

                    } catch (err) {
                        console.error("Error playing track:", err);
                    }
                });


                meta.appendChild(playBtn);
            }
        }




        if (!isMine) {
            // Add artist to favourites
            if (att.author === "Favourite Artist") {
                const btn = document.createElement("button");
                btn.textContent = "Add to favourite artists";
                btn.style.marginTop = "10px";
                btn.className = "main-button";

                btn.addEventListener("click", async () => {
                    try {
                        const user = auth.currentUser;
                        if (!user) return alert("You must log in");

                        // 1. BUSCAR EL ARTISTA 
                        const senderFavRef = ref(db, `artistas`);
                        const favSnap = await get(senderFavRef);
                        const data = favSnap.val() || {};

                        let foundArtist = null;

                        for (const key in data) {
                            if (key === att.id) {
                                foundArtist = key;
                                break;
                            }
                        }

                        if (!foundArtist) {
                            alert("The sender does not have this artist saved in favourites.");
                            return;
                        }

                        // 2.  call favourites.js 
                        const normalized = await normalizeArtistForFavourites(foundArtist);
                        await saveFavouriteArtist(user.uid, normalized);


                        alert("Artist added to favourites!");

                    } catch (err) {
                        console.error(err);
                        alert("Error saving artist");
                    }

                });

                meta.appendChild(btn);
            }

            // Add song to favourites
            if (isSong && !isPodcast) {
                const btnSong = document.createElement("button");
                btnSong.textContent = "Add to favourite songs";
                btnSong.className = "main-button";
                btnSong.style.marginTop = "10px";

                btnSong.addEventListener("click", async () => {
                    try {
                        const user = auth.currentUser;
                        if (!user) return alert("You must log in");

                        // search in the favs of thse sender
                        const senderFavRef = ref(db, `users/${senderId}/favoritos`);
                        const favSnap = await get(senderFavRef);
                        const data = favSnap.val() || {};

                        let foundSong = null;

                        for (const key in data) {
                            if (key === att.id) {
                                foundSong = key;
                                break;
                            }
                        }

                        if (!foundSong) {
                            alert("The sender does not have this song saved in favourites.");
                            return;
                        }

                        const normalized = await normalizeSongForFavourites(foundSong);
                        await saveFavouriteSong(user.uid, normalized);


                        alert("Song added to favourites!");

                    } catch (err) {
                        console.error(err);
                        alert("Error saving song");
                    }
                });

                meta.appendChild(btnSong);
            }
        }
        

        card.appendChild(meta);

        return card;
    }


    // --- Send message ---
    const sendMessage = async (fileAttachment = null) => {
        const text = messageInput.value.trim();
        if ((!text && !fileAttachment) || !selectedUser || !currentUser) return;

        const chatId = getChatId(currentUser.uid, selectedUser);
        const messagesRef = ref(db, `chats/${chatId}/messages`);
        const chatRef = ref(db, `chats/${chatId}`);

        const newTimestamp = Date.now();

        const newMessage = {
            sender: currentUser.uid,
            text,
            timestamp: newTimestamp
        };

        if (fileAttachment) {
            newMessage.attachment = fileAttachment.audioURL && fileAttachment.audioURL !== ""
                ? fileAttachment
                : {
                    title: fileAttachment.title,
                    imageURL: fileAttachment.imageURL,
                    author: fileAttachment.author
                };
        }


        const lastMessageData = {
            sender: currentUser.uid,
            text: fileAttachment ? `[Shared] ${fileAttachment.title}` : text,
            timestamp: newTimestamp,
        };

        try {
            const newMessageKey = push(messagesRef).key;
            await update(chatRef, {
                [`messages/${newMessageKey}`]: newMessage,
                createdAt: newTimestamp,
                users: {
                    [currentUser.uid]: true,
                    [selectedUser]: true
                }
            });

            await update(ref(db, `userChats/${currentUser.uid}/${chatId}`), {
                lastMessage: lastMessageData,
                isRead: true 
            });

            await update(ref(db, `userChats/${selectedUser}/${chatId}`), {
                lastMessage: lastMessageData,
                isRead: false 
            });
            messageInput.value = "";

        } catch (e) {
            console.error("Error sending message:", e);
        }
    };

    sendButton.addEventListener("click", () => sendMessage());
    messageInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.keyCode === 13) {
            e.preventDefault();
            sendMessage();
        }
    });



    // --- Search ---
    searchInput.addEventListener('keyup', () => {
        const filterText = searchInput.value.toLowerCase();
        const users = document.querySelectorAll('#userList .user');
        users.forEach(user => {
            const username = user.dataset.username.toLowerCase();
            user.style.display = username.includes(filterText) ? "" : "none";
        });
    });

    // --- Click in name : go to viewprofile ---
    chatWith.addEventListener("click", () => {
        if (!selectedUser) return;
        window.location.href = `viewprofile.html?uid=${selectedUser}`;
    });

}

main();

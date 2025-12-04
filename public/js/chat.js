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
            div.className = "message";

            if (data.sender === currentUser.uid) {
                div.classList.add("you");
            } else {
                div.classList.add("other");
            }

            // --- Detect STATUS messages (Accepted/Rejected) ---
            if (data.text.startsWith("✅") || data.text.startsWith("❌")) {
                div.classList.add("status-message");
                const p = document.createElement("p");
                p.textContent = data.text;
                div.appendChild(p);
                messagesDiv.appendChild(div);
                messagesDiv.scrollTop = messagesDiv.scrollHeight;
                return;
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

                const btnContainer = document.createElement("div");
                btnContainer.className = "request-actions";

                const acceptBtn = document.createElement("button");
                acceptBtn.textContent = "Accept";
                acceptBtn.className = "btn-action btn-accept";

                const rejectBtn = document.createElement("button");
                rejectBtn.textContent = "Reject";
                rejectBtn.className = "btn-action btn-reject";

                btnContainer.appendChild(rejectBtn);
                btnContainer.appendChild(acceptBtn);
                div.appendChild(btnContainer);

                // --- Event Listeners for Buttons ---
                acceptBtn.addEventListener("click", async () => {
                    await set(ref(db, `users/${currentUser.uid}/followers/${data.sender}`), true);
                    await set(ref(db, `users/${currentUser.uid}/followRequests/${data.sender}`), null);

                    const chatId = getChatId(currentUser.uid, data.sender);
                    const msgRef = ref(db, `chats/${chatId}/messages`);
                    const newMsgKey = push(msgRef).key;

                    await set(ref(db, `chats/${chatId}/messages/${newMsgKey}`), {
                        sender: currentUser.uid,
                        text: "✅ Follow request accepted",
                        timestamp: Date.now()
                    });

                    div.remove();
                });

                rejectBtn.addEventListener("click", async () => {
                    await set(ref(db, `users/${currentUser.uid}/followRequests/${data.sender}`), null);

                    const chatId = getChatId(currentUser.uid, data.sender);
                    const msgRef = ref(db, `chats/${chatId}/messages`);
                    const newMsgKey = push(msgRef).key;

                    await set(ref(db, `chats/${chatId}/messages/${newMsgKey}`), {
                        sender: currentUser.uid,
                        text: "❌ Follow request rejected",
                        timestamp: Date.now()
                    });
                    div.remove();
                });

                messagesDiv.appendChild(div);
                messagesDiv.scrollTop = messagesDiv.scrollHeight;
                return;
            }

            // --- Normal message rendering ---
            if (data.text) {
                const p = document.createElement("p");
                p.textContent = data.text;
                div.appendChild(p);
            }

            if (data.attachment) {
                const card = buildAttachmentCard(data.attachment, data.sender);
                div.appendChild(card);
            }

            messagesDiv.appendChild(div);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        });
    });

    function isMusicAttachment(att) {
        return att &&
            typeof att.title === "string" &&
            typeof att.imageURL === "string" &&
            typeof att.author === "string";
    }

    let cachedUser = null;
        onAuthStateChanged(auth, (user) => {
            cachedUser = user;
    });

    function normalizeArtistForFavourites(artist, att) {
        return {
            id: artist.id,
            name: artist.name,
            images: [
                { url: artist.image || att.imageURL }
            ],
            followers: {
                total: artist.followers || 0
            },
            genres: Array.isArray(artist.genres) ? artist.genres : []
        };
    }

    function normalizeSongForFavourites(song, att) {
        return {
            id: song.id,
            name: song.title,
            artists: [
                { name: song.artist || att.author || "Unknown Artist" }
            ],
            album: {
                name: song.album || "Unknown Album",
                images: [
                    { url: song.albumImageUrl || att.imageURL }
                ]
            }
        };
    }

    // Recupera el track real de Spotify a partir del attachment del chat
    async function fetchSpotifyTrackForAttachment(att) {
        const token = localStorage.getItem("spotify_access_token");
        if (!token) {
            console.warn("No Spotify token available in localStorage");
            return null;
        }

        // Si ya tenemos un id válido, usamos /v1/tracks/{id}
        if (att.id && att.id !== "undefined") {
            try {
                const res = await fetch(`https://api.spotify.com/v1/tracks/${att.id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (!res.ok) {
                    console.error("Error fetching track by id:", await res.text());
                    return null;
                }
                const track = await res.json();
                return track;
            } catch (err) {
                console.error("Error calling Spotify /tracks/{id}:", err);
                return null;
            }
        }

        // Si no tenemos id, buscamos por título + autor
        const qParts = [];
        if (att.title) qParts.push(att.title);
        if (att.author) qParts.push(att.author);
        const query = qParts.join(" ");

        if (!query) {
            console.warn("No data to search track on Spotify");
            return null;
        }

        try {
            const res = await fetch(
                `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`,
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            if (!res.ok) {
                console.error("Error searching track on Spotify:", await res.text());
                return null;
            }
            const data = await res.json();
            const spTrack = data.tracks?.items?.[0];
            if (!spTrack) {
                console.warn("No Spotify track found for query:", query);
                return null;
            }
            return spTrack;
        } catch (err) {
            console.error("Error calling Spotify search API:", err);
            return null;
        }
    }


    function buildAttachmentCard(att, senderId) {

        if (!att || !att.imageURL) {
            console.warn("⚠ Attachment inválido:", att);
            return document.createTextNode("[Attachment vacío]");
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
        } else {
            
            const token = localStorage.getItem("spotify_access_token");
            const isPremium = localStorage.getItem("spotify_is_premium") === "1";

            // Si no hay token o no es premium → NO PREVIEW AVAILABLE (sin avisos)
            if (!token || !isPremium) {
                const noPrev = document.createElement("p");
                noPrev.textContent = "NO PREVIEW AVAILABLE";
                noPrev.style.marginTop = "8px";
                noPrev.style.fontStyle = "italic";
                noPrev.style.color = "#aaa";
                meta.appendChild(noPrev);
            } else {
                // Hay token y es premium → botón Play que recupera el track de Spotify
                const playBtn = document.createElement("button");
                playBtn.textContent = "▶ Play on Spotify";
                playBtn.className = "main-button";
                playBtn.style.marginTop = "10px";

                playBtn.addEventListener("click", async () => {
                    try {
                        // Recuperar track real de Spotify
                        const spTrack = await fetchSpotifyTrackForAttachment(att);
                        if (!spTrack || !spTrack.uri) {
                            console.warn("Spotify track not found or missing uri", spTrack);
                            alert("Could not find this track on Spotify.");
                            return;
                        }

                        if (typeof window.playTrack !== "function") {
                            alert("Spotify player not ready. Open the Spotify page first.");
                            return;
                        }

                        // Usar la función de test_spotify.js
                        window.playTrack(spTrack.uri);

                    } catch (err) {
                        console.error("Error playing track from chat:", err);
                        alert("Error playing this song.");
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

                        // 1. BUSCAR EL ARTISTA ENTRE LOS FAVORITOS DEL SENDER
                        const senderFavRef = ref(db, `users/${senderId}/favourite_artists`);
                        const favSnap = await get(senderFavRef);
                        const data = favSnap.val() || {};

                        let foundArtist = null;

                        for (const key in data) {
                            if (data[key].name?.toLowerCase() === att.title.toLowerCase()) {
                                foundArtist = data[key];
                                break;
                            }
                        }

                        if (!foundArtist) {
                            alert("The sender does not have this artist saved in favourites.");
                            return;
                        }

                        // 2. Llamar a favourites.js (misma función que usa profile.js)
                        const normalized = normalizeArtistForFavourites(foundArtist, att);
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
            const isSong = att.audioURL && att.audioURL !== "";
            if (isSong) {
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

                        let foundKey = null;
                        let foundSong = null;

                        console.log("ATTACHMENT TITLE:", att.title);
                        console.log("CANCIONES DEL SENDER:");
                        console.log(data);

                        for (const key in data) {
                            if (data[key].title?.toLowerCase() === att.title.toLowerCase()) {
                                foundKey = key;
                                foundSong = data[key];
                                break;
                            }
                        }

                        if (!foundSong) {
                            alert("The sender does not have this song saved in favourites.");
                            return;
                        }

                        foundSong.id = foundKey;

                        const normalized = normalizeSongForFavourites(foundSong, att);
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

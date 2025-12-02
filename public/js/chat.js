import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getDatabase, ref, get, child, set, push, onValue, off, update, onChildAdded } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { saveFavouriteSong, saveFavouriteArtist } from "./profile.js";
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

    // --- Load Firebase config ---
    let firebaseConfig;
    try {
        const response = await fetch('/__/firebase/init.json');
        firebaseConfig = await response.json();
    } catch (e) {
        console.error("Could not load Firebase config.", e);
        return;
    }

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getDatabase(app);

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

            const lastMessage = userChats[chatId]?.lastMessage;
            const timestamp = lastMessage?.timestamp || 0;
            const lastMessageText = lastMessage?.text || "Click to start a conversation";

            usersToRender.push({
                uid,
                username: userData.username || "(no username)",
                lastMessageTimestamp: timestamp,
                lastMessageText
            });
        }

        // Sort by last message
        usersToRender.sort((a, b) => b.lastMessageTimestamp - a.lastMessageTimestamp);

        // Render
        userListDiv.innerHTML = "";
        const fragment = document.createDocumentFragment();
        usersToRender.forEach(user => {
            const li = document.createElement("li");
            li.className = "user";
            li.dataset.uid = user.uid;
            li.dataset.username = user.username;

            const usernameSpan = document.createElement("span");
            usernameSpan.className = "username";
            usernameSpan.textContent = user.username;

            const lastMessageSpan = document.createElement("span");
            lastMessageSpan.className = "last-message";
            lastMessageSpan.textContent = user.lastMessageText.length > 30
                ? user.lastMessageText.substring(0, 30) + "..."
                : user.lastMessageText;

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

        document.querySelectorAll('#userList .user.active').forEach(el => el.classList.remove('active'));
        userLi.classList.add('active');

        selectedUser = userLi.dataset.uid;
        const selectedUsername = userLi.dataset.username;
        const chatId = getChatId(currentUser.uid, selectedUser);

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

            // --- Detect follow request message ---
            // --- 1. Detect STATUS messages (Accepted/Rejected) ---
            // If the text starts with confirmation emojis, we style it as a system notification
            if (data.text.startsWith("✅") || data.text.startsWith("❌")) {
                div.classList.add("status-message"); // Special class to center it and remove bubble background
                const p = document.createElement("p");
                p.textContent = data.text;
                div.appendChild(p);
                messagesDiv.appendChild(div);
                messagesDiv.scrollTop = messagesDiv.scrollHeight;
                return;
            }

            // --- 2. Detect Follow Request ---
            if (data.text === "📩 Sent a follow request" && data.sender !== currentUser.uid) {
                // Add a special container class for styling
                div.classList.add("follow-request-card");

                const title = document.createElement("h4");
                title.textContent = "Follow Request";
                div.appendChild(title);

                const p = document.createElement("p");
                // Safe access to username
                p.textContent = `${usersMap[data.sender]?.username || "A user"} wants to follow you.`;
                div.appendChild(p);

                // Container for buttons (for flexbox layout)
                const btnContainer = document.createElement("div");
                btnContainer.className = "request-actions";

                const acceptBtn = document.createElement("button");
                acceptBtn.textContent = "Accept";
                acceptBtn.className = "btn-action btn-accept"; // Added CSS classes

                const rejectBtn = document.createElement("button");
                rejectBtn.textContent = "Reject";
                rejectBtn.className = "btn-action btn-reject"; // Added CSS classes

                btnContainer.appendChild(rejectBtn);
                btnContainer.appendChild(acceptBtn);
                div.appendChild(btnContainer);

                // --- Event Listeners ---
                acceptBtn.addEventListener("click", async () => {
                    // Database updates
                    await set(ref(db, `users/${currentUser.uid}/followers/${data.sender}`), true);
                    await set(ref(db, `users/${currentUser.uid}/followRequests/${data.sender}`), null);

                    // Send confirmation message to chat
                    const chatId = getChatId(currentUser.uid, data.sender);
                    const messagesRef = ref(db, `chats/${chatId}/messages`);
                    const newMsgKey = push(messagesRef).key;

                    // Note: Sending with "✅" triggers the styling in block #1 above
                    await set(ref(db, `chats/${chatId}/messages/${newMsgKey}`), {
                        sender: currentUser.uid,
                        text: "✅ Follow request accepted",
                        timestamp: Date.now()
                    });

                    div.remove(); // Optional: Remove the request card after answering
                });

                rejectBtn.addEventListener("click", async () => {
                    await set(ref(db, `users/${currentUser.uid}/followRequests/${data.sender}`), null);

                    const chatId = getChatId(currentUser.uid, data.sender);
                    const messagesRef = ref(db, `chats/${chatId}/messages`);
                    const newMsgKey = push(messagesRef).key;

                    // Note: Sending with "❌" triggers the styling in block #1 above
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
        }

        // Reproduce songs
        const isSong = att.audioURL && att.audioURL !== "";
        if (isSong) {
            const audio = document.createElement('audio');
            audio.controls = true;
            audio.src = att.audioURL;
            meta.appendChild(audio);
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

                        const artistObj = {
                            id: att.id,
                            name: att.title,
                            image: att.imageURL,
                            followers: 0,
                            genres: []
                        };

                        await saveFavouriteArtist(user.uid, artistObj);
                        alert("Artist added to favourites!");

                    } catch (err) {
                        console.error("🔥 ERROR saving artist (full error):", err);
                        console.error("🔥 Error name:", err?.name);
                        console.error("🔥 Error code:", err?.code);
                        console.error("🔥 Error message:", err?.message);
                        console.error("🔥 Error stack:", err?.stack);

                        alert(
                            "Error saving artist:\n" +
                            "name: " + (err?.name || "n/a") + "\n" +
                            "code: " + (err?.code || "n/a") + "\n" +
                            "message: " + (err?.message || "n/a")
                        );
                    }

                });

                meta.appendChild(btn);
            }

            // Add song to favourites
            if (isSong) {
                const btnSong = document.createElement("button");
                btnSong.textContent = "Add to favourite songs";
                btnSong.className = "main-button";
                btnSong.style.marginTop = "10px";

                btnSong.addEventListener("click", async () => {
                    try {
                        const user = auth.currentUser;
                        if (!user) return alert("You must log in");

                        const trackObj = {
                            id: att.id,
                            name: att.title,
                            artists: att.author.split(", ").map(a => ({ name: a })),
                            album: {
                                name: "Unknown album",
                                images: [ { url: att.imageURL } ]
                            },
                            preview_url: att.audioURL
                        };

                        await saveFavouriteSong(user.uid, trackObj);
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
                lastMessage: lastMessageData
            });

            await update(ref(db, `userChats/${selectedUser}/${chatId}`), {
                lastMessage: lastMessageData
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

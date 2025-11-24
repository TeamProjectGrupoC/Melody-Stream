import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
    getDatabase, ref, get, child, set, push, onValue, off, update
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

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

        // Listen to messages
        onValue(messagesRef, (snapshot) => {
            messagesDiv.innerHTML = "";
            if (!snapshot.exists()) return;
            snapshot.forEach(childSnap => {
                const data = childSnap.val();
                const div = document.createElement("div");
                div.classList.add("message");
                div.classList.add(data.sender === currentUser.uid ? "you" : "other");

                if (data.attachment) {
                    // Render rich attachment card
                    const card = document.createElement('div');
                    card.className = 'attachment-card';

                    const img = document.createElement('img');
                    img.src = data.attachment.imageURL || 'images/logos/logo.png';
                    img.alt = data.attachment.title || 'shared';
                    img.style.width = '80px';
                    img.style.height = '80px';
                    img.style.objectFit = 'cover';
                    img.style.marginRight = '10px';

                    const meta = document.createElement('div');
                    meta.className = 'attachment-meta';

                    const title = document.createElement('div');
                    title.className = 'attachment-title';
                    title.textContent = data.attachment.title || 'Untitled';

                    const author = document.createElement('div');
                    author.className = 'attachment-author';
                    author.textContent = data.attachment.author || '';

                    meta.appendChild(title);
                    meta.appendChild(author);

                    if (data.attachment.audioURL) {
                        const audio = document.createElement('audio');
                        audio.controls = true;
                        audio.src = data.attachment.audioURL;
                        audio.style.width = '100%';
                        meta.appendChild(audio);
                    }

                    card.appendChild(img);
                    card.appendChild(meta);

                    if (data.text) {
                        const textDiv = document.createElement('div');
                        textDiv.className = 'message-text';
                        textDiv.textContent = data.text;
                        card.appendChild(textDiv);
                    }

                    div.appendChild(card);
                } else {
                    // simple text message
                    div.textContent = data.text || '';
                }

                messagesDiv.appendChild(div);
            });
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        });
    });

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
            newMessage.attachment = fileAttachment;
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

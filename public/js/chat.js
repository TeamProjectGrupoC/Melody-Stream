import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
// No necesitamos 'query' ni 'orderByChild' en esta versión
import { getDatabase, ref, get, child, set, push, onValue, off, update } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

async function main() {
    
    let firebaseConfig;
    try {
        const response = await fetch('/__/firebase/init.json');
        firebaseConfig = await response.json();
    } catch (e) {
        console.error("Could not load Firebase config. Are you running this on Firebase Hosting or using 'firebase serve'?");
        return;
    }
    
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getDatabase(app);

    // --- DOM Selectors ---
    const statusMessage = document.getElementById('statusMessage');
    const userListDiv = document.getElementById('userList');
    const searchInput = document.getElementById('searchInput');
    const chatPlaceholder = document.getElementById('chatPlaceholder');
    const chatBox = document.getElementById('chatBox');
    const chatWith = document.getElementById('chatWith');
    const messagesDiv = document.getElementById('messages');
    const messageInput = document.getElementById('msgInput');
    const sendButton = document.getElementById('sendBtn');

    // --- App State ---
    let currentUser = null;
    let selectedUser = null;
    let currentMessagesRef = null; 
    let usersMap = {}; // Caches all user data locally

    function getChatId(uid1, uid2) {
        return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
    }

    // --- Main Logic ---
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            statusMessage.textContent = "You must be logged in.";
            return;
        }
        currentUser = user;

        try {
            // 1. Fetch and cache all user data
            const usersNode = await get(child(ref(db), "users"));
            if (usersNode.exists()) {
                usersMap = usersNode.val();
            } else {
                statusMessage.textContent = "No users found.";
                return;
            }

            // 2. ▼▼ ESTA ES LA LÓGICA ANTIGUA ▼▼
            // Escucha TODOS los chats
            const chatsRef = ref(db, 'chats');
            onValue(chatsRef, (snapshot) => {
                const allChats = snapshot.val() || {};
                renderUserList(allChats); // Renderiza usando la lista completa
            });

        } catch (e) {
            console.error(e);
            statusMessage.textContent = "Error loading users.";
        }
    });

    /**
     * Renders the user list (usando allChats)
     */
    function renderUserList(allChats) {
        if (!currentUser || !usersMap) return; 

        let usersToRender = [];
        
        // 1. Itera sobre TODOS los usuarios (de usersMap)
        for (const uid in usersMap) {
            if (uid === currentUser.uid) continue;

            const userData = usersMap[uid];
            const chatId = getChatId(currentUser.uid, uid);
            
            // 2. Comprueba si existe un chat en la lista 'allChats'
            const chatData = allChats[chatId]; 
            const lastMessage = chatData?.lastMessage;

            let timestamp;
            let lastMessageText;

            if (lastMessage) {
                timestamp = lastMessage.timestamp;
                lastMessageText = lastMessage.text || "No messages yet";
            } else {
                // Es un chat nuevo sin mensajes
                timestamp = 0; 
                lastMessageText = "Click to start a conversation";
            }

            usersToRender.push({
                uid: uid,
                username: userData.username || "(no username)",
                email: userData.email,
                lastMessageTimestamp: timestamp,
                lastMessageText: lastMessageText
            });
        }

        // 3. Ordena en el cliente
        usersToRender.sort((a, b) => b.lastMessageTimestamp - a.lastMessageTimestamp);

        // 4. Renderiza en el DOM
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
            
            const text = user.lastMessageText;
            lastMessageSpan.textContent = text.length > 30 ? text.substring(0, 30) + "..." : text;

            li.appendChild(usernameSpan);
            li.appendChild(lastMessageSpan);
            fragment.appendChild(li);
        });

        userListDiv.appendChild(fragment);
        statusMessage.style.display = 'none'; 
    }

    // Listener para seleccionar un usuario
    userListDiv.addEventListener("click", (e) => { // No necesita 'async'
        const userLi = e.target.closest(".user");
        if (!userLi) return;

        document.querySelectorAll('#userList .user.active').forEach(el => {
            el.classList.remove('active');
        });
        userLi.classList.add('active');

        selectedUser = userLi.dataset.uid;
        const selectedUsername = userLi.dataset.username;
        const chatId = getChatId(currentUser.uid, selectedUser);
        
        if (currentMessagesRef) {
            off(currentMessagesRef); 
        }

        const messagesRef = ref(db, `chats/${chatId}/messages`);
        currentMessagesRef = messagesRef; 

        chatPlaceholder.style.display = "none";
        chatBox.style.display = "flex";
        chatWith.textContent = selectedUsername;
        messagesDiv.innerHTML = ""; 

        // Listener que carga todo el historial de mensajes
        onValue(messagesRef, (snapshot) => {
            messagesDiv.innerHTML = ""; 
            if (!snapshot.exists()) return; 

            snapshot.forEach((childSnap) => {
                const data = childSnap.val();
                const div = document.createElement("div");
                div.classList.add("message");
                div.textContent = data.text; 
                div.classList.add(data.sender === currentUser.uid ? "you" : "other");
                messagesDiv.appendChild(div);
            });
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        });
    });

    // --- Message Sending Logic (Versión ANTIGUA, sin "buzones") ---
    const sendMessage = async () => {
        const text = messageInput.value.trim();
        if (!text || !selectedUser || !currentUser) return;

        const chatId = getChatId(currentUser.uid, selectedUser);
        const messagesRef = ref(db, `chats/${chatId}/messages`);
        const chatRef = ref(db, `chats/${chatId}`); // Referencia a la raíz del chat
        const newTimestamp = Date.now();

        const newMessage = {
            sender: currentUser.uid,
            text: text,
            timestamp: newTimestamp
        };

        const lastMessageData = {
            text: text,
            sender: currentUser.uid,
            timestamp: newTimestamp
        };

        // Solo actualiza el chat, no los "buzones"
        const updates = {};
        const newMessageKey = push(messagesRef).key;
        updates[`chats/${chatId}/messages/${newMessageKey}`] = newMessage;
        updates[`chats/${chatId}/lastMessage`] = lastMessageData;

        try {
            await update(ref(db), updates);
            messageInput.value = ""; 
        } catch (e) {
            console.error("Error sending message:", e);
        }
    };

    // --- Event Listeners ---
    sendButton.addEventListener("click", sendMessage);
    messageInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.keyCode === 13) {
            e.preventDefault(); 
            sendMessage();
        }
    });

    // --- Search Logic ---
    searchInput.addEventListener('keyup', () => {
        const filterText = searchInput.value.toLowerCase();
        const users = document.querySelectorAll('#userList .user');
        
        users.forEach(user => {
            const username = user.dataset.username.toLowerCase();
            if (username.includes(filterText)) {
                user.style.display = "";
            } else {
                user.style.display = "none";
            }
        });
    });
}

main();
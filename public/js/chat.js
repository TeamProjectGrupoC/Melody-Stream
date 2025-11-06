import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
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

    // --- DOM Selectors (Nuevos y actualizados) ---
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
    let usersMap = {}; // Almacenará los datos de todos los usuarios (uid -> userData)

    function getChatId(uid1, uid2) {
        return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
    }

    // --- Main Logic ---
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            statusMessage.textContent = "You must be logged in.";
            // Opcional: redirigir a login
            // window.location.href = '/login.html'; 
            return;
        }
        currentUser = user;

        try {
            // 1. Obtener todos los usuarios UNA VEZ y guardarlos en el Map
            const usersNode = await get(child(ref(db), "users"));
            if (usersNode.exists()) {
                usersMap = usersNode.val();
            } else {
                statusMessage.textContent = "No users found.";
                return;
            }

            // 2. Escuchar TODOS los chats en tiempo real
            const chatsRef = ref(db, 'chats');
            onValue(chatsRef, (snapshot) => {
                const allChats = snapshot.val() || {};
                renderUserList(allChats);
            });

        } catch (e) {
            console.error(e);
            statusMessage.textContent = "Error loading users.";
        }
    });

    /**
     * Procesa los chats, los ordena y los muestra en la lista
     */
    function renderUserList(allChats) {
        if (!currentUser) return;

        let usersToRender = [];
        
        // 1. Combinar datos de usuarios con datos de chats
        for (const uid in usersMap) {
            if (uid === currentUser.uid) continue;

            const userData = usersMap[uid];
            const chatId = getChatId(currentUser.uid, uid);
            const chatData = allChats[chatId];

            const lastMessage = chatData?.lastMessage;
            const timestamp = lastMessage?.timestamp || 0; // 0 si no hay chat
            const lastMessageText = lastMessage?.text || "No messages yet";

            usersToRender.push({
                uid: uid,
                username: userData.username || "(no username)",
                email: userData.email,
                lastMessageTimestamp: timestamp,
                lastMessageText: lastMessageText
            });
        }

        // 2. Ordenar: más reciente primero
        usersToRender.sort((a, b) => b.lastMessageTimestamp - a.lastMessageTimestamp);

        // 3. Mostrar en el DOM
        userListDiv.innerHTML = ""; // Limpiar lista
        const fragment = document.createDocumentFragment();

        usersToRender.forEach(user => {
            const li = document.createElement("li");
            li.className = "user";
            li.dataset.uid = user.uid;
            li.dataset.username = user.username; // Para la búsqueda

            // Crear estructura interna segura (previene XSS)
            const usernameSpan = document.createElement("span");
            usernameSpan.className = "username";
            usernameSpan.textContent = user.username;

            const lastMessageSpan = document.createElement("span");
            lastMessageSpan.className = "last-message";
            // Acortar texto del último mensaje si es muy largo
            lastMessageSpan.textContent = user.lastMessageText.length > 30 
                ? user.lastMessageText.substring(0, 30) + "..." 
                : user.lastMessageText;

            li.appendChild(usernameSpan);
            li.appendChild(lastMessageSpan);
            fragment.appendChild(li);
        });

        userListDiv.appendChild(fragment);
        statusMessage.style.display = 'none'; // Ocultar "Loading"
    }

    // Listener para seleccionar un usuario
    userListDiv.addEventListener("click", async (e) => {
        const userLi = e.target.closest(".user");
        if (!userLi) return;

        // Quitar "active" de cualquier otro usuario
        document.querySelectorAll('#userList .user.active').forEach(el => {
            el.classList.remove('active');
        });
        // Añadir "active" al clickeado
        userLi.classList.add('active');

        selectedUser = userLi.dataset.uid;
        const selectedUsername = userLi.dataset.username;
        const chatId = getChatId(currentUser.uid, selectedUser);
        
        // Apagar listener de mensajes anterior
        if (currentMessagesRef) {
            off(currentMessagesRef); 
        }

        const messagesRef = ref(db, `chats/${chatId}/messages`);
        currentMessagesRef = messagesRef; 

        // Asegurarse de que el chat existe (aunque ahora no es tan necesario)
        const chatRef = ref(db, `chats/${chatId}`);
        const chatSnap = await get(chatRef);
        if (!chatSnap.exists()) {
            await set(chatRef, { createdAt: Date.now() });
        }

        // Mostrar el chat y ocultar el placeholder
        chatPlaceholder.style.display = "none";
        chatBox.style.display = "flex"; // Usamos flex para la estructura interna
        chatWith.textContent = selectedUsername;
        messagesDiv.innerHTML = ""; 

        // Cargar mensajes del chat seleccionado
        onValue(messagesRef, (snapshot) => {
            messagesDiv.innerHTML = ""; 
            if (!snapshot.exists()) return; 

            snapshot.forEach((childSnap) => {
                const data = childSnap.val();
                const div = document.createElement("div");
                div.classList.add("message");
                div.textContent = data.text; 

                if (data.sender === currentUser.uid) {
                    div.classList.add("you");
                } else {
                    div.classList.add("other");
                }
                messagesDiv.appendChild(div);
            });
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        });
    });

    // --- Message Sending Logic (ACTUALIZADO) ---
    const sendMessage = async () => {
        const text = messageInput.value.trim();
        if (!text || !selectedUser || !currentUser) return;

        const chatId = getChatId(currentUser.uid, selectedUser);
        const messagesRef = ref(db, `chats/${chatId}/messages`);
        const chatRef = ref(db, `chats/${chatId}`); // Referencia a la raíz del chat
        
        try {
            // 1. Añadir el mensaje a la lista de mensajes
            await push(messagesRef, {
                sender: currentUser.uid,
                text: text,
                timestamp: Date.now() // Añadimos timestamp al mensaje individual
            });

            // 2. ACTUALIZAR la raíz del chat con el último mensaje (para ordenar)
            const lastMessageData = {
                text: text,
                sender: currentUser.uid,
                timestamp: Date.now()
            };
            await update(chatRef, { lastMessage: lastMessageData });

            messageInput.value = ""; 
        } catch (e) {
            console.error("Error sending message:", e);
        }
    };

    sendButton.addEventListener("click", sendMessage);
    messageInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.keyCode === 13) {
            e.preventDefault(); 
            sendMessage();
        }
    });

    // --- Lógica de Búsqueda ---
    searchInput.addEventListener('keyup', () => {
        const filterText = searchInput.value.toLowerCase();
        const users = document.querySelectorAll('#userList .user');
        
        users.forEach(user => {
            const username = user.dataset.username.toLowerCase();
            if (username.includes(filterText)) {
                user.style.display = ""; // Mostrar
            } else {
                user.style.display = "none"; // Ocultar
            }
        });
    });

}

main();
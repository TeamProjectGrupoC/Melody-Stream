import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getDatabase, ref, get, child, set, push, onValue, off } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

// This function will run the entire application
async function main() {
    
    // --- Step 1: Get config securely from Firebase Hosting ---
    let firebaseConfig;
    try {
        const response = await fetch('/__/firebase/init.json');
        firebaseConfig = await response.json();
    } catch (e) {
        console.error("Could not load Firebase config. Are you running this on Firebase Hosting or using 'firebase serve'?");
        return; // Stop the app
    }
    
    // --- Step 2: Initialize Firebase ---
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getDatabase(app);

    // --- DOM Selectors ---
    const statusMessage = document.getElementById('statusMessage');
    const userListDiv = document.getElementById('userList');
    const chatBox = document.getElementById('chatBox');
    const chatWith = document.getElementById('chatWith');
    const messagesDiv = document.getElementById('messages');
    const messageInput = document.getElementById('msgInput');
    const sendButton = document.getElementById('sendBtn');

    // --- App State ---
    let currentUser = null;
    let selectedUser = null;
    let currentMessagesRef = null; 

    function getChatId(uid1, uid2) {
        return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
    }

    // --- Main Logic ---
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            statusMessage.textContent = "You must be logged in to see other users.";
            return;
        }
        currentUser = user;

        try {
            const dbRef = ref(db);
            const usersNode = await get(child(dbRef, "users"));

            if (!usersNode.exists()) {
                statusMessage.textContent = "No users found.";
                return;
            }

            const users = usersNode.val();
            statusMessage.textContent = "Online Users:";
            userListDiv.innerHTML = ""; 

            const fragment = document.createDocumentFragment();

            for (const uid in users) {
                if (uid === user.uid) continue;
                
                const u = users[uid];
                const username = u.username || "(no username)";
                
                const li = document.createElement("li");
                li.className = "user";
                li.dataset.uid = uid;
                li.dataset.username = username;
                li.textContent = `${username} — ${u.email}`; 
                
                fragment.appendChild(li);
            }
            userListDiv.appendChild(fragment);

        } catch (e) {
            console.error(e);
            statusMessage.textContent = "Error loading users.";
        }
    });

    // Listener for selecting a user
    userListDiv.addEventListener("click", async (e) => {
        const userLi = e.target.closest(".user");
        if (!userLi) return;

        selectedUser = userLi.dataset.uid;
        const selectedUsername = userLi.dataset.username;
        const chatId = getChatId(currentUser.uid, selectedUser);

        statusMessage.textContent = `Chat started with ${selectedUsername}`;
        
        if (currentMessagesRef) {
            off(currentMessagesRef); 
        }

        const messagesRef = ref(db, `chats/${chatId}/messages`);
        currentMessagesRef = messagesRef; 

        const chatRef = ref(db, `chats/${chatId}`);
        const chatSnap = await get(chatRef);
        if (!chatSnap.exists()) {
            await set(chatRef, { createdAt: Date.now() });
        }

        chatBox.style.display = "block";
        chatWith.textContent = selectedUsername;
        messagesDiv.innerHTML = ""; 

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

    // --- Message Sending Logic ---
    const sendMessage = async () => {
        const text = messageInput.value.trim();
        if (!text || !selectedUser || !currentUser) return;

        try {
            const chatId = getChatId(currentUser.uid, selectedUser);
            const messagesRef = ref(db, `chats/${chatId}/messages`);
            await push(messagesRef, {
                sender: currentUser.uid,
                text: text,
            });
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

} // <-- End of the main() function

// --- Step 3: Run the app ---
main();
import { auth, db, doc, setDoc, updateDoc, getDoc, onSnapshot, serverTimestamp, arrayUnion } from './firebase-config.js';
import { showToast } from './ui_utils.js';

const IMGBB_API_KEY = "22d2abeb6052c5dbee3c353e6aa617c0";

let chatUnsubscribe = null;
let activeChatOrderId = null;

export const uploadToImgBB = async (file) => {
    const formData = new FormData();
    formData.append("image", file);

    try {
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
            method: "POST",
            body: formData
        });

        if (!response.ok) throw new Error("ImgBB Upload Failed");

        const data = await response.json();
        return data.data.url;
    } catch (error) {
        console.error("ImgBB Upload Error:", error);
        return null;
    }
};

import { getOrderById } from './order_service.js';
import { getUserRole } from './auth_service.js';

export const openChat = async (orderId) => {
    activeChatOrderId = orderId;
    const modal = document.getElementById('chatModal');
    if (modal) {
        modal.classList.add('visible');
        const input = document.getElementById('chatInput');
        if (input) setTimeout(() => input.focus(), 300);
    }

    // Update Header Target Info
    try {
        const order = await getOrderById(orderId);
        if (order) {
            const role = getUserRole(auth.currentUser?.email) || 'client';
            const isStaff = role === 'staff' || role === 'admin' || role === 'owner';

            const targetName = isStaff ? order.userName : (order.workerName || 'الموظف المسؤول');
            const targetAvatar = isStaff ? order.userAvatar : (order.workerAvatar || 'https://ui-avatars.com/api/?name=Staff&background=00f2fe&color=000');

            const nameEl = document.getElementById('chatTargetName');
            const avatarEl = document.getElementById('chatTargetAvatar');
            if (nameEl) nameEl.innerText = targetName;
            if (avatarEl) avatarEl.src = targetAvatar;
        }
    } catch (e) { console.error("Chat Header Error:", e); }

    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) chatMessages.innerHTML = '<div class="chat-empty">جاري تحميل الرسائل...</div>';

    if (chatUnsubscribe) chatUnsubscribe();

    chatUnsubscribe = listenToMessages(orderId, (data) => {
        const messages = data.messages || [];
        const userId = auth.currentUser?.uid;

        // Only mark as read if there are messages and the lastRead is outdated
        if (userId && messages.length > 0) {
            const lastMsgTime = messages[messages.length - 1].timestamp;
            const currentLastRead = data[`lastRead_${userId}`] || 0;
            if (lastMsgTime > currentLastRead) {
                markMessagesAsRead(orderId, userId);
            }
        }

        if (!chatMessages) return;

        // Use DocumentFragment to batch DOM updates and avoid Layout Thrashing (Forced Reflow)
        const fragment = document.createDocumentFragment();

        if (!messages || messages.length === 0) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'chat-empty';
            emptyDiv.textContent = 'لا توجد رسائل بعد. ابدأ المحادثة الآن! 👋';
            fragment.appendChild(emptyDiv);
        } else {
            messages.forEach(msg => {
                const isMe = msg.senderId === auth.currentUser?.uid;
                const bubble = document.createElement('div');
                bubble.className = `message-bubble ${isMe ? 'sent' : 'received'}`;

                const time = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '...';

                bubble.innerHTML = `
                  <div class="message-info">
                    ${!isMe ? `<img src="${msg.senderAvatar}" style="width:15px; height:15px; border-radius:50%" loading="lazy">` : ''}
                    <span>${isMe ? 'أنا' : msg.senderName} • ${time}</span>
                  </div>
                  <div class="message-text">
                    ${msg.text ? `<div>${msg.text}</div>` : ''}
                    ${msg.image ? `
                      <a href="${msg.image}" target="_blank">
                        <img src="${msg.image}" style="max-width:100%; border-radius:10px; margin-top:5px; border:1px solid var(--glass-border); cursor:pointer;" loading="lazy">
                      </a>
                    ` : ''}
                  </div>
                `;
                fragment.appendChild(bubble);
            });
        }

        // Single DOM update
        chatMessages.innerHTML = '';
        chatMessages.appendChild(fragment);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });
};

export const closeChat = () => {
    document.getElementById('chatModal')?.classList.remove('visible');
    if (chatUnsubscribe) chatUnsubscribe();
    chatUnsubscribe = null;
    activeChatOrderId = null;
};

export const sendMessage = async (orderId, message) => {
    try {
        const user = auth.currentUser;
        if (!user) return false;

        const chatRef = doc(db, "chats", orderId);
        const msg = {
            senderId: user.uid,
            senderName: user.displayName,
            senderAvatar: user.photoURL,
            text: message,
            image: null,
            timestamp: Date.now(), // Fixed timestamp for serializability in array
            readStatus: {} // New system: track read status per user
        };

        await setDoc(chatRef, {
            orderId: orderId,
            messages: arrayUnion(msg),
            lastUpdated: serverTimestamp()
        }, { merge: true });

        return true;
    } catch (error) {
        console.error("Chat Error:", error);
        return false;
    }
};

export const handleSendMessage = async () => {
    const input = document.getElementById('chatInput');
    const text = input?.value.trim();
    if (!text || !activeChatOrderId) return;

    input.value = '';
    const success = await sendMessage(activeChatOrderId, text);
    if (!success) {
        showToast("فشل إرسال الرسالة!", "❌");
        input.value = text;
    }
};

export const sendImageMessage = async (orderId, file) => {
    try {
        const user = auth.currentUser;
        if (!user) return false;

        const imageUrl = await uploadToImgBB(file);
        if (!imageUrl) return false;

        const chatRef = doc(db, "chats", orderId);
        const msg = {
            senderId: user.uid,
            senderName: user.displayName,
            senderAvatar: user.photoURL,
            text: null,
            image: imageUrl,
            timestamp: Date.now(),
            readStatus: {}
        };

        await setDoc(chatRef, {
            orderId: orderId,
            messages: arrayUnion(msg),
            lastUpdated: serverTimestamp()
        }, { merge: true });

        return true;
    } catch (error) {
        console.error("Image Send Error:", error);
        return false;
    }
};

export const handleSendImage = async (file) => {
    if (!file || !activeChatOrderId) return;
    if (file.size > 32 * 1024 * 1024) {
        showToast("حجم الصورة كبير جداً! (الأقصى 32 ميجا)", "⚠️");
        return;
    }
    const progressBar = document.getElementById('uploadProgress');
    if (progressBar) progressBar.style.display = 'block';
    const success = await sendImageMessage(activeChatOrderId, file);
    if (progressBar) progressBar.style.display = 'none';
    if (!success) showToast("فشل رفع الصورة!", "❌");
};

export const listenToMessages = (orderId, callback) => {
    const chatRef = doc(db, "chats", orderId);
    return onSnapshot(chatRef, (snapshot) => {
        if (snapshot.exists()) {
            callback(snapshot.data());
        } else {
            callback({ messages: [] });
        }
    }, (error) => {
        console.error("Chat Listener Error:", error);
        callback({ messages: [] });
    });
};

export const markMessagesAsRead = async (orderId, userId) => {
    try {
        const chatRef = doc(db, "chats", orderId);
        // Simple approach: Store lastRead timestamp for the user
        await setDoc(chatRef, {
            [`lastRead_${userId}`]: Date.now()
        }, { merge: true });
    } catch (error) {
        console.error("Error marking read:", error);
    }
};

export const listenToUnreadCount = (orderId, userId, callback) => {
    const chatRef = doc(db, "chats", orderId);
    return onSnapshot(chatRef, (snapshot) => {
        if (!snapshot.exists()) {
            callback(0);
            return;
        }
        const data = snapshot.data();
        const messages = data.messages || [];
        const lastRead = data[`lastRead_${userId}`] || 0;

        const count = messages.filter(msg => msg.senderId !== userId && msg.timestamp > lastRead).length;
        callback(count);
    }, (error) => {
        console.error("Unread Count Listener Error:", error);
        callback(0);
    });
};

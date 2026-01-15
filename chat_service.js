import { auth, db, collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot, getDocs, writeBatch } from './firebase-config.js';
import { showToast } from './ui_utils.js';

const IMGBB_API_KEY = "22d2abeb6052c5dbee3c353e6aa617c0";

let chatUnsubscribe = null;
let activeChatOrderId = null;

const uploadToImgBB = async (file) => {
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

export const openChat = async (orderId) => {
    activeChatOrderId = orderId;
    const modal = document.getElementById('chatModal');
    if (modal) modal.classList.add('visible');

    const chatMessages = document.getElementById('chatMessages');
    const input = document.getElementById('chatInput');
    if (chatMessages) chatMessages.innerHTML = '<div class="chat-empty">جاري تحميل الرسائل...</div>';

    // Update Header Info
    try {
        const order = await getOrderById(orderId);
        if (order) {
            const isWorker = auth.currentUser?.uid === order.workerId;
            const targetName = isWorker ? order.userName : (order.workerName || "الموظف");
            const targetAvatar = isWorker ? order.userAvatar : (order.workerAvatar || "https://ui-avatars.com/api/?name=Staff");

            document.getElementById('chatTargetName').innerText = targetName;
            document.getElementById('chatTargetAvatar').src = targetAvatar;
        }
    } catch (e) { console.error("Chat Header Error:", e); }

    if (input) {
        setTimeout(() => input.focus(), 500);
    }

    if (chatUnsubscribe) chatUnsubscribe();

    chatUnsubscribe = listenToMessages(orderId, (messages) => {
        markMessagesAsRead(orderId, auth.currentUser?.uid);

        if (!chatMessages) return;
        chatMessages.innerHTML = '';
        if (messages.length === 0) {
            chatMessages.innerHTML = '<div class="chat-empty">لا توجد رسائل بعد. ابدأ المحادثة الآن! 👋</div>';
        } else {
            messages.forEach(msg => {
                const isMe = msg.senderId === auth.currentUser?.uid;
                const bubble = document.createElement('div');
                bubble.className = `message-bubble ${isMe ? 'sent' : 'received'}`;

                const time = msg.timestamp ? new Date(msg.timestamp.seconds * 1000).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '...';

                bubble.innerHTML = `
                  <div class="message-info">
                    ${!isMe ? `<img src="${msg.senderAvatar}" style="width:15px; height:15px; border-radius:50%">` : ''}
                    <span>${isMe ? 'أنا' : msg.senderName} • ${time}</span>
                  </div>
                  <div class="message-text">
                    ${msg.text ? `<div>${msg.text}</div>` : ''}
                    ${msg.image ? `
                      <a href="${msg.image}" target="_blank">
                        <img src="${msg.image}" style="max-width:100%; border-radius:10px; margin-top:5px; border:1px solid var(--glass-border); cursor:pointer;">
                      </a>
                    ` : ''}
                  </div>
                `;
                chatMessages.appendChild(bubble);
            });
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
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

        await addDoc(collection(db, "messages"), {
            orderId: orderId,
            senderId: user.uid,
            senderName: user.displayName,
            senderAvatar: user.photoURL,
            text: message,
            image: null,
            read: false,
            timestamp: serverTimestamp()
        });
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

        await addDoc(collection(db, "messages"), {
            orderId: orderId,
            senderId: user.uid,
            senderName: user.displayName,
            senderAvatar: user.photoURL,
            text: null,
            image: imageUrl,
            read: false,
            timestamp: serverTimestamp()
        });
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
    const q = query(
        collection(db, "messages"),
        where("orderId", "==", orderId),
        orderBy("timestamp", "asc")
    );
    return onSnapshot(q, (snapshot) => {
        const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(messages);
    });
};

export const markMessagesAsRead = async (orderId, userId) => {
    try {
        const q = query(
            collection(db, "messages"),
            where("orderId", "==", orderId),
            where("read", "==", false)
        );
        const snapshot = await getDocs(q);
        const batch = writeBatch(db);

        let hasUpdates = false;
        snapshot.docs.forEach(doc => {
            if (doc.data().senderId !== userId) {
                batch.update(doc.ref, { read: true });
                hasUpdates = true;
            }
        });

        if (hasUpdates) await batch.commit();
    } catch (error) {
        console.error("Error marking read:", error);
    }
};

export const listenToUnreadCount = (orderId, userId, callback) => {
    const q = query(
        collection(db, "messages"),
        where("orderId", "==", orderId),
        where("read", "==", false)
    );
    return onSnapshot(q, (snapshot) => {
        const count = snapshot.docs.filter(doc => doc.data().senderId !== userId).length;
        callback(count);
    });
};

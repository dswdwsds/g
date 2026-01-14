import { auth, provider, signInWithPopup, signOut, onAuthStateChanged, db, collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot, doc, updateDoc } from './firebase-config.js';

const DISCORD_WEBHOOK = "https://discord.com/api/webhooks/1395038941110866010/MucgrT_399C44lfUVL79HcqR4cfwNbJlL5iG1qPmxdBF47GGbTbmkokZK6YnslmJ63wL";

export const login = async () => {
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Login Error:", error);
    }
};

export const logout = () => signOut(auth);

export const sendToDiscord = async (orderData) => {
    const payload = {
        content: `📦 **طلب جديد من ${orderData.userName}!**`,
        embeds: [{
            title: "🚀 وصل طلب تلفيل جديد!",
            color: 0x00f2fe,
            fields: [
                { name: "👤 اسم العميل", value: orderData.userName, inline: true },
                { name: "💎 نوع الطلب (الفئة)", value: orderData.tier, inline: true },
                { name: "🆔 رقم الطلب", value: `\`${orderData.orderId}\`` },
                { name: "⏳ الحالة الحالية", value: "بانتظار البدء... ⏳" }
            ],
            thumbnail: { url: orderData.userAvatar },
            footer: { text: "نظام Professional GS لإدارة الطلبات" },
            timestamp: new Date().toISOString()
        }],
        components: [
            {
                type: 1, // Action Row
                components: [
                    {
                        type: 2, // Button
                        label: "بدء العمل ️🛠️",
                        style: 1, // Primary (Blue)
                        custom_id: `start_${orderData.orderId}`
                    },
                    {
                        type: 2,
                        label: "رفض الطلب ❌",
                        style: 4, // Danger (Red)
                        custom_id: `reject_${orderData.orderId}`
                    }
                ]
            }
        ]
    };

    await fetch(DISCORD_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
};

export const placeOrder = async (tier) => {
    const user = auth.currentUser;
    if (!user) {
        alert("Please login first!");
        return;
    }

    try {
        const orderRef = await addDoc(collection(db, "orders"), {
            uid: user.uid,
            userName: user.displayName,
            userAvatar: user.photoURL,
            tier: tier,
            status: "waiting",
            createdAt: serverTimestamp()
        });

        await sendToDiscord({
            orderId: orderRef.id,
            userName: user.displayName,
            userAvatar: user.photoURL,
            tier: tier
        });

        alert("Order placed successfully! Check your queue position.");
    } catch (error) {
        console.error("Order Error:", error);
        alert("Failed to place order.");
    }
};

let authorizedWorkers = [];

export const listenToWorkers = (callback) => {
    return onSnapshot(collection(db, "staff"), (snapshot) => {
        authorizedWorkers = snapshot.docs.map(doc => doc.id); // نستخدم الـ Document ID كإيميل
        if (callback) callback(authorizedWorkers);
    });
};

export const isWorker = (email) => authorizedWorkers.includes(email);

export const updateOrderStatus = async (orderId, newStatus) => {
    try {
        const orderRef = doc(db, "orders", orderId);
        const updateData = { status: newStatus };

        // إذا كان العامل هو من ينفذ، نسجل بياناته
        if (newStatus === 'working' && auth.currentUser) {
            updateData.workerId = auth.currentUser.uid;
            updateData.workerName = auth.currentUser.displayName;
            updateData.workerAvatar = auth.currentUser.photoURL;
        }

        await updateDoc(orderRef, updateData);
    } catch (error) {
        console.error("Update Error:", error);
        alert("فشل تحديث الحالة.");
    }
};

export const listenToAllOrders = (callback) => {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snapshot) => {
        const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(orders);
    });
};

export const listenToQueue = (callback) => {
    const q = query(collection(db, "orders"), where("status", "in", ["waiting", "working"]), orderBy("createdAt", "asc"));
    return onSnapshot(q,
        (snapshot) => {
            const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            callback(orders);
        },
        (error) => {
            console.error("Firestore Error:", error);
            if (error.code === 'not-found') {
                console.warn("Please ensure Firestore is enabled in your Firebase Console.");
            }
        }
    );
};

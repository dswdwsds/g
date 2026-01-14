import { auth, provider, signInWithPopup, signOut, onAuthStateChanged, db, collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot } from './firebase-config.js';

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
        embeds: [{
            title: "🚀 New Order Received!",
            color: 0x00f2fe,
            fields: [
                { name: "User", value: orderData.userName, inline: true },
                { name: "Tier", value: orderData.tier, inline: true },
                { name: "Order ID", value: orderData.orderId },
                { name: "Status", value: "Waiting in Queue ⏳" }
            ],
            thumbnail: { url: orderData.userAvatar },
            timestamp: new Date().toISOString()
        }]
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

export const listenToQueue = (callback) => {
    const q = query(collection(db, "orders"), where("status", "in", ["waiting", "working"]), orderBy("createdAt", "asc"));
    return onSnapshot(q, (snapshot) => {
        const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(orders);
    });
};

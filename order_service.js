import { auth, db, collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot, doc, updateDoc, getDoc, limit, increment, setDoc, getDocs } from './firebase-config.js';
import { updateDiscordMessage } from './discord_service.js';
import { getUserRole } from './auth_service.js';

const PAYMENT_CONFIG = {
    walletNumber: "01015831676",
    walletType: "Vodafone Cash / InstaPay"
};

export const submitRating = async (orderId, rating, review) => {
    try {
        const orderRef = doc(db, "orders", orderId);
        const snapshot = await getDoc(orderRef);

        if (!snapshot.exists()) return false;
        const orderData = snapshot.data();

        await updateDoc(orderRef, {
            rating: rating,
            review: review || "",
            ratedAt: serverTimestamp()
        });

        await addDoc(collection(db, "comments"), {
            orderId: orderId,
            uid: orderData.uid,
            userName: orderData.userName,
            userAvatar: orderData.userAvatar,
            rating: rating,
            review: review || "",
            tier: orderData.tier,
            createdAt: serverTimestamp()
        });

        return true;
    } catch (error) {
        console.error("Rating Error:", error);
        return false;
    }
};

export const placeOrder = async (tier, charData, finalPrice, steamData) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
        const characters = Array.isArray(charData) ? charData : [charData];
        const totalPrice = finalPrice || 0;

        const orderDoc = {
            uid: user.uid,
            userName: user.displayName,
            userAvatar: user.photoURL,
            tier: tier,
            totalPrice: totalPrice,
            characters: characters.map(c => ({
                id: c.id,
                name: c.name,
                image: c.image || ""
            })),
            status: "awaiting_payment",
            steamData: steamData || null,
            createdAt: serverTimestamp()
        };

        const orderRef = await addDoc(collection(db, "orders"), orderDoc);

        if (window.showPaymentModal) {
            window.showPaymentModal({
                orderId: orderRef.id,
                totalPrice: totalPrice,
                walletNumber: PAYMENT_CONFIG.walletNumber,
                tier: tier
            });
        }

        return orderRef.id;
    } catch (error) {
        console.error("Order Error:", error);
    }
};

export const updateOrderStatus = async (orderId, newStatus) => {
    try {
        const orderRef = doc(db, "orders", orderId);
        const updateData = { status: newStatus };

        if (newStatus === 'working' && auth.currentUser) {
            updateData.workerId = auth.currentUser.uid;
            const snapshot = await getDoc(orderRef);
            if (snapshot.exists()) {
                const currentData = snapshot.data();
                const currentName = currentData.workerName;
                const newName = auth.currentUser.displayName;

                if (currentName && !currentName.includes(newName)) {
                    updateData.workerName = `${currentName} & ${newName}`;
                } else if (!currentName) {
                    updateData.workerName = newName;
                }
            } else {
                updateData.workerName = auth.currentUser.displayName;
            }
            updateData.workerAvatar = auth.currentUser.photoURL;
        }

        await updateDoc(orderRef, updateData);

        const snapshot = await getDoc(orderRef);
        if (snapshot.exists()) {
            const orderData = { id: orderId, ...snapshot.data() };

            if (newStatus === 'done' && orderData.workerId) {
                const staffRef = doc(db, "staff", auth.currentUser.uid);
                const userRole = getUserRole(auth.currentUser.email) || 'staff';
                await setDoc(staffRef, {
                    email: auth.currentUser.email,
                    name: auth.currentUser.displayName,
                    totalEarnings: increment(orderData.totalPrice || 0),
                    role: userRole,
                    lastActive: serverTimestamp()
                }, { merge: true });
            }

            await updateDiscordMessage(orderData, newStatus);
        }
    } catch (error) {
        console.error("Update Error:", error);
    }
};

export const leaveOrder = async (orderId) => {
    try {
        const orderRef = doc(db, "orders", orderId);
        await updateDoc(orderRef, {
            status: "waiting",
            workerId: null
        });

        const snapshot = await getDoc(orderRef);
        if (snapshot.exists()) {
            await updateDiscordMessage({ id: orderId, ...snapshot.data() }, "waiting");
        }
        return true;
    } catch (error) {
        console.error("Leave Order Error:", error);
        return false;
    }
};

export const listenToAllOrders = (callback) => {
    const q = query(collection(db, "orders"),
        where("status", "in", ["awaiting_payment", "pending_verification", "waiting", "working"]),
        orderBy("createdAt", "desc")
    );
    return onSnapshot(q, (snapshot) => {
        const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(orders);
    });
};

export const listenToQueue = (callback) => {
    const q = query(collection(db, "orders"),
        where("status", "in", ["awaiting_payment", "pending_verification", "waiting", "working"]),
        orderBy("createdAt", "asc")
    );
    return onSnapshot(q, (snapshot) => {
        const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(orders);
    });
};

export const listenToUserOrders = (uid, callback) => {
    const q = query(collection(db, "orders"), where("uid", "==", uid));
    return onSnapshot(q, (snapshot) => {
        const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(orders);
    });
};

export const getOrderById = async (orderId) => {
    try {
        const orderRef = doc(db, "orders", orderId);
        const snapshot = await getDoc(orderRef);
        return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
    } catch (error) {
        console.error("Get Order Error:", error);
        return null;
    }
};

export const hasUserPurchasedOffer = async (uid, tierName) => {
    try {
        const q = query(
            collection(db, "orders"),
            where("uid", "==", uid),
            where("tier", "==", tierName)
        );
        const snapshot = await getDocs(q);
        const hasActiveOrder = snapshot.docs.some(doc => doc.data().status !== 'rejected');
        return hasActiveOrder;
    } catch (error) {
        console.error("Check Offer Error:", error);
        return false;
    }
};

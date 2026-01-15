import { db, collection, query, where, orderBy, onSnapshot, doc, limit, deleteDoc, getDocs } from './firebase-config.js';

export const listenToStaffStats = (docId, callback) => {
    return onSnapshot(doc(db, "staff", docId), (doc) => {
        if (doc.exists()) {
            callback({ id: doc.id, ...doc.data() });
        }
    });
};

export const listenToWorkerCompletedOrders = (workerId, callback) => {
    const q = query(
        collection(db, "orders"),
        where("workerId", "==", workerId),
        where("status", "==", "done"),
        orderBy("createdAt", "desc")
    );
    return onSnapshot(q, (snapshot) => {
        const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(orders);
    });
};

export const deleteReview = async (commentId) => {
    try {
        await deleteDoc(doc(db, "comments", commentId));
        return true;
    } catch (error) {
        console.error("Delete Review Error:", error);
        return false;
    }
};

export const listenToRecentReviews = (callback) => {
    const q = query(
        collection(db, "comments"),
        orderBy("rating", "desc"),
        orderBy("createdAt", "desc"),
        limit(10)
    );
    return onSnapshot(q, (snapshot) => {
        const reviews = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(reviews);
    });
};

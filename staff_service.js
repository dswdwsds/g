import { db, collection, query, where, orderBy, onSnapshot, doc, limit, deleteDoc, getDocs, setDoc } from './firebase-config.js';

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
export const listenToAllReviews = (callback) => {
    const q = query(
        collection(db, "comments"),
        orderBy("createdAt", "desc")
    );
    return onSnapshot(q, (snapshot) => {
        const reviews = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(reviews);
    });
};



export const updateRoleData = async (roleId, data) => {
    try {
        const roleRef = doc(db, "roles", roleId);
        await setDoc(roleRef, data, { merge: true });
        return true;
    } catch (error) {
        console.error("Update Role Error:", error);
        return false;
    }
};

export const deleteRoleData = async (roleId) => {
    try {
        await deleteDoc(doc(db, "roles", roleId));
        return true;
    } catch (error) {
        console.error("Delete Role Error:", error);
        return false;
    }
};

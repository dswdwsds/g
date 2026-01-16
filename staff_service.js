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

export const loadEarnings = (email, uid) => {
    const totalEarningsEl = document.getElementById('totalEarnings');
    const orderCountEl = document.getElementById('orderCount');
    const completedOrdersListEl = document.getElementById('completedOrdersList');

    listenToStaffStats(uid, (stats) => {
        if (stats && totalEarningsEl) {
            totalEarningsEl.innerText = `${stats.totalEarnings || 0} جنيه`;
        }
    });

    listenToWorkerCompletedOrders(uid, (orders) => {
        if (orderCountEl) orderCountEl.innerText = orders.length;

        if (completedOrdersListEl) {
            completedOrdersListEl.innerHTML = '';

            if (orders.length === 0) {
                completedOrdersListEl.innerHTML = '<p style="text-align:center; color:var(--text-dim);">لا يوجد أرباح مسجلة بعد</p>';
                return;
            }

            orders.forEach(order => {
                const item = document.createElement('div');
                item.style.cssText = 'background: rgba(255,255,255,0.03); border: 1px solid var(--glass-border); padding: 15px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;';

                const charTags = (order.characters || []).map(c => `
                    <span style="font-size:0.75rem; background:rgba(255,255,255,0.05); padding:2px 6px; border-radius:5px;">${c.name}</span>
                `).join(' ');

                const stars = order.rating ? '⭐'.repeat(order.rating) : 'بدون تقييم';
                const price = order.totalPrice || 0;

                item.innerHTML = `
                    <div>
                        <div style="font-weight:bold; margin-bottom:5px;">طلب #${order.id}</div>
                        <div style="font-size:0.85rem; color:var(--text-dim); margin-bottom:5px;">${new Date(order.createdAt?.seconds * 1000).toLocaleDateString('ar-EG')}</div>
                        <div style="display:flex; gap:5px; flex-wrap:wrap;">${charTags}</div>
                    </div>
                    <div style="text-align:left;">
                        <div style="font-weight:bold; color:var(--primary); font-size:1.1rem;">${price} جنيه</div>
                        <div style="font-size:0.8rem; color:#ffb700;">${stars}</div>
                    </div>
                `;
                completedOrdersListEl.appendChild(item);
            });
        }
    });
};

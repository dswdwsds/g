// Notifications Service
import { db, doc, collection, query, where, orderBy, limit, onSnapshot, updateDoc, addDoc, serverTimestamp } from './firebase-config.js';
import { auth } from './firebase-config.js';

let unreadCount = 0;
let notificationsListener = null;

// Notification types with icons and colors
export const NOTIFICATION_TYPES = {
    ORDER_SUBMITTED: {
        icon: '📦',
        color: '#00f2fe',
        title: 'تم تقديم الطلب'
    },
    ORDER_CONFIRMED: {
        icon: '✅',
        color: '#00ff9d',
        title: 'تم تأكيد الطلب'
    },
    PAYMENT_VERIFIED: {
        icon: '💰',
        color: '#ffd700',
        title: 'تم تأكيد الدفع'
    },
    ORDER_REJECTED: {
        icon: '❌',
        color: '#ff4d4d',
        title: 'تم رفض الطلب'
    },
    ORDER_COMPLETED: {
        icon: '🎉',
        color: '#00f2fe',
        title: 'تم إكمال الطلب'
    },
    WARNING: {
        icon: '⚠️',
        color: '#ffeb3b',
        title: 'تحذير'
    },
    ACCOUNT_SUSPENDED: {
        icon: '🚫',
        color: '#ff4d4d',
        title: 'تم تعليق الحساب'
    },
    NEW_MESSAGE: {
        icon: '💬',
        color: '#bb86fc',
        title: 'رسالة جديدة'
    },
    SYSTEM: {
        icon: '🔔',
        color: '#4facfe',
        title: 'إشعار النظام'
    }
};

// Listen to user notifications
export const listenToNotifications = (callback) => {
    const user = auth.currentUser;
    if (!user) {
        console.log('[Notifications] No user logged in');
        return;
    }

    // Stop previous listener
    if (notificationsListener) {
        notificationsListener();
    }

    const notificationsRef = collection(db, 'notifications');
    const q = query(
        notificationsRef,
        where('userId', '==', user.uid),
        orderBy('timestamp', 'desc'),
        limit(50)
    );

    notificationsListener = onSnapshot(q, (snapshot) => {
        const notifications = [];
        unreadCount = 0;

        snapshot.forEach((doc) => {
            const data = doc.data();
            notifications.push({
                id: doc.id,
                ...data
            });

            if (!data.read) {
                unreadCount++;
            }
        });

        console.log(`[Notifications] Loaded ${notifications.length} notifications, ${unreadCount} unread`);

        if (callback) {
            callback(notifications, unreadCount);
        }

        // Update badge
        updateNotificationBadge(unreadCount);
    });

    return notificationsListener;
};

// Update notification badge
export const updateNotificationBadge = (count) => {
    const badge = document.getElementById('notificationBadge');
    if (badge) {
        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }
};

// Mark notification as read
export const markAsRead = async (notificationId) => {
    try {
        const notifRef = doc(db, 'notifications', notificationId);
        await updateDoc(notifRef, {
            read: true,
            readAt: serverTimestamp()
        });
        console.log('[Notifications] Marked as read:', notificationId);
    } catch (error) {
        console.error('[Notifications] Error marking as read:', error);
    }
};

// Mark all notifications as read
export const markAllAsRead = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
        const notificationsRef = collection(db, 'notifications');
        const q = query(
            notificationsRef,
            where('userId', '==', user.uid),
            where('read', '==', false)
        );

        const snapshot = await getDocs(q);
        const batch = writeBatch(db);

        snapshot.forEach((doc) => {
            batch.update(doc.ref, {
                read: true,
                readAt: serverTimestamp()
            });
        });

        await batch.commit();
        console.log('[Notifications] Marked all as read');
    } catch (error) {
        console.error('[Notifications] Error marking all as read:', error);
    }
};

// Create notification (for admin/system use)
export const createNotification = async (userId, type, message, data = {}) => {
    try {
        const notifType = NOTIFICATION_TYPES[type] || NOTIFICATION_TYPES.SYSTEM;

        const notification = {
            userId,
            type,
            title: notifType.title,
            message,
            icon: notifType.icon,
            color: notifType.color,
            read: false,
            timestamp: serverTimestamp(),
            ...data
        };

        const docRef = await addDoc(collection(db, 'notifications'), notification);
        console.log('[Notifications] Created notification:', docRef.id);

        // Send push notification if user has subscription
        await sendPushNotification(userId, notification);

        return docRef.id;
    } catch (error) {
        console.error('[Notifications] Error creating notification:', error);
        throw error;
    }
};

// Send push notification
const sendPushNotification = async (userId, notification) => {
    try {
        // Get user's push subscription from Firebase
        const subscriptionDoc = await getDoc(doc(db, 'pushSubscriptions', userId));

        if (!subscriptionDoc.exists()) {
            console.log('[Notifications] No push subscription for user:', userId);
            return;
        }

        const subscriptionData = subscriptionDoc.data();

        // Send via Firebase Cloud Messaging or your backend
        // This is a placeholder - you'll need to implement the actual sending logic
        console.log('[Notifications] Would send push notification:', notification);

        // Example: Call your backend API to send push
        // await fetch('/api/send-push', {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify({
        //     subscription: subscriptionData.subscription,
        //     notification: {
        //       title: notification.title,
        //       body: notification.message,
        //       icon: notification.icon,
        //       data: notification
        //     }
        //   })
        // });

    } catch (error) {
        console.error('[Notifications] Error sending push notification:', error);
    }
};

// Get unread count
export const getUnreadCount = () => unreadCount;

// Stop listening
export const stopListeningToNotifications = () => {
    if (notificationsListener) {
        notificationsListener();
        notificationsListener = null;
    }
};

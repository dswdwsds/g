// Cache and Service Worker Initialization
// This file registers the service worker and handles push notifications

if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            // Register Service Worker
            const registration = await navigator.serviceWorker.register('/service-worker.js', {
                scope: '/'
            });

            console.log('[Cache Init] Service Worker registered successfully:', registration.scope);

            // Request notification permission
            if ('Notification' in window && 'PushManager' in window) {
                const permission = await Notification.requestPermission();

                if (permission === 'granted') {
                    console.log('[Cache Init] Notification permission granted');

                    // Subscribe to push notifications
                    try {
                        const subscription = await registration.pushManager.subscribe({
                            userVisibleOnly: true,
                            applicationServerKey: urlBase64ToUint8Array(
                                // VAPID public key - يجب استبداله بمفتاحك من Firebase
                                'BDC0UpbELES7sTikbMjbbMbItN7lXhBOH6-VCtHC70R0YLJ6jEnFlyATdULkBS1TdJ5Uk2YoGuqzcU0RDamqbks'
                            )
                        });

                        console.log('[Cache Init] Push subscription successful');

                        // Send subscription to server (Firebase)
                        await savePushSubscription(subscription);

                    } catch (subscribeError) {
                        console.error('[Cache Init] Push subscription failed:', subscribeError);
                    }
                } else {
                    console.log('[Cache Init] Notification permission denied');
                }
            }

            // Listen for service worker updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                console.log('[Cache Init] New service worker found, installing...');

                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        console.log('[Cache Init] New service worker installed, refresh to update');
                        // يمكن إضافة إشعار للمستخدم هنا
                    }
                });
            });

        } catch (error) {
            console.error('[Cache Init] Service Worker registration failed:', error);
        }
    });
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// Save push subscription to Firebase
async function savePushSubscription(subscription) {
    try {
        const user = window.auth?.currentUser;
        if (!user) {
            console.log('[Cache Init] No user logged in, skipping subscription save');
            return;
        }

        const { db, doc, setDoc } = await import('./firebase-config.js');

        await setDoc(doc(db, 'pushSubscriptions', user.uid), {
            subscription: JSON.parse(JSON.stringify(subscription)),
            userId: user.uid,
            userAgent: navigator.userAgent,
            timestamp: new Date()
        }, { merge: true });

        console.log('[Cache Init] Push subscription saved to Firebase');
    } catch (error) {
        console.error('[Cache Init] Failed to save push subscription:', error);
    }
}

// Export for use in other modules
window.requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
        alert('هذا المتصفح لا يدعم الإشعارات');
        return false;
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
};

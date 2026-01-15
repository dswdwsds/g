import { auth, provider, signInWithPopup, signOut, onAuthStateChanged, db, collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot, doc, updateDoc, getDoc, limit, increment, setDoc, deleteDoc } from './firebase-config.js';

const DISCORD_WEBHOOK = "https://discord.com/api/webhooks/1395038941110866010/MucgrT_399C44lfUVL79HcqR4cfwNbJlL5iG1qPmxdBF47GGbTbmkokZK6YnslmJ63wL";

// Payment Configuration
const PAYMENT_CONFIG = {
    walletNumber: "01015831676",
    walletType: "Vodafone Cash / InstaPay"
};


export const login = async () => {
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Login Error:", error);
    }
};

export const logout = () => signOut(auth);



// Load characters from JSON file
let CHARACTERS = [];
export const loadCharacters = async () => {
    try {
        const response = await fetch('./characters.json');
        CHARACTERS = await response.json();
        return CHARACTERS;
    } catch (error) {
        console.error("Error loading characters:", error);
        return [];
    }
};

// Export getter for CHARACTERS
export const getCharacters = () => CHARACTERS;

// Submit rating for completed order
export const submitRating = async (orderId, rating, review) => {
    try {
        const orderRef = doc(db, "orders", orderId);
        const snapshot = await getDoc(orderRef);

        if (!snapshot.exists()) return false;
        const orderData = snapshot.data();

        // 1. Update order document
        await updateDoc(orderRef, {
            rating: rating,
            review: review || "",
            ratedAt: serverTimestamp()
        });

        // 2. Add to dedicated comments collection
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

// Send chat message
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
            timestamp: serverTimestamp()
        });
        return true;
    } catch (error) {
        console.error("Chat Error:", error);
        return false;
    }
};

// Listen to chat messages for an order
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



export const sendToDiscord = async (orderData) => {
    const charNames = Array.isArray(orderData.characters)
        ? orderData.characters.map(c => c.name).join('، ')
        : orderData.charName;

    const payload = {
        content: `📦 **طلب جديد من ${orderData.userName}!**`,
        embeds: [{
            title: "🚀 وصل طلب تلفيل جديد!",
            color: 0x00f2fe,
            fields: [
                { name: "👤 اسم العميل", value: orderData.userName, inline: true },
                { name: "🗡️ الشخصيات", value: charNames, inline: true },
                { name: "💎 الفئة (Tier)", value: orderData.tier, inline: true },
                { name: "🆔 رقم الطلب", value: `\`${orderData.orderId}\`` },
                { name: "⏳ الحالة الحالية", value: "بانتظار الدفع أو البدء... ⏳" }
            ],
            thumbnail: { url: orderData.characters?.[0]?.image || orderData.charImage || orderData.userAvatar },
            footer: { text: "نظام Professional GS لإدارة الطلبات" },
            timestamp: new Date().toISOString()
        }],
        components: [
            {
                type: 1,
                components: [
                    {
                        type: 2,
                        label: "بدء العمل ️🛠️",
                        style: 1,
                        custom_id: `start_${orderData.orderId}`
                    },
                    {
                        type: 2,
                        label: "رفض الطلب ❌",
                        style: 4,
                        custom_id: `reject_${orderData.orderId}`
                    }
                ]
            }
        ]
    };

    const response = await fetch(DISCORD_WEBHOOK + "?wait=true", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    return await response.json();
};



export const placeOrder = async (tier, charData) => {
    const user = auth.currentUser;
    if (!user) {
        if (window.showToast) window.showToast("Please login first!", "🔑");
        else alert("Please login first!");
        return;
    }

    if (!charData || (Array.isArray(charData) && charData.length === 0)) {
        if (window.showToast) window.showToast("يرجى اختيار الشخصية أولاً!", "🗡️");
        else alert("يرجى اختيار الشخصية أولاً!");
        return;
    }

    try {
        const TIER_PRICES = { 'Starter': 8, 'Pro': 9, 'Ultimate': 10 };
        const pricePerChar = TIER_PRICES[tier] || 0;
        const characters = Array.isArray(charData) ? charData : [charData];
        const totalPrice = pricePerChar * characters.length;

        const orderRef = await addDoc(collection(db, "orders"), {
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
            createdAt: serverTimestamp()
        });

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
        if (window.showToast) window.showToast("فشل في تقديم الطلب. حاول مرة أخرى.", "❌");
        else alert("فشل في تقديم الطلب. يرجى المحاولة مرة أخرى.");
    }
};


let authorizedStaff = [];

export const listenToWorkers = (callback) => {
    return onSnapshot(collection(db, "staff"), (snapshot) => {
        authorizedStaff = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (callback) callback(authorizedStaff);
    });
};

export const isWorker = (email) => {
    const staff = authorizedStaff.find(s => s.email === email || s.id === email);
    // يعتبر موظفاً إذا كان له دور (staff, admin, owner)
    return !!staff && !!staff.role;
};

export const getUserRole = (email) => {
    const staff = authorizedStaff.find(s => s.email === email || s.id === email);
    return staff ? staff.role : null;
};

// وظيفة لإضافة أو تحديث دور موظف (للمالك فقط)
export const setStaffRole = async (email, role) => {
    try {
        // نستخدم الإيميل كـ ID للوثيقة في حال لم يكن لدينا UID بعد
        const staffRef = doc(db, "staff", email);
        await setDoc(staffRef, {
            email: email,
            role: role,
            updatedAt: serverTimestamp()
        }, { merge: true });
        return true;
    } catch (error) {
        console.error("Set Role Error:", error);
        return false;
    }
};

// وظيفة لحذف موظف (للمالك فقط)
export const deleteStaff = async (docId) => {
    try {
        await deleteDoc(doc(db, "staff", docId));
        return true;
    } catch (error) {
        console.error("Delete Staff Error:", error);
        return false;
    }
};

// وظيفة لحذف تعليق (للمالك والأدمن فقط)
export const deleteReview = async (commentId) => {
    try {
        await deleteDoc(doc(db, "comments", commentId));
        return true;
    } catch (error) {
        console.error("Delete Review Error:", error);
        return false;
    }
};

export const sendPaymentProofToDiscord = async (orderId, file, orderData) => {
    try {
        const formData = new FormData();

        const charNames = (Array.isArray(orderData.characters) && orderData.characters.length > 0)
            ? orderData.characters.map(c => c.name).join('، ')
            : "غير محدد";

        const payload = {
            content: `� **وصل طلب جديد مع إيصال الدفع!**`,
            embeds: [{
                title: "� طلب تلفيل جديد (انتظار التأكيد)",
                color: 0x00f2fe,
                fields: [
                    { name: "👤 العميل", value: orderData.userName || "مجهول", inline: true },
                    { name: "💎 الفئة", value: orderData.tier || "غير محدد", inline: true },
                    { name: "💵 السعر", value: `${orderData.totalPrice || 0} جنيه`, inline: true },
                    { name: "🗡️ الشخصيات", value: charNames || "لا يوجد" },
                    { name: "🆔 رقم الطلب", value: `\`${orderId}\`` }
                ],
                image: { url: "attachment://receipt.jpg" }, // Discord will use the attached file
                footer: { text: "Professional GS - نظام إدارة المدفوعات المستقل" },
                timestamp: new Date().toISOString()
            }],
            components: [
                {
                    type: 1,
                    components: [
                        {
                            type: 2,
                            label: "تأكيد واستلام الطلب ✅",
                            style: 3,
                            custom_id: `start_${orderId}`
                        },
                        {
                            type: 2,
                            label: "رفض الإيصال ❌",
                            style: 4,
                            custom_id: `reject_${orderId}`
                        }
                    ]
                }
            ]
        };

        formData.append("payload_json", JSON.stringify(payload));
        formData.append("file", file, "receipt.jpg");

        console.log("Sending proof to Discord...");
        const response = await fetch(DISCORD_WEBHOOK + "?wait=true", {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const result = await response.json();
            console.log("Discord Full Response Object:", JSON.stringify(result, null, 2));

            let receiptUrl = null;

            // 1. البحث في المرفقات أولاً
            if (result.attachments && result.attachments.length > 0) {
                const bestAttachment = result.attachments.find(a =>
                    a.filename?.toLowerCase().includes('receipt') ||
                    a.content_type?.includes('image')
                ) || result.attachments[0];
                receiptUrl = bestAttachment.url || bestAttachment.proxy_url;
            }

            // 2. إذا لم ينجد في المرفقات، نبحث داخل الـ Embed (لأننا نستخدم attachment://)
            if (!receiptUrl && result.embeds && result.embeds.length > 0 && result.embeds[0].image) {
                receiptUrl = result.embeds[0].image.url || result.embeds[0].image.proxy_url;
            }

            console.log("Final Receipt URL being saved:", receiptUrl);

            const orderRef = doc(db, "orders", orderId);
            await updateDoc(orderRef, {
                status: "pending_verification",
                hasReceipt: true,
                receiptUrl: receiptUrl,
                discordMessageId: result.id,
                paymentSubmittedAt: serverTimestamp()
            });
            return true;
        } else {
            const errorText = await response.text();
            console.error("Discord Webhook Error:", response.status, errorText);
            return false;
        }
    } catch (error) {
        console.error("sendPaymentProofToDiscord exception:", error);
        return false;
    }
};
export const listenToStaffStats = (email, uid, callback) => {
    // نحدد الـ ID الصحيح للوثيقة (سواء كان إيميلاً أو UID)
    const staff = authorizedStaff.find(s => s.email === email || s.id === email);
    const docId = staff ? staff.id : uid;

    return onSnapshot(doc(db, "staff", docId), (doc) => {
        if (doc.exists()) {
            callback({ id: doc.id, ...doc.data() });
        }
    });
};

export const updateDiscordMessage = async (orderData, newStatus) => {
    if (!orderData.discordMessageId) return;

    let statusText = "بانتظار البدء... ⏳";
    let color = 0x00f2fe;
    let title = "🚀 وصل طلب تلفيل جديد!";

    if (newStatus === 'pending_verification') {
        statusText = "⏳ جاري مراجعة الإيصال من قِبل الإدارة...";
        color = 0x00f2fe;
        title = "💰 فحص عملية الدفع";
    } else if (newStatus === 'waiting') {
        statusText = "✅ تم تأكيد الدفع! بانتظار استلام أحد الموظفين للطلب...";
        color = 0x00ff00;
        title = "🔔 الطلب جاهز للتنفيذ";
    } else if (newStatus === 'working') {
        statusText = `🔥 جارِ العمل بواسطة: ${orderData.workerName}`;
        color = 0x4facfe;
        title = "⚡ جاري تنفيذ الطلب الآن!";
    } else if (newStatus === 'done') {
        statusText = `✅ تم الانتهاء بنجاح! شكراً لتعاملكم معنا.`;
        color = 0x00ff00;
        title = "🎉 تم إكمال الطلب بنجاح!";
    } else if (newStatus === 'rejected') {
        statusText = `❌ نعتذر، تم رفض الطلب أو الإيصال غير صالح.`;
        color = 0xff00c8;
        title = "🚫 الطلب مرفوض";
    }

    const charNames = Array.isArray(orderData.characters)
        ? orderData.characters.map(c => c.name).join('، ')
        : orderData.charName;

    const payload = {
        embeds: [{
            title: title,
            color: color,
            fields: [
                { name: "👤 اسم العميل", value: orderData.userName, inline: true },
                { name: "� الفئة/النوع", value: orderData.tier, inline: true },
                { name: "� السعر", value: `${orderData.totalPrice || 0} ج.م`, inline: true },
                { name: "🗡️ الشخصيات", value: charNames },
                { name: "⏳ الحالة الحالية", value: statusText }
            ],
            thumbnail: { url: orderData.characters?.[0]?.image || orderData.userAvatar },
            image: orderData.receiptUrl ? { url: orderData.receiptUrl } : null,
            footer: { text: "Professional GS - نظام التلفيل الآلي" },
            timestamp: new Date().toISOString()
        }]
    };

    // إخفاء الأزرار إذا اكتمل الطلب أو رُفض
    if (newStatus === 'done' || newStatus === 'rejected') {
        payload.components = [];
    }

    await fetch(`${DISCORD_WEBHOOK}/messages/${orderData.discordMessageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
};

export const updateOrderStatus = async (orderId, newStatus) => {
    try {
        const orderRef = doc(db, "orders", orderId);
        const updateData = { status: newStatus };

        if (newStatus === 'working' && auth.currentUser) {
            updateData.workerId = auth.currentUser.uid;
            updateData.workerName = auth.currentUser.displayName;
            updateData.workerAvatar = auth.currentUser.photoURL;
        }

        await updateDoc(orderRef, updateData);

        // جلب بيانات الطلب
        const snapshot = await getDoc(orderRef);
        if (snapshot.exists()) {
            const orderData = { id: orderId, ...snapshot.data() };

            // --- Robust Staff Upsert Logic ---
            if (newStatus === 'done' && orderData.workerId) {
                // نبحث أولاً إذا كان هناك وثيقة مسجلة بالإيميل (النظام القديم) أو بالـ UID
                const existingStaff = authorizedStaff.find(s => s.email === auth.currentUser.email || s.id === auth.currentUser.email);
                const staffDocId = existingStaff ? existingStaff.id : auth.currentUser.uid;
                const staffRef = doc(db, "staff", staffDocId);
                const userRole = getUserRole(auth.currentUser.email) || 'staff';

                try {
                    // تحديث/إنشاء الوثيقة - سيقوم بإضافة totalEarnings تلقائياً للوثائق القديمة
                    await setDoc(staffRef, {
                        email: auth.currentUser.email,
                        name: auth.currentUser.displayName,
                        totalEarnings: increment(orderData.totalPrice || 0),
                        role: userRole,
                        lastActive: serverTimestamp()
                    }, { merge: true });
                } catch (err) {
                    console.error("Staff Sync Error:", err);
                }
            }

            await updateDiscordMessage(orderData, newStatus);
        }
    } catch (error) {
        console.error("Update Error:", error);
        if (window.showToast) window.showToast("فشل تحديث الحالة.", "❌");
        else alert("فشل تحديث الحالة.");
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

export const listenToUserOrders = (uid, callback) => {
    const q = query(collection(db, "orders"), where("uid", "==", uid));
    return onSnapshot(q, (snapshot) => {
        const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(orders);
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

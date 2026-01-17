import { db, doc, getDoc, updateDoc, serverTimestamp } from './firebase-config.js';

const DISCORD_WEBHOOK = "https://discord.com/api/webhooks/1395038941110866010/MucgrT_399C44lfUVL79HcqR4cfwNbJlL5iG1qPmxdBF47GGbTbmkokZK6YnslmJ63wL";

export const sendToDiscord = async (orderData) => {
    const charNamesFull = Array.isArray(orderData.characters)
        ? orderData.characters.map(c => c.name).filter(Boolean).join('، ')
        : (orderData.charName || "غير محدد");

    // Discord Field value limit is 1024
    const charNames = charNamesFull.length > 1000 ? charNamesFull.substring(0, 1000) + "..." : charNamesFull;

    const payload = {
        content: `📦 **طلب جديد من ${orderData.userName || "عميل"}!**`,
        embeds: [{
            title: "🚀 وصل طلب تلفيل جديد!",
            color: 0x00f2fe,
            fields: [
                { name: "👤 اسم العميل", value: orderData.userName || "مجهول", inline: true },
                { name: "🗡️ الشخصيات", value: charNames || "غير محدد", inline: true },
                { name: "💎 الفئة (Tier)", value: orderData.tier || "غير محدد", inline: true },
                { name: "🆔 رقم الطلب", value: `\`${orderData.orderId || "مجهول"}\`` },
                { name: "⏳ الحالة الحالية", value: "بانتظار الدفع أو البدء... ⏳" }
            ],
            footer: { text: "نظام TEAM GS لإدارة الطلبات" },
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

    const thumbUrl = orderData.characters?.[0]?.image || orderData.charImage || orderData.userAvatar;
    if (thumbUrl && thumbUrl.startsWith('http')) {
        payload.embeds[0].thumbnail = { url: thumbUrl };
    }

    const response = await fetch(DISCORD_WEBHOOK + "?wait=true", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    return await response.json();
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
        statusText = `🔥 جارِ العمل بواسطة: ${orderData.workerName || "موظف"}`;
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
        ? orderData.characters.map(c => c.name).filter(Boolean).join('، ')
        : (orderData.charName || "غير محدد");

    const embed = {
        title: title,
        color: color,
        fields: [
            { name: "👤 اسم العميل", value: orderData.userName || "مجهول", inline: true },
            { name: " الفئة/النوع", value: orderData.tier || "غير محدد", inline: true },
            { name: " السعر", value: `${orderData.totalPrice || 0} ج.م`, inline: true },
            { name: "🗡️ الشخصيات", value: charNames || "غير محدد" },
            { name: "⏳ الحالة الحالية", value: statusText }
        ],
        footer: { text: "TEAM GS - نظام التلفيل الآلي" },
        timestamp: new Date().toISOString()
    };

    // Safe thumbnail
    const thumbUrl = orderData.characters?.[0]?.image || orderData.userAvatar;
    if (thumbUrl && thumbUrl.startsWith('http')) {
        embed.thumbnail = { url: thumbUrl };
    }

    // Safe image (receipt)
    if (orderData.receiptUrl && orderData.receiptUrl.startsWith('http')) {
        embed.image = { url: orderData.receiptUrl };
    }

    const payload = { embeds: [embed] };

    if (newStatus === 'done' || newStatus === 'rejected') {
        payload.components = [];
    }

    try {
        const response = await fetch(`${DISCORD_WEBHOOK}/messages/${orderData.discordMessageId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Discord] PATCH failed (${response.status}):`, errorText);
        }
    } catch (error) {
        console.error("[Discord] Network error during PATCH:", error);
    }
};

export const sendPaymentProofToDiscord = async (orderId, file, orderData, senderWallet) => {
    try {
        const formData = new FormData();

        const orderRef = doc(db, "orders", orderId);
        const snapshot = await getDoc(orderRef);
        const serverOrderData = snapshot.exists() ? snapshot.data() : {};

        const charNamesFull = Array.isArray(orderData.characters)
            ? orderData.characters.map(c => c.name).join('، ')
            : (serverOrderData.characters?.map(c => c.name).join('، ') || orderData.charName || "غير محدد");

        const charNames = charNamesFull.length > 1000 ? charNamesFull.substring(0, 1000) + "..." : charNamesFull;

        const steamInfo = serverOrderData.steamData ? (
            serverOrderData.steamData.method === 'credentials'
                ? `🔐 حساب: \`${serverOrderData.steamData.username}\` | 🔑 باس: ||${serverOrderData.steamData.password}||`
                : `📷 الدخول عبر QR (تواصل مع العميل)`
        ) : 'غير محدد';

        const payload = {
            content: `📢 **وصل طلب جديد مع إيصال الدفع!**`,
            embeds: [{
                title: "💎 طلب تلفيل جديد (انتظار التأكيد)",
                color: 0x00f2fe,
                fields: [
                    { name: "👤 العميل", value: orderData.userName || serverOrderData.userName || "مجهول", inline: true },
                    { name: "💎 الفئة", value: orderData.tier || serverOrderData.tier || "غير محدد", inline: true },
                    { name: "💵 السعر", value: `${orderData.totalPrice || serverOrderData.totalPrice || 0} جنيه`, inline: true },
                    { name: "💳 رقم المحول", value: `\`${senderWallet || "غير معروف"}\``, inline: true },
                    { name: "🗡️ الشخصيات", value: charNames },
                    { name: "🔐 بيانات الدخول", value: steamInfo },
                    { name: "🆔 رقم الطلب", value: `\`${orderId}\`` }
                ],
                image: { url: "attachment://receipt.jpg" },
                footer: { text: "TEAM GS - نظام إدارة المدفوعات المستقل" },
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

        const response = await fetch(DISCORD_WEBHOOK + "?wait=true", {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const result = await response.json();
            let receiptUrl = null;

            if (result.attachments && result.attachments.length > 0) {
                const bestAttachment = result.attachments.find(a =>
                    a.filename?.toLowerCase().includes('receipt') ||
                    a.content_type?.includes('image')
                ) || result.attachments[0];
                receiptUrl = bestAttachment.url || bestAttachment.proxy_url;
            }

            if (!receiptUrl && result.embeds && result.embeds.length > 0 && result.embeds[0].image) {
                receiptUrl = result.embeds[0].image.url || result.embeds[0].image.proxy_url;
            }

            await updateDoc(orderRef, {
                status: "pending_verification",
                hasReceipt: true,
                receiptUrl: receiptUrl,
                senderWallet: senderWallet,
                discordMessageId: result.id,
                paymentSubmittedAt: serverTimestamp()
            });
            return true;
        } else {
            return false;
        }
    } catch (error) {
        console.error("sendPaymentProofToDiscord exception:", error);
        return false;
    }
};

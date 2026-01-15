const DISCORD_WEBHOOK = "https://discord.com/api/webhooks/1395038941110866010/MucgrT_399C44lfUVL79HcqR4cfwNbJlL5iG1qPmxdBF47GGbTbmkokZK6YnslmJ63wL";

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
                { name: " الفئة/النوع", value: orderData.tier, inline: true },
                { name: " السعر", value: `${orderData.totalPrice || 0} ج.م`, inline: true },
                { name: "🗡️ الشخصيات", value: charNames },
                { name: "⏳ الحالة الحالية", value: statusText }
            ],
            thumbnail: { url: orderData.characters?.[0]?.image || orderData.userAvatar },
            image: orderData.receiptUrl ? { url: orderData.receiptUrl } : null,
            footer: { text: "Professional GS - نظام التلفيل الآلي" },
            timestamp: new Date().toISOString()
        }]
    };

    if (newStatus === 'done' || newStatus === 'rejected') {
        payload.components = [];
    }

    await fetch(`${DISCORD_WEBHOOK}/messages/${orderData.discordMessageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
};

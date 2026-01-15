// app.js - المركز الرئيسي (Barrel/Facade)
// هذا الملف الآن يعمل كمنسق بين جميع الخدمات الفرعية لتقليل حجم الكود وتحسين التنظيم.

import { auth } from './firebase-config.js';

// 1. استيراد كافة الخدمات
export * from './auth_service.js';
export * from './character_service.js';
export * from './chat_service.js';
export * from './order_service.js';
export * from './staff_service.js';
export * from './discord_service.js';
export * from './ui_utils.js';
export * from './operations_service.js';

// 2. تصدير وظائف إضافية أو مركبة إذا لزم الأمر
import { sendPaymentProofToDiscord as discordSendPayment } from './discord_service.js';
import { updateDoc, doc, db, serverTimestamp } from './firebase-config.js';

export const sendPaymentProofToDiscord = async (orderId, file, orderData, senderWallet) => {
    // هذه الوظيفة تتواجد هنا للحفاظ على التوافق مع التوقيع القديم إذا لزم الأمر
    // أو يمكن تصديرها مباشرة من discord_service.js
    return await discordSendPayment(orderId, file, orderData, senderWallet);
};

// 3. التعرض العالمي (للحفاظ على عمل الـ onclick في الـ HTML)
import { 
    openOperationsModal, closeOperationsModal, handleOpsSearch, closeOpsDetailsModal 
} from './operations_service.js';
import { openChat, closeChat, handleSendMessage, handleSendImage } from './chat_service.js';
import { showToast, showConfirm } from './ui_utils.js';

window.openOperationsModal = openOperationsModal;
window.closeOperationsModal = closeOperationsModal;
window.handleOpsSearch = handleOpsSearch;
window.closeOpsDetailsModal = closeOpsDetailsModal;
window.openChat = openChat;
window.closeChat = closeChat;
window.handleSendMessage = handleSendMessage;
window.handleSendImage = handleSendImage;
window.showToast = showToast;
window.showConfirm = showConfirm;

console.log("PRO GS - Modular App Initialized 🚀");

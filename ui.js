import { auth, logout, openOperationsModal, closeOperationsModal, handleOpsSearch, closeOpsDetailsModal, closeChat, handleSendMessage, handleSendImage, getUserRole, listenToWorkers, isWorker, hasPermission } from './app.js';
import { onAuthStateChanged, db, doc, getDoc } from './firebase-config.js';

export const injectNavbar = () => {
    let header = document.getElementById('navbar-placeholder') || document.querySelector('nav.nav-bar');
    if (!header) {
        header = document.createElement('nav');
        document.body.prepend(header);
    }
    header.className = 'nav-bar';
    header.innerHTML = `
        <div class="user-info" id="userInfo"></div>
        <a href="index.html" class="logo" style="text-decoration: none; font-family: var(--font-en); font-weight: 800; color: var(--primary);">TEAM GS</a>
    `;
};

export const injectSharedModals = () => {
    let container = document.getElementById('shared-modals-placeholder') || document.getElementById('shared-modals-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'shared-modals-container';
        document.body.appendChild(container);
    }

    container.innerHTML = `
        <!-- Toast Container -->
        <div id="toastContainer" class="toast-container"></div>

        <!-- Confirm Modal -->
        <div id="confirmModal" class="notif-overlay">
            <div class="notif-card" style="max-width: 400px; text-align: center;">
                <div id="confirmMsg" style="margin-bottom: 20px; font-size: 1.1rem;"></div>
                <div style="display: flex; gap: 10px;">
                    <button id="confirmYes" class="notif-btn" style="flex: 1;">نعم</button>
                    <button id="confirmNo" class="notif-btn" style="flex: 1; background: var(--glass);">إلغاء</button>
                </div>
            </div>
        </div>

        <!-- Operations Modal -->
        <div id="operationsModal" class="notif-overlay">
            <div class="notif-card" style="max-width: 600px; width: 95%;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h3 style="margin: 0;">سجل العمليات 📂</h3>
                    <button class="auth-btn" style="background:none; border:none; font-size:1.2rem; padding:0;" onclick="closeOperationsModal()">✖</button>
                </div>
                <div class="search-container">
                    <input type="text" id="opsSearchInput" placeholder="بحث برقم الطلب (Order ID)..." class="search-input">
                    <button class="search-btn" onclick="handleOpsSearch()">🔍</button>
                </div>
                <div id="opsList" class="ops-list">
                    <div class="ops-loading">جاري التحميل...</div>
                </div>
            </div>
        </div>

        <!-- Operations Details Modal -->
        <div id="opsDetailsModal" class="notif-overlay">
            <div class="notif-card" style="max-width: 500px; width: 95%;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h3 style="margin: 0;">تفاصيل العملية 📄</h3>
                    <button class="auth-btn" style="background:none; border:none; font-size:1.2rem; padding:0;" onclick="closeOpsDetailsModal()">✖</button>
                </div>
                <div id="opsDetailsContent"></div>
                <button class="notif-btn" style="width: 100%; mt: 20px;" onclick="closeOpsDetailsModal()">إغلاق</button>
            </div>
        </div>

        <!-- Chat Modal -->
        <div id="chatModal" class="chat-modal">
            <div class="chat-container">
                <div class="chat-header">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="position:relative;">
                            <img id="chatTargetAvatar" src="" style="width:35px; height:35px; border-radius:50%; border:1px solid var(--primary)">
                            <div style="position:absolute; bottom:0; right:0; width:10px; height:10px; background:#00ff00; border-radius:50%; border:2px solid #000;"></div>
                        </div>
                        <div>
                            <div id="chatTargetName" style="font-weight:bold; font-size:0.9rem;">اسم الطرف الآخر</div>
                            <div style="font-size:0.7rem; color:var(--text-dim);">متصل الآن</div>
                        </div>
                    </div>
                    <button class="auth-btn" style="background:none; border:none; font-size:1.2rem; padding:0;" onclick="closeChat()">✖</button>
                </div>
                <div id="chatMessages" class="chat-messages">
                    <div class="chat-empty">جاري تحميل الرسائل...</div>
                </div>
                <div id="uploadProgress" style="display:none; padding:10px; background:rgba(0,242,254,0.1); font-size:0.8rem; text-align:center; color:var(--primary);">
                    ⏳ جاري رفع الملف...
                </div>
                <div class="chat-input-area">
                    <input type="file" id="chatImageInput" accept="image/*" hidden>
                    <button id="chatImageBtn" class="chat-send-btn" style="background:rgba(255,255,255,0.1); font-size:1.1rem;">📸</button>
                    <input type="text" id="chatInput" placeholder="اكتب رسالتك هنا..." autocomplete="off">
                    <button id="sendMessageBtn" class="chat-send-btn">🕊️</button>
                </div>
            </div>
        </div>
    `;

    // Setup Event Listeners for Chat
    const chatInput = document.getElementById('chatInput');
    const imageInput = document.getElementById('chatImageInput');
    const imageBtn = document.getElementById('chatImageBtn');
    const sendBtn = document.getElementById('sendMessageBtn');

    if (chatInput) chatInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSendMessage();
        }
    };
    if (sendBtn) sendBtn.onclick = handleSendMessage;
    if (imageBtn) imageBtn.onclick = () => imageInput.click();
    if (imageInput) imageInput.onchange = (e) => handleSendImage(e.target.files[0]);

    // Expose close functions to window for onclick handlers
    window.closeOperationsModal = closeOperationsModal;
    window.closeOpsDetailsModal = closeOpsDetailsModal;
    window.handleOpsSearch = handleOpsSearch;
    window.closeChat = closeChat;
};

// --- User Interface Refresh (Shared) ---
export const refreshUserUI = async () => {
    const userInfo = document.getElementById('userInfo');
    if (!userInfo) return;

    const user = auth.currentUser;
    if (user) {
        const rolesData = await import('./auth_service.js').then(m => m.getRolesData());
        const isStaff = await isWorker(user.email);
        const userRoles = (getUserRole(user.email) || 'client').split(',').map(r => r.trim());
        const hasAccessToOwner = hasPermission(user.email, 'access_owner_dashboard') ||
            userRoles.some(r => ['owner', 'admin', 'dev', 'creator'].includes(r));

        userInfo.innerHTML = `
            <div class="user-dropdown">
                <div class="user-trigger">
                    <div class="user-details">
                        <span class="user-name">${user.displayName}</span>
                        <div class="user-role" style="display: flex; gap: 5px; flex-wrap: wrap;">
                            ${userRoles.map(r => {
            const roleId = r.trim();
            const rData = rolesData.find(rd => rd.id === roleId);
            if (roleId === 'owner') return `<span class="role-owner">👑 المالك</span>`;
            if (roleId === 'admin') return `<span class="role-admin" style="background:rgba(255,0,0,0.1); color:#ff4d4d; padding:2px 8px; border-radius:4px; border:1px solid rgba(255,0,0,0.3);">🛡️ أدمن</span>`;
            if (roleId === 'staff') return `<span class="role-staff" style="background:rgba(187,134,252,0.1); color:#bb86fc; padding:2px 8px; border-radius:4px; border:1px solid rgba(187,134,252,0.3);">🛠️ موظف</span>`;
            if (rData) {
                return `<span style="color: ${rData.color || 'var(--primary)'}; background:rgba(255,255,255,0.05); padding:2px 8px; border-radius:4px; border:1px solid var(--glass-border);">${rData.icon || '🛡️'} ${rData.name}</span>`;
            }
            return `<span class="role-client">👤 عميل</span>`;
        }).join('')}
                        </div>
                    </div>
                    <img src="${user.photoURL}" class="user-avatar">
                </div>
                <div class="notification-bell" id="notificationBell" style="position: relative; cursor: pointer; margin-left: 15px;">
                    <span style="font-size: 1.5rem;">🔔</span>
                    <span id="notificationBadge" class="notification-badge" style="display: none;">0</span>
                    <div id="notificationDropdown" class="notification-dropdown" style="display: none;">
                        <div class="notification-header">
                            <h4 style="margin: 0; font-size: 0.9rem;">الإشعارات</h4>
                            <button id="markAllRead" class="mark-all-btn">تمييز الكل كمقروء</button>
                        </div>
                        <div id="notificationList" class="notification-list">
                            <div class="notification-empty">لا توجد إشعارات</div>
                        </div>
                    </div>
                </div>
                <div class="dropdown-menu">
                    <a href="profile.html">👤 ملفي الشخصي</a>
                    <a href="history.html">📦 طلباتي</a>
                    ${isStaff ? `<a href="workers.html">🛠️ لوحة العمل</a>` : ''}
                    ${hasAccessToOwner ? `<a href="owner_dashboard.html" style="color: var(--accent);">🗝️ لوحة المالك</a>` : ''}
                    <hr style="border:0; border-top:1px solid var(--glass-border); margin:5px 0;">
                    <button onclick="handleLogout()" class="dropdown-btn logout-btn">تسجيل الخروج 🚪</button>
                </div>
            </div>
        `;
    } else {
        userInfo.innerHTML = `
            <button onclick="handleLogin()" class="auth-btn">تسجيل الدخول 👋</button>
        `;
    }
};

export const initSharedUI = () => {
    injectNavbar();
    injectSharedModals();
    listenToWorkers(() => refreshUserUI());
    onAuthStateChanged(auth, (user) => {
        refreshUserUI();
        if (user) {
            initNotificationSystem();
        }
    });

    // Setup notification bell click handler
    setupNotificationHandlers();
};

// Initialize notification system
const initNotificationSystem = async () => {
    try {
        const { listenToNotifications, markAsRead, markAllAsRead } = await import('./notifications_service.js');

        listenToNotifications((notifications, unreadCount) => {
            renderNotifications(notifications);
        });
    } catch (error) {
        console.error('[UI] Error initializing notifications:', error);
    }
};

// Setup notification handlers
const setupNotificationHandlers = () => {
    const bell = document.getElementById('notificationBell');
    const dropdown = document.getElementById('notificationDropdown');
    const markAllBtn = document.getElementById('markAllRead');

    if (bell && dropdown) {
        bell.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = dropdown.style.display === 'block';
            dropdown.style.display = isVisible ? 'none' : 'block';
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!bell.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });
    }

    if (markAllBtn) {
        markAllBtn.addEventListener('click', async () => {
            const { markAllAsRead } = await import('./notifications_service.js');
            await markAllAsRead();
        });
    }
};

// Render notifications
const renderNotifications = (notifications) => {
    const list = document.getElementById('notificationList');
    if (!list) return;

    if (notifications.length === 0) {
        list.innerHTML = '<div class="notification-empty">لا توجد إشعارات</div>';
        return;
    }

    list.innerHTML = notifications.map(notif => {
        const timeAgo = getTimeAgo(notif.timestamp);
        const unreadClass = notif.read ? '' : 'unread';

        return `
            <div class="notification-item ${unreadClass}" data-id="${notif.id}" onclick="handleNotificationClick('${notif.id}', '${notif.orderId || ''}')">
                <div class="notification-icon" style="background: ${notif.color}20; color: ${notif.color};">
                    ${notif.icon}
                </div>
                <div class="notification-content">
                    <div class="notification-title">${notif.title}</div>
                    <div class="notification-message">${notif.message}</div>
                    <div class="notification-time">${timeAgo}</div>
                </div>
                ${!notif.read ? '<div class="notification-dot"></div>' : ''}
            </div>
        `;
    }).join('');
};

// Handle notification click
window.handleNotificationClick = async (notifId, orderId) => {
    const { markAsRead } = await import('./notifications_service.js');
    await markAsRead(notifId);

    // Navigate to order if orderId exists
    if (orderId) {
        window.location.href = `history.html?order=${orderId}`;
    }
};

// Get time ago string
const getTimeAgo = (timestamp) => {
    if (!timestamp) return 'الآن';

    const now = new Date();
    const time = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const diff = Math.floor((now - time) / 1000); // seconds

    if (diff < 60) return 'الآن';
    if (diff < 3600) return `منذ ${Math.floor(diff / 60)} دقيقة`;
    if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} ساعة`;
    if (diff < 604800) return `منذ ${Math.floor(diff / 86400)} يوم`;
    return time.toLocaleDateString('ar-EG');
};

export const initNavbar = initSharedUI; // Alias for backward compatibility

// Global Exposure for UI actions
window.handleLogout = logout;
window.handleLogin = () => import('./app.js').then(m => m.login());
window.openOperationsModal = openOperationsModal;

import { db, collection, query, orderBy, onSnapshot, getDoc, doc, where, limit } from './firebase-config.js';

let opsUnsubscribe = null;
const statusMap = {
    'awaiting_payment': '💸 بانتظار الدفع',
    'pending_verification': '⏳ مراجعة الإيصال',
    'waiting': '⏰ بانتظار البدء',
    'working': '🔥 جارِ العمل',
    'done': '✅ مكتمل',
    'rejected': '❌ مرفوض'
};

export const openOperationsModal = () => {
    document.getElementById('operationsModal')?.classList.add('visible');
    loadRecentOperations();
};

export const closeOperationsModal = () => {
    document.getElementById('operationsModal')?.classList.remove('visible');
    if (opsUnsubscribe) opsUnsubscribe();
};

export const loadRecentOperations = () => {
    const opsList = document.getElementById('opsList');
    if (!opsList) return;

    if (opsUnsubscribe) opsUnsubscribe();

    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(20));
    opsUnsubscribe = onSnapshot(q, (snapshot) => {
        opsList.innerHTML = '';
        snapshot.docs.forEach(doc => {
            const order = { id: doc.id, ...doc.data() };
            const item = document.createElement('div');
            item.className = 'ops-item';
            item.innerHTML = `
                <div class="ops-info">
                    <strong>#${order.id.slice(0, 8)}</strong>
                    <span class="ops-status ${order.status}">${statusMap[order.status] || order.status}</span>
                </div>
                <div style="font-size:0.8rem; color:var(--text-dim);">${order.userName} - ${order.tier}</div>
            `;
            item.onclick = () => viewOpDetails(order);
            opsList.appendChild(item);
        });
    });
};

export const handleOpsSearch = async () => {
    const input = document.getElementById('opsSearchInput');
    const opsList = document.getElementById('opsList');
    if (!input || !opsList) return;

    const term = input.value.trim();
    if (!term) {
        loadRecentOperations();
        return;
    }

    opsList.innerHTML = '<div class="ops-loading">جاري البحث...</div>';
    try {
        const orderRef = doc(db, "orders", term);
        const snapshot = await getDoc(orderRef);
        opsList.innerHTML = '';
        if (snapshot.exists()) {
            const order = { id: snapshot.id, ...snapshot.data() };
            const item = document.createElement('div');
            item.className = 'ops-item';
            item.innerHTML = `
                <div class="ops-info">
                    <strong>#${order.id.slice(0, 8)}</strong>
                    <span class="ops-status ${order.status}">${statusMap[order.status] || order.status}</span>
                </div>
                <div style="font-size:0.8rem; color:var(--text-dim);">${order.userName} - ${order.tier}</div>
            `;
            item.onclick = () => viewOpDetails(order);
            opsList.appendChild(item);
        } else {
            opsList.innerHTML = '<div class="ops-empty">لم يتم العثور على الطلب ❌</div>';
        }
    } catch (error) {
        opsList.innerHTML = '<div class="ops-empty">خطأ في البحث ❌</div>';
    }
};

export const viewOpDetails = (order) => {
    const detailsModal = document.getElementById('opsDetailsModal');
    const content = document.getElementById('opsDetailsContent');
    if (!detailsModal || !content) return;

    content.innerHTML = `
        <div class="ops-details-card">
            <p><strong>رقم الطلب:</strong> ${order.id}</p>
            <p><strong>العميل:</strong> ${order.userName}</p>
            <p><strong>الفئة:</strong> ${order.tier}</p>
            <p><strong>السعر:</strong> ${order.totalPrice} ج.م</p>
            <p><strong>الحالة:</strong> ${statusMap[order.status] || order.status}</p>
            <p><strong>رقم المحول:</strong> ${order.senderWallet || 'لا يوجد'}</p>
            ${order.receiptUrl ? `
                <p><strong>الإيصال:</strong></p>
                <img src="${order.receiptUrl}" style="width:100%; border-radius:10px; border:1px solid var(--glass-border); cursor:pointer;" onclick="window.open('${order.receiptUrl}', '_blank')">
            ` : ''}
        </div>
    `;
    detailsModal.classList.add('visible');
};

export const closeOpsDetailsModal = () => {
    document.getElementById('opsDetailsModal')?.classList.remove('visible');
};

export const showToast = (message, icon = 'ℹ️') => {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

export const showConfirm = (message, onConfirm) => {
    const modal = document.getElementById('confirmModal');
    const msg = document.getElementById('confirmMsg');
    const yesBtn = document.getElementById('confirmYes');
    const noBtn = document.getElementById('confirmNo');
    if (!modal || !msg || !yesBtn || !noBtn) return;

    msg.innerText = message;
    modal.classList.add('visible');

    const close = () => modal.classList.remove('visible');
    yesBtn.onclick = () => { onConfirm(); close(); };
    noBtn.onclick = close;
};

/**
 * app.js — Core Application Logic
 * Handles refill submissions, approvals, warnings, and real-time data.
 */

const App = (() => {
    // ── Toast Notification ─────────────────────────────────────────────────
    function showToast(title, message, type = 'info', duration = 4000) {
        const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️', water: '💧' };
        const container = document.getElementById('toast-container') || createToastContainer();
        const toast = document.createElement('div');
        toast.className = 'toast fade-in';
        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <div class="toast-body">
                <div class="toast-title">${title}</div>
                ${message ? `<div class="toast-msg">${message}</div>` : ''}
            </div>
        `;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(20px)';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    function createToastContainer() {
        const el = document.createElement('div');
        el.id = 'toast-container';
        el.className = 'toast-container';
        document.body.appendChild(el);
        return el;
    }

    // ── Confirm Dialog ─────────────────────────────────────────────────────
    function confirm(title, message, confirmLabel = 'Confirm', danger = false) {
        return new Promise(resolve => {
            const overlay = document.getElementById('confirm-overlay');
            if (!overlay) { resolve(false); return; }
            overlay.querySelector('.confirm-title').textContent = title;
            overlay.querySelector('.confirm-msg').textContent   = message;
            const btn = overlay.querySelector('.confirm-ok');
            btn.textContent = confirmLabel;
            btn.className = `btn ${danger ? 'btn-danger' : 'btn-primary'} btn-sm`;
            overlay.classList.add('open');
            const ok = () => { cleanup(); resolve(true); };
            const cancel = () => { cleanup(); resolve(false); };
            const cleanup = () => {
                overlay.classList.remove('open');
                btn.removeEventListener('click', ok);
                overlay.querySelector('.confirm-cancel').removeEventListener('click', cancel);
            };
            btn.addEventListener('click', ok, { once: true });
            overlay.querySelector('.confirm-cancel').addEventListener('click', cancel, { once: true });
        });
    }

    // ── Submit Refill ──────────────────────────────────────────────────────
    async function submitRefill(photoFile, notes) {
        const user = Auth.getUser();
        const profile = Auth.getProfile();
        if (!user) { showToast('Not signed in', '', 'error'); return null; }

        try {
            let photoURL = null;
            if (photoFile) {
                const ref = storage.ref(`refills/${user.uid}/${Date.now()}_${photoFile.name}`);
                const snap = await ref.put(photoFile);
                photoURL = await snap.ref.getDownloadURL();
            }
            const doc = await db.collection(CONFIG.COLLECTIONS.REFILLS).add({
                uid: user.uid,
                userName: profile?.name || user.displayName || 'User',
                userEmail: user.email,
                userPhoto: profile?.photoURL || user.photoURL || null,
                date: new Date().toISOString().split('T')[0],
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                photoURL,
                notes: notes?.trim() || '',
                status: 'pending',
                approvedBy: null,
                approvedAt: null,
                approverName: null,
                rejectedReason: null
            });
            showToast('Refill submitted! 💧', 'Waiting for approval.', 'success');
            Notifications.sendToApprovers('New refill submitted', `${profile?.name} submitted a refill request.`);
            return doc.id;
        } catch (e) {
            console.error(e);
            showToast('Upload failed', e.message, 'error');
            return null;
        }
    }

    // ── Approve Refill ─────────────────────────────────────────────────────
    async function approveRefill(refillId, submitterEmail) {
        const profile = Auth.getProfile();
        if (!Auth.isApproverUser()) { showToast('Not authorized', '', 'error'); return; }
        try {
            await db.collection(CONFIG.COLLECTIONS.REFILLS).doc(refillId).update({
                status: 'approved',
                approvedBy: Auth.getUserId(),
                approverName: profile?.name || 'Approver',
                approvedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showToast('Refill approved ✅', '', 'success');
            Notifications.sendToUser(submitterEmail, 'Refill approved!', `${profile?.name} approved your refill.`);
        } catch (e) {
            showToast('Error', e.message, 'error');
        }
    }

    // ── Reject Refill ──────────────────────────────────────────────────────
    async function rejectRefill(refillId, submitterEmail, reason = '') {
        const profile = Auth.getProfile();
        if (!Auth.isApproverUser()) { showToast('Not authorized', '', 'error'); return; }
        try {
            await db.collection(CONFIG.COLLECTIONS.REFILLS).doc(refillId).update({
                status: 'rejected',
                approvedBy: Auth.getUserId(),
                approverName: profile?.name || 'Approver',
                approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
                rejectedReason: reason
            });
            showToast('Refill rejected ❌', '', 'warning');
            Notifications.sendToUser(submitterEmail, 'Refill rejected', `${profile?.name} rejected your refill request.`);
        } catch (e) {
            showToast('Error', e.message, 'error');
        }
    }

    // ── Send Low Water Warning ─────────────────────────────────────────────
    async function sendWarning(message) {
        const user = Auth.getUser();
        const profile = Auth.getProfile();
        if (!user) return;
        try {
            await db.collection(CONFIG.COLLECTIONS.WARNINGS).add({
                uid: user.uid,
                userName: profile?.name || user.displayName || 'User',
                message: message || '⚠️ Water level is low. Refill needed.',
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            showToast('Warning sent ⚠️', 'All family members notified.', 'warning');
            Notifications.sendToAll('Low water warning ⚠️', message || 'Water level is low. Refill needed.');
        } catch (e) {
            showToast('Error', e.message, 'error');
        }
    }

    // ── Real-time Feed ─────────────────────────────────────────────────────
    function subscribeToRefills(callback, limitN = 20) {
        return db.collection(CONFIG.COLLECTIONS.REFILLS)
            .orderBy('timestamp', 'desc')
            .limit(limitN)
            .onSnapshot(snap => {
                const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                callback(items);
            });
    }

    function subscribeToPending(callback) {
        return db.collection(CONFIG.COLLECTIONS.REFILLS)
            .where('status', '==', 'pending')
            .orderBy('timestamp', 'desc')
            .onSnapshot(snap => {
                const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                callback(items);
            });
    }

    function subscribeToWarnings(callback, limitN = 10) {
        return db.collection(CONFIG.COLLECTIONS.WARNINGS)
            .orderBy('timestamp', 'desc')
            .limit(limitN)
            .onSnapshot(snap => {
                const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                callback(items);
            });
    }

    function subscribeToMyRefills(uid, callback) {
        return db.collection(CONFIG.COLLECTIONS.REFILLS)
            .where('uid', '==', uid)
            .orderBy('timestamp', 'desc')
            .limit(30)
            .onSnapshot(snap => {
                const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                callback(items);
            });
    }

    // ── Monthly Report ─────────────────────────────────────────────────────
    async function getMonthlyReport(year, month) {
        const start = new Date(year, month, 1).toISOString().split('T')[0];
        const end   = new Date(year, month + 1, 0).toISOString().split('T')[0];
        const snap  = await db.collection(CONFIG.COLLECTIONS.REFILLS)
            .where('date', '>=', start)
            .where('date', '<=', end)
            .get();
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Aggregate per user
        const byUser = {};
        all.forEach(r => {
            if (!byUser[r.userName]) byUser[r.userName] = { total: 0, approved: 0, pending: 0, rejected: 0 };
            byUser[r.userName].total++;
            byUser[r.userName][r.status] = (byUser[r.userName][r.status] || 0) + 1;
        });

        const warnSnap = await db.collection(CONFIG.COLLECTIONS.WARNINGS)
            .where('timestamp', '>=', new Date(year, month, 1))
            .where('timestamp', '<=', new Date(year, month + 1, 0))
            .get();

        return {
            total: all.length,
            approved: all.filter(r => r.status === 'approved').length,
            rejected: all.filter(r => r.status === 'rejected').length,
            pending: all.filter(r => r.status === 'pending').length,
            warnings: warnSnap.size,
            byUser,
            refills: all
        };
    }

    // ── Lightbox ───────────────────────────────────────────────────────────
    function openLightbox(src) {
        const lb = document.getElementById('lightbox');
        if (!lb) return;
        lb.querySelector('img').src = src;
        lb.classList.add('open');
    }

    function initLightbox() {
        const lb = document.getElementById('lightbox');
        if (!lb) return;
        lb.addEventListener('click', () => lb.classList.remove('open'));
    }

    // ── Theme ──────────────────────────────────────────────────────────────
    function initTheme() {
        const saved = localStorage.getItem('aqua-theme') || CONFIG.DEFAULT_THEME;
        applyTheme(saved);
    }

    function applyTheme(theme) {
        const t = theme === 'system'
            ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
            : theme;
        document.documentElement.setAttribute('data-theme', t);
        localStorage.setItem('aqua-theme', theme);
        // Update toggle icon
        document.querySelectorAll('.theme-toggle-icon').forEach(el => {
            el.textContent = t === 'dark' ? '☀️' : '🌙';
        });
    }

    function toggleTheme() {
        const curr = document.documentElement.getAttribute('data-theme');
        applyTheme(curr === 'dark' ? 'light' : 'dark');
    }

    // ── Helpers ────────────────────────────────────────────────────────────
    function formatTime(ts) {
        if (!ts) return '';
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function formatDate(ts) {
        if (!ts) return '';
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function timeAgo(ts) {
        if (!ts) return '';
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        const diff = (Date.now() - d.getTime()) / 1000;
        if (diff < 60)   return 'just now';
        if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
        if (diff < 86400)return `${Math.floor(diff/3600)}h ago`;
        return `${Math.floor(diff/86400)}d ago`;
    }

    function getInitials(name) {
        return (name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2);
    }

    function getStatusBadge(status) {
        const map = {
            pending:  '<span class="badge badge-pending">⏳ Pending</span>',
            approved: '<span class="badge badge-approved">✅ Approved</span>',
            rejected: '<span class="badge badge-rejected">❌ Rejected</span>'
        };
        return map[status] || '';
    }

    function avatarHTML(photoURL, name, size = 40) {
        const ini = getInitials(name);
        if (photoURL) return `<div class="feed-avatar" style="width:${size}px;height:${size}px"><img src="${photoURL}" alt="${name}"></div>`;
        return `<div class="feed-avatar" style="width:${size}px;height:${size}px;font-size:${size*0.35}px">${ini}</div>`;
    }

    function buildFeedItem(r, showActions = false) {
        return `
        <div class="feed-item fade-in" data-id="${r.id}">
            ${avatarHTML(r.userPhoto, r.userName)}
            <div class="feed-body">
                <div class="feed-header">
                    <span class="feed-name">${r.userName}</span>
                    <div style="display:flex;gap:8px;align-items:center">
                        ${getStatusBadge(r.status)}
                        <span class="feed-time">${timeAgo(r.timestamp)}</span>
                    </div>
                </div>
                ${r.notes ? `<div class="feed-note">📝 ${r.notes}</div>` : ''}
                ${r.approverName && r.status !== 'pending' ? `<div class="feed-note" style="font-size:0.78rem">
                    ${r.status === 'approved' ? '✅' : '❌'} by ${r.approverName} · ${formatDate(r.approvedAt)}
                </div>` : ''}
                ${r.photoURL ? `<div class="feed-photo" onclick="App.openLightbox('${r.photoURL}')">
                    <img src="${r.photoURL}" alt="Refill photo" loading="lazy">
                </div>` : ''}
                ${showActions && r.status === 'pending' ? `
                <div class="feed-actions">
                    <button class="btn btn-success btn-sm" onclick="App.handleApprove('${r.id}','${r.userEmail}')">✅ Approve</button>
                    <button class="btn btn-danger btn-sm" onclick="App.handleReject('${r.id}','${r.userEmail}')">❌ Reject</button>
                </div>` : ''}
            </div>
        </div>`;
    }

    // Public approve/reject with confirm dialogs
    async function handleApprove(id, email) {
        const ok = await confirm('Approve this refill?', 'This will mark the refill as approved and notify the user.', 'Approve');
        if (ok) approveRefill(id, email);
    }

    async function handleReject(id, email) {
        const ok = await confirm('Reject this refill?', 'The user will be notified that their refill was rejected.', 'Reject', true);
        if (ok) rejectRefill(id, email, '');
    }

    // ── PWA Install ────────────────────────────────────────────────────────
    let deferredPrompt = null;
    function initPWA() {
        window.addEventListener('beforeinstallprompt', e => {
            e.preventDefault();
            deferredPrompt = e;
            const banner = document.getElementById('install-banner');
            if (banner) banner.classList.add('show');
        });
        document.getElementById('install-btn')?.addEventListener('click', async () => {
            if (!deferredPrompt) return;
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            deferredPrompt = null;
            document.getElementById('install-banner')?.classList.remove('show');
        });
        document.getElementById('install-dismiss')?.addEventListener('click', () => {
            document.getElementById('install-banner')?.classList.remove('show');
        });
    }

    return {
        showToast, confirm,
        submitRefill, approveRefill, rejectRefill, sendWarning,
        subscribeToRefills, subscribeToPending, subscribeToWarnings, subscribeToMyRefills,
        getMonthlyReport,
        openLightbox, initLightbox,
        initTheme, toggleTheme, applyTheme,
        formatTime, formatDate, timeAgo, getInitials, getStatusBadge, buildFeedItem,
        handleApprove, handleReject,
        initPWA
    };
})();

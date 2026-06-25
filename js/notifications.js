/**
 * notifications.js — Push Notifications Module
 * Firebase Cloud Messaging + Web Push API + daily reminders.
 */

const Notifications = (() => {
    let swRegistration = null;

    // ── Register Service Worker ────────────────────────────────────────────
    async function registerSW() {
        if (!('serviceWorker' in navigator)) return null;
        try {
            swRegistration = await navigator.serviceWorker.register('/service-worker.js');
            console.log('Service Worker registered:', swRegistration.scope);
            return swRegistration;
        } catch (e) {
            console.error('SW registration failed:', e);
            return null;
        }
    }

    // ── Request Permission & Get FCM Token ─────────────────────────────────
    async function requestPermission() {
        if (!CONFIG.ENABLE_PUSH_NOTIFICATIONS) return null;
        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') return null;

            if (!messaging) return null;
            const token = await messaging.getToken({ vapidKey: CONFIG.VAPID_KEY });
            if (token) await saveToken(token);
            return token;
        } catch (e) {
            console.warn('Push notification setup:', e.message);
            return null;
        }
    }

    // ── Save Token to Firestore ────────────────────────────────────────────
    async function saveToken(token) {
        const uid = Auth.getUserId();
        if (!uid || !token) return;
        try {
            await db.collection(CONFIG.COLLECTIONS.USERS).doc(uid).update({ fcmToken: token });
        } catch (e) {
            console.warn('Token save error:', e);
        }
    }

    // ── Listen for Foreground Messages ─────────────────────────────────────
    function listenForeground() {
        if (!messaging) return;
        messaging.onMessage(payload => {
            const { title, body } = payload.notification || {};
            App.showToast(title || 'Notification', body || '', 'info');
        });
    }

    // ── Send Notification to All Users (stored in Firestore for polling) ───
    async function sendToAll(title, body) {
        await storeNotification({ title, body, target: 'all', read: false });
    }

    async function sendToApprovers(title, body) {
        await storeNotification({ title, body, target: 'approvers', read: false });
    }

    async function sendToUser(email, title, body) {
        await storeNotification({ title, body, target: email, read: false });
    }

    async function storeNotification(data) {
        try {
            await db.collection(CONFIG.COLLECTIONS.NOTIFICATIONS).add({
                ...data,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (e) {
            console.warn('Notification store error:', e);
        }
    }

    // ── Subscribe to Notifications (real-time) ─────────────────────────────
    function subscribeToNotifications(callback) {
        const user = Auth.getUser();
        const profile = Auth.getProfile();
        if (!user) return () => {};

        return db.collection(CONFIG.COLLECTIONS.NOTIFICATIONS)
            .orderBy('timestamp', 'desc')
            .limit(20)
            .onSnapshot(snap => {
                const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                const mine = all.filter(n =>
                    n.target === 'all' ||
                    n.target === user.email ||
                    (n.target === 'approvers' && profile?.role === 'approver')
                );
                callback(mine);
                // Update badge count
                const unread = mine.filter(n => !n.read).length;
                document.querySelectorAll('.notif-count').forEach(el => {
                    el.textContent = unread > 0 ? unread : '';
                    el.style.display = unread > 0 ? '' : 'none';
                });
                document.querySelectorAll('.bottom-nav-badge').forEach(el => {
                    el.textContent = unread > 0 ? unread : '';
                    el.style.display = unread > 0 ? '' : 'none';
                });
            });
    }

    // ── Mark as Read ──────────────────────────────────────────────────────
    async function markRead(notifId) {
        try {
            await db.collection(CONFIG.COLLECTIONS.NOTIFICATIONS).doc(notifId).update({ read: true });
        } catch (e) {}
    }

    async function markAllRead() {
        const user = Auth.getUser();
        const profile = Auth.getProfile();
        if (!user) return;
        const snap = await db.collection(CONFIG.COLLECTIONS.NOTIFICATIONS)
            .where('read', '==', false).get();
        const batch = db.batch();
        snap.docs.forEach(doc => {
            const d = doc.data();
            if (d.target === 'all' || d.target === user.email ||
                (d.target === 'approvers' && profile?.role === 'approver')) {
                batch.update(doc.ref, { read: true });
            }
        });
        await batch.commit();
    }

    // ── Daily Reminder (client-side scheduler) ─────────────────────────────
    function initDailyReminder() {
        if (!CONFIG.ENABLE_DAILY_REMINDERS) return;
        if (!('Notification' in window) || Notification.permission !== 'granted') return;

        function scheduleNext() {
            const [h, m] = CONFIG.REMINDER_TIME.split(':').map(Number);
            const now = new Date();
            const next = new Date();
            next.setHours(h, m, 0, 0);
            if (next <= now) next.setDate(next.getDate() + 1);
            const delay = next.getTime() - Date.now();

            setTimeout(async () => {
                const today = new Date().toISOString().split('T')[0];
                const snap = await db.collection(CONFIG.COLLECTIONS.REFILLS)
                    .where('date', '==', today)
                    .limit(1).get();
                if (snap.empty) {
                    new Notification(`${CONFIG.APP_NAME} — Daily Reminder`, {
                        body: 'No refill recorded today. Check the water dispenser! 💧',
                        icon: '/images/icon-192.png',
                        badge: '/images/icon-72.png'
                    });
                }
                scheduleNext(); // Re-schedule for tomorrow
            }, delay);
        }

        scheduleNext();
    }

    // ── Init ───────────────────────────────────────────────────────────────
    async function init() {
        await registerSW();
        await requestPermission();
        listenForeground();
        initDailyReminder();
    }

    return { init, requestPermission, sendToAll, sendToApprovers, sendToUser,
             subscribeToNotifications, markRead, markAllRead };
})();

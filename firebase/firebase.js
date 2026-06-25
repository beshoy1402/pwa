/**
 * firebase.js — Firebase SDK initialization
 * All Firebase services are initialized here and exported.
 * Reads credentials exclusively from CONFIG (config/config.js).
 */

// Firebase SDK (loaded via CDN in HTML; this module just configures it)
let db, auth, storage, messaging;

function initFirebase() {
    const firebaseConfig = {
        apiKey: CONFIG.FIREBASE_API_KEY,
        authDomain: CONFIG.AUTH_DOMAIN,
        projectId: CONFIG.PROJECT_ID,
        storageBucket: CONFIG.STORAGE_BUCKET,
        messagingSenderId: CONFIG.MESSAGING_SENDER_ID,
        appId: CONFIG.APP_ID
    };

    // Prevent double-init
    if (!firebase.apps || firebase.apps.length === 0) {
        firebase.initializeApp(firebaseConfig);
    }

    db        = firebase.firestore();
    auth      = firebase.auth();
    storage   = firebase.storage();

    // Enable offline persistence
    if (CONFIG.ENABLE_OFFLINE_CACHE) {
        db.enablePersistence({ synchronizeTabs: true })
          .catch(err => {
              if (err.code === "failed-precondition") {
                  console.warn("Offline persistence unavailable: multiple tabs open.");
              } else if (err.code === "unimplemented") {
                  console.warn("Offline persistence not supported in this browser.");
              }
          });
    }

    // FCM (optional — only init if push is enabled and browser supports it)
    if (CONFIG.ENABLE_PUSH_NOTIFICATIONS && firebase.messaging && firebase.messaging.isSupported()) {
        messaging = firebase.messaging();
        messaging.usePublicVapidKey(CONFIG.VAPID_KEY);
    }

    console.log(`${CONFIG.APP_NAME} v${CONFIG.APP_VERSION} — Firebase ready`);
    return { db, auth, storage, messaging };
}

// Helper: get current user's role
async function getUserRole(uid) {
    try {
        const doc = await db.collection(CONFIG.COLLECTIONS.USERS).doc(uid).get();
        if (doc.exists) return doc.data().role || "user";
    } catch (e) {}
    return "user";
}

// Helper: check if email is an approver
function isApprover(email) {
    return CONFIG.APPROVER_EMAILS.includes(email?.toLowerCase());
}

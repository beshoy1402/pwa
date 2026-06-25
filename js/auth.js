/**
 * auth.js — Authentication Module
 * Handles sign-in, sign-out, session persistence, and role assignment.
 */

const Auth = (() => {
    let currentUser = null;
    let userProfile = null;

    // ── Initialize ─────────────────────────────────────────────────────────
    function init() {
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                currentUser = user;
                userProfile = await loadOrCreateProfile(user);
                // Redirect if on login page
                if (window.location.pathname.includes('login') || window.location.pathname === '/' || window.location.pathname.endsWith('/index.html')) {
                    redirectToDashboard();
                }
                updateUIForUser();
            } else {
                currentUser = null;
                userProfile = null;
                // Redirect to login if on a protected page
                const protected_pages = ['dashboard.html','admin.html','calendar.html'];
                if (protected_pages.some(p => window.location.pathname.includes(p))) {
                    window.location.href = 'login.html';
                }
            }
        });
    }

    // ── Load or Create User Profile ────────────────────────────────────────
    async function loadOrCreateProfile(user) {
        try {
            const ref = db.collection(CONFIG.COLLECTIONS.USERS).doc(user.uid);
            const doc = await ref.get();
            if (doc.exists) {
                return doc.data();
            }
            // Create new profile
            const role = isApprover(user.email) ? 'approver' : 'user';
            const displayName = CONFIG.USER_DISPLAY_NAMES[user.email?.toLowerCase()] || user.displayName || user.email?.split('@')[0] || 'User';
            const profile = {
                uid: user.uid,
                email: user.email,
                name: displayName,
                photoURL: user.photoURL || null,
                role,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                fcmToken: null
            };
            await ref.set(profile);
            return profile;
        } catch (e) {
            console.error('Profile error:', e);
            return { uid: user.uid, email: user.email, name: user.displayName || 'User', role: 'user' };
        }
    }

    // ── Redirect After Login ───────────────────────────────────────────────
    function redirectToDashboard() {
        if (userProfile?.role === 'approver') {
            window.location.href = 'admin.html';
        } else {
            window.location.href = 'dashboard.html';
        }
    }

    // ── Sign In with Email ─────────────────────────────────────────────────
    async function signInWithEmail(email, password) {
        try {
            const result = await auth.signInWithEmailAndPassword(email, password);
            return { success: true, user: result.user };
        } catch (e) {
            return { success: false, error: getFriendlyError(e.code) };
        }
    }

    // ── Sign In with Google ────────────────────────────────────────────────
    async function signInWithGoogle() {
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            const result = await auth.signInWithPopup(provider);
            return { success: true, user: result.user };
        } catch (e) {
            return { success: false, error: getFriendlyError(e.code) };
        }
    }

    // ── Register ───────────────────────────────────────────────────────────
    async function register(email, password, name) {
        try {
            const result = await auth.createUserWithEmailAndPassword(email, password);
            await result.user.updateProfile({ displayName: name });
            return { success: true, user: result.user };
        } catch (e) {
            return { success: false, error: getFriendlyError(e.code) };
        }
    }

    // ── Sign Out ───────────────────────────────────────────────────────────
    async function signOut() {
        await auth.signOut();
        window.location.href = 'login.html';
    }

    // ── Update UI Elements ─────────────────────────────────────────────────
    function updateUIForUser() {
        const nameEls   = document.querySelectorAll('[data-user-name]');
        const roleEls   = document.querySelectorAll('[data-user-role]');
        const emailEls  = document.querySelectorAll('[data-user-email]');
        const avatarEls = document.querySelectorAll('[data-user-avatar]');

        const name  = userProfile?.name || currentUser?.displayName || 'User';
        const role  = userProfile?.role === 'approver' ? 'Approver' : 'Refill User';
        const email = currentUser?.email || '';
        const photo = userProfile?.photoURL || currentUser?.photoURL;
        const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2);

        nameEls.forEach(el => el.textContent = name);
        roleEls.forEach(el => el.textContent = role);
        emailEls.forEach(el => el.textContent = email);
        avatarEls.forEach(el => {
            if (photo) {
                el.innerHTML = `<img src="${photo}" alt="${name}">`;
            } else {
                el.textContent = initials;
            }
        });
    }

    // ── Helpers ────────────────────────────────────────────────────────────
    function getFriendlyError(code) {
        const map = {
            'auth/user-not-found':    'No account found with this email.',
            'auth/wrong-password':    'Incorrect password. Please try again.',
            'auth/invalid-email':     'Please enter a valid email address.',
            'auth/email-already-in-use': 'An account with this email already exists.',
            'auth/weak-password':     'Password should be at least 6 characters.',
            'auth/too-many-requests': 'Too many attempts. Please try again later.',
            'auth/popup-closed-by-user': 'Sign-in popup was closed. Please try again.'
        };
        return map[code] || 'Something went wrong. Please try again.';
    }

    function getUser()    { return currentUser; }
    function getProfile() { return userProfile; }
    function isApproverUser() { return userProfile?.role === 'approver'; }
    function getUserId()  { return currentUser?.uid; }

    return { init, signInWithEmail, signInWithGoogle, register, signOut,
             getUser, getProfile, isApproverUser, getUserId, updateUIForUser };
})();

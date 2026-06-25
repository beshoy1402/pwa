# 💧 AquaTrack — Premium Family Water Dispenser Tracker

A production-quality Progressive Web Application for tracking who refills the family water dispenser, with photo proof, approval workflows, real-time notifications, and beautiful charts.

---

## 🚀 Quick Setup (5 steps)

### Step 1 — Create a Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → name it `aquatrack` → Continue
3. Enable Google Analytics (optional) → **Create project**

---

### Step 2 — Enable Firebase Services

In your Firebase project:

**Authentication**
- Sidebar → Build → **Authentication** → Get started
- Enable **Email/Password** provider
- Enable **Google** provider (add your domain)

**Firestore Database**
- Sidebar → Build → **Firestore Database** → Create database
- Start in **test mode** (you'll add security rules later)
- Choose a region close to you

**Storage**
- Sidebar → Build → **Storage** → Get started
- Start in test mode

**Cloud Messaging (Push Notifications)**
- Sidebar → Project Settings → **Cloud Messaging** tab
- Under "Web configuration" → Generate key pair → copy the VAPID key

---

### Step 3 — Get Your Config Keys

1. Sidebar → Project Settings → **General** tab
2. Scroll to "Your apps" → click **</>** (Web)
3. Register your app name → copy the `firebaseConfig` object

---

### Step 4 — Add Keys to config.js

Open `/config/config.js` and fill in your keys:

```js
const CONFIG = {
    FIREBASE_API_KEY:        "AIzaSy...",
    AUTH_DOMAIN:             "your-project.firebaseapp.com",
    PROJECT_ID:              "your-project-id",
    STORAGE_BUCKET:          "your-project-id.appspot.com",
    MESSAGING_SENDER_ID:     "123456789",
    APP_ID:                  "1:123:web:abc",
    VAPID_KEY:               "BHxyz...",        // From Cloud Messaging settings
    
    // Update with real family emails:
    APPROVER_EMAILS: [
        "father@gmail.com",
        "uncle@gmail.com"
    ],
    USER_DISPLAY_NAMES: {
        "father@gmail.com":  "Father",
        "uncle@gmail.com":   "Uncle",
        "bishoy@gmail.com":  "Bishoy",
        "cousin@gmail.com":  "Cousin"
    }
};
```

---

### Step 5 — Deploy to Firebase Hosting

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Initialize (from your project folder)
firebase init

# Choose: Hosting
# Public directory: . (dot — the root folder)
# Single-page app: No
# Overwrite index.html: No

# Deploy!
firebase deploy
```

Your app is now live at `https://your-project.web.app` 🎉

---

## 🔐 Firestore Security Rules

After testing, replace test mode rules with these in Firestore → Rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Users can read/write their own profile
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Refills: any signed-in user can create; only owner or approver can update
    match /refills/{refillId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null && (
        request.auth.uid == resource.data.uid ||
        request.auth.token.email in ['father@gmail.com', 'uncle@gmail.com']
      );
    }
    
    // Warnings: any signed-in user can create/read
    match /warnings/{warningId} {
      allow read, create: if request.auth != null;
    }
    
    // Notifications: any signed-in user can read/write
    match /notifications/{notifId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## 📱 Installing as a PWA

**Android:** Open the app in Chrome → tap the "Install" banner or three dots menu → "Add to Home Screen"

**iPhone:** Open in Safari → tap Share → "Add to Home Screen"

**Desktop:** Click the install icon in the browser address bar

---

## 📁 Project Structure

```
aquatrack/
├── index.html          # Entry point (auto-redirects based on login state)
├── login.html          # Sign in / Register page
├── dashboard.html      # Refill user dashboard
├── admin.html          # Approver dashboard
├── calendar.html       # Monthly calendar view
├── service-worker.js   # PWA offline support + push notifications
├── manifest.json       # PWA install manifest
├── config/
│   └── config.js       # ⚡ ALL settings go here
├── css/
│   └── styles.css      # Complete design system
├── js/
│   ├── app.js          # Core logic (refills, toasts, theme)
│   ├── auth.js         # Firebase Auth module
│   ├── notifications.js # FCM + daily reminders
│   └── calendar.js     # Calendar rendering
├── firebase/
│   └── firebase.js     # Firebase initialization
└── images/
    └── icon-*.png      # PWA icons (72–512px)
```

---

## 👥 User Accounts to Create

Register these accounts in the app (or via Firebase Console → Authentication):

| Name   | Email               | Role     |
|--------|---------------------|----------|
| Father | father@gmail.com    | Approver |
| Uncle  | uncle@gmail.com     | Approver |
| Bishoy | bishoy@gmail.com    | User     |
| Cousin | cousin@gmail.com    | User     |

Emails matching `APPROVER_EMAILS` in config.js automatically get the Approver role.

---

## ✨ Features

- 💧 **Refill Submission** — Photo proof + notes, mobile camera support
- ✅ **Approval Workflow** — Approve or reject with reasons, real-time updates
- 📅 **Calendar View** — Color-coded dots show activity per day
- 📊 **Monthly Reports** — Charts, per-user stats, activity breakdown
- ⚠️ **Low Water Warnings** — Alert the whole family instantly
- 🔔 **Push Notifications** — Works when the app is closed (Android/Desktop)
- 🌙 **Dark / Light Mode** — Automatic or manual toggle
- 📱 **PWA Installable** — Feels like a native app on phone and desktop
- ⚡ **Real-time** — All dashboards update live without refresh
- 📴 **Offline Support** — Service worker caches the app for offline access

---

## 🔧 Customization

All settings are in `config/config.js`:

| Setting | Description |
|---------|-------------|
| `APPROVER_EMAILS` | Emails with approval rights |
| `USER_DISPLAY_NAMES` | Friendly names shown in the app |
| `REMINDER_TIME` | Daily reminder time (24h format, e.g. `"18:00"`) |
| `MAX_PHOTO_SIZE_MB` | Max photo upload size |
| `DEFAULT_THEME` | `"dark"`, `"light"`, or `"system"` |
| `ENABLE_PUSH_NOTIFICATIONS` | Toggle FCM push notifications |
| `ENABLE_DAILY_REMINDERS` | Toggle daily reminders |

/**
 * AquaTrack Configuration File
 * ================================
 * All application settings, API keys, and feature toggles live here.
 * Change values in this file to update the entire application.
 * NEVER hardcode keys elsewhere.
 */

const firebaseConfig = {
  apiKey: "AIzaSyCtaWHtVjbgT9PlLZzSXj-me3cIPGp8bLA",
  authDomain: "aquatrack-pwa-da70e.firebaseapp.com",
  projectId: "aquatrack-pwa-da70e",
  storageBucket: "aquatrack-pwa-da70e.firebasestorage.app",
  messagingSenderId: "950302257086",
  appId: "1:950302257086:web:9a4b53c79d399cf621d3ef",
  measurementId: "G-9CVJD170RP"

    // ── Push Notifications ────────────────────────────────────────────────────
    // Get from Firebase Console → Project Settings → Cloud Messaging → Web Push certificates
    VAPID_KEY: "YOUR_VAPID_KEY",

    // ── App Identity ──────────────────────────────────────────────────────────
    APP_NAME: "AquaTrack",
    APP_SHORT_NAME: "AquaTrack",
    APP_VERSION: "1.0.0",
    APP_DESCRIPTION: "Premium family water dispenser tracker",

    // ── User Roles ────────────────────────────────────────────────────────────
    // Users with these exact emails are treated as approvers
    APPROVER_EMAILS: [
        "father@family.com",
        "uncle@family.com"
    ],
    // Display names mapped to emails (fallback if profile has no name)
    USER_DISPLAY_NAMES: {
        "father@family.com": "Father",
        "uncle@family.com": "Uncle",
        "bishoy@family.com": "Bishoy",
        "cousin@family.com": "Cousin"
    },

    // ── Daily Reminder ────────────────────────────────────────────────────────
    // 24-hour format, local time. Used by the in-app reminder scheduler.
    REMINDER_TIME: "18:00",

    // ── Feature Flags ─────────────────────────────────────────────────────────
    ENABLE_PUSH_NOTIFICATIONS: true,   // Set false to disable FCM entirely
    ENABLE_DAILY_REMINDERS: true,
    ENABLE_OFFLINE_CACHE: true,

    // ── UI Settings ──────────────────────────────────────────────────────────
    DEFAULT_THEME: "dark",             // "dark" | "light" | "system"
    PRIMARY_COLOR: "#3B82F6",          // Used in manifest and theme-color meta tag
    MAX_PHOTO_SIZE_MB: 10,             // Max upload size in megabytes

    // ── Firestore Collection Names ────────────────────────────────────────────
    COLLECTIONS: {
        REFILLS: "refills",
        USERS: "users",
        NOTIFICATIONS: "notifications",
        WARNINGS: "warnings",
        SETTINGS: "settings"
    }
};

// Make available globally
if (typeof module !== "undefined") module.exports = CONFIG;

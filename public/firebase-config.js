/**
 * Shere Garba — Firebase Configuration
 * ─────────────────────────────────────
 * 1. Go to https://console.firebase.google.com
 * 2. Create a project → Add a Web App → copy config below
 * 3. Enable Realtime Database (test mode)
 * 4. Enable Authentication → Sign-in method → Anonymous
 *
 * Without this config the app still works:
 *  • Playback is fully functional
 *  • Likes show as 0 (no persistence)
 *  • Listener count shows 1
 */
window.FIREBASE_CONFIG = {
  apiKey:            "AIzaSyAJWgV9l18Eeug9-o70ztF8oyi_DkWdjnU",
  authDomain:        "navratri-dhamaka.firebaseapp.com",
  databaseURL:       "https://navratri-dhamaka-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:         "navratri-dhamaka",
  storageBucket:     "navratri-dhamaka.firebasestorage.app",
  messagingSenderId: "430486561028",
  appId:             "1:430486561028:web:cc6ea79601ed83a692f051"
};

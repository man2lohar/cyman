/**
 * firebase-config.js
 * Single source of truth for Firebase initialization.
 * Include ONCE before any other Firebase script on every page.
 */
const CYMAN_FIREBASE_CONFIG = {
  apiKey:            "AIzaSyDYwO0SAoHcg076PnCGMGaAmvHfwPl6-n4",
  authDomain:        "project-management-man2.firebaseapp.com",
  databaseURL:       "https://project-management-man2-default-rtdb.firebaseio.com",
  projectId:         "project-management-man2",
  storageBucket:     "project-management-man2.appspot.com",
  messagingSenderId: "731310432635",
  appId:             "1:731310432635:web:d617c81ee9cd0122a49dde",
  measurementId:     "G-NJFELXSRRP"
};

// Initialize only once (works for both module and compat SDKs)
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
  firebase.initializeApp(CYMAN_FIREBASE_CONFIG);
}

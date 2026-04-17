import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

export const firebaseConfig = {
    apiKey: "AIzaSyAObKCG2YErtd3coaoPM9zhhhXMAhVtS8M",
    authDomain: "schooler-dashboard.firebaseapp.com",
    projectId: "schooler-dashboard",
    storageBucket: "schooler-dashboard.firebasestorage.app",
    messagingSenderId: "540884137704",
    appId: "1:540884137704:web:231687fbd0f8ae68aabb5d",
    measurementId: "G-MP8LLZBFX1"
};

// Initialize Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { app, db, auth, storage };

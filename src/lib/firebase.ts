import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported } from "firebase/analytics";

export const firebaseConfig = {
  apiKey: "AIzaSyAObKCG2YErtd3coaoPM9zhhhXMAhVtS8M",
  authDomain: "schooler-dashboard.firebaseapp.com",
  projectId: "schooler-dashboard",
  storageBucket: "schooler-dashboard.firebasestorage.app",
  messagingSenderId: "540884137704",
  appId: "1:540884137704:web:231687fbd0f8ae68aabb5d",
  measurementId: "G-MP8LLZBFX1"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

export let analytics: any = null;
isSupported().then((supported) => {
  if (supported) {
    analytics = getAnalytics(app);
  }
}).catch(console.error);

export const addTestDocument = async () => {
  try {
    const docRef = await addDoc(collection(db, "test"), {
      message: "Firebase initialized successfully!",
      timestamp: new Date()
    });
    console.log("Firebase Test Success! Document written with ID: ", docRef.id);
  } catch (e) {
    console.error("Firebase Test Error - failed to add document: ", e);
  }
};

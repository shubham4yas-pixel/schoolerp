import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, deleteDoc, doc, query, where } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyAObKCG2YErtd3coaoPM9zhhhXMAhVtS8M",
    authDomain: "schooler-dashboard.firebaseapp.com",
    projectId: "schooler-dashboard",
    storageBucket: "schooler-dashboard.firebasestorage.app",
    messagingSenderId: "540884137704",
    appId: "1:540884137704:web:231687fbd0f8ae68aabb5d",
    measurementId: "G-MP8LLZBFX1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const cleanup = async () => {
    try {
        console.log("Starting cleanup of bad student data...");
        
        const studentsRef = collection(db, "schools", "school_001", "students");
        const q = query(studentsRef, where("className", "==", "Class undefined"));
        
        const snapshot = await getDocs(q);
        console.log(`Found ${snapshot.size} bad records.`);
        
        const deletePromises = snapshot.docs.map(d => {
            console.log(`Deleting student: ${d.id} (${d.data().name})`);
            return deleteDoc(doc(db, "schools", "school_001", "students", d.id));
        });
        
        await Promise.all(deletePromises);
        
        console.log("Cleanup complete! 🧹 ✅");
        process.exit(0);
    } catch (error) {
        console.error("Cleanup failed:", error);
        process.exit(1);
    }
};

cleanup();

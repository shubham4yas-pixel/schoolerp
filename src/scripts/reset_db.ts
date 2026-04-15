import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, deleteDoc, doc, setDoc, serverTimestamp } from "firebase/firestore";

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

const deleteCollection = async (collectionPath: string) => {
    const colRef = collection(db, collectionPath);
    const snapshot = await getDocs(colRef);
    const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, collectionPath, d.id)));
    await Promise.all(deletePromises);
    console.log(`Deleted all documents in ${collectionPath}`);
};

const reset = async () => {
    try {
        console.log("Starting full recursive database reset for school_001...");
        
        // Root collections
        await deleteCollection("users");
        await deleteCollection("test");

        // Sub-collections of school_001
        const schoolPath = "schools/school_001";
        const subCollections = [
            "students",
            "classes",
            "marks",
            "attendance",
            "fees",
            "payments",
            "busRoutes",
            "credentials",
            "config/feeStructure/classes",
            "config/academic/exams",
            "config/academic/subjects"
        ];

        for (const sub of subCollections) {
            await deleteCollection(`${schoolPath}/${sub}`);
        }

        // Final root schools cleanup
        await deleteCollection("schools");

        console.log("Recreating core school document...");
        await setDoc(doc(db, "schools", "school_001"), {
            id: "school_001",
            name: "BVP",
            createdAt: serverTimestamp()
        });

        console.log("Database reset complete! 🧹 ✅");
        process.exit(0);
    } catch (error) {
        console.error("Reset failed:", error);
        process.exit(1);
    }
};

reset();

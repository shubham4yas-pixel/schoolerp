import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, setDoc, Timestamp } from "firebase/firestore";

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

function parseCreatedAt(input: any): any {
    if (!input) return Timestamp.now();
    
    // If it's already a Timestamp
    if (input instanceof Timestamp || (input.seconds !== undefined && input.nanoseconds !== undefined)) {
        return new Timestamp(input.seconds, input.nanoseconds);
    }
    
    // If it's a JS Date
    if (input instanceof Date) {
        return Timestamp.fromDate(input);
    }
    
    // If it's a string
    if (typeof input === 'string') {
        const d = new Date(input);
        if (!isNaN(d.getTime())) {
            return Timestamp.fromDate(d);
        }
    }
    
    // If it's a number (milliseconds)
    if (typeof input === 'number') {
        const d = new Date(input);
        if (!isNaN(d.getTime())) {
            return Timestamp.fromDate(d);
        }
    }

    return Timestamp.now();
}

async function fixStudents(dryRun: boolean = true) {
  const schoolsSnapshot = await getDocs(collection(db, "schools"));
  console.log(`Found ${schoolsSnapshot.size} schools.`);

  const corrections: any[] = [];

  // Helper to process a student document
  async function processStudent(docSnap: any, schoolId?: string) {
    const data = docSnap.data();
    const id = docSnap.id;
    
    // 1. EXTRACT DATA WITH NEW SCHEMA
    const finalData: any = {
        name: data.name || "Unknown",
        classId: data.classId || "",
        class: data.class || "Unknown",
        section: data.section || "Unknown",
        rollNumber: data.rollNumber || id, // Prioritize existing rollNumber if fixed in previous step, else use ID
        totalFees: Number(data.totalFees) || 0,
        paidAmount: Number(data.paidAmount) || 0,
        createdAt: parseCreatedAt(data.createdAt)
    };

    // 2. IDENTIFY REMOVALS
    const fieldsToRemove = Object.keys(data).filter(key => !(key in finalData));

    corrections.push({ id, name: finalData.name, schoolId, finalData, removedFields: fieldsToRemove });

    if (!dryRun) {
      console.log(`Applying final cleanup to student ${id} in ${schoolId || 'top-level'}. Removing: ${fieldsToRemove.join(', ')}`);
      // setDoc without merge completely replaces the document
      await setDoc(docSnap.ref, finalData);
    }
  }

  // Process top-level students
  const topStudentsSnapshot = await getDocs(collection(db, "students"));
  for (const docSnap of topStudentsSnapshot.docs) {
    await processStudent(docSnap);
  }

  // Process school-level students
  for (const schoolDoc of schoolsSnapshot.docs) {
    const schoolId = schoolDoc.id;
    const studentsSnapshot = await getDocs(collection(db, "schools", schoolId, "students"));
    for (const docSnap of studentsSnapshot.docs) {
      await processStudent(docSnap, schoolId);
    }
  }

  console.log("\nSummary of corrections:");
  if (corrections.length === 0) {
    console.log("No students found.");
  } else {
    console.log(`\nFound ${corrections.length} students. Here are 2 examples of the final cleaned documents:`);
    corrections.slice(0, 2).forEach((c, i) => {
      console.log(`\nExample ${i + 1} (${c.id}):`);
      console.log("NEW DATA:", JSON.stringify(c.finalData, null, 2));
      console.log("REMOVED FIELDS:", c.removedFields.join(', '));
    });
    console.log(`\nTotal students cleaned: ${corrections.length}`);
  }
  
  if (dryRun && corrections.length > 0) {
    console.log("\nDRY RUN: No changes were made to Firestore.");
  }
}

const isDryRun = process.argv.includes("--execute") ? false : true;
fixStudents(isDryRun).catch(error => {
    console.error("Error during migration:", error);
    process.exit(1);
});

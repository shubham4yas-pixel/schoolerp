import { initializeApp } from "firebase/app";
import { collection, doc, getDocs, getFirestore, updateDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAObKCG2YErtd3coaoPM9zhhhXMAhVtS8M",
  authDomain: "schooler-dashboard.firebaseapp.com",
  projectId: "schooler-dashboard",
  storageBucket: "schooler-dashboard.firebasestorage.app",
  messagingSenderId: "540884137704",
  appId: "1:540884137704:web:231687fbd0f8ae68aabb5d",
  measurementId: "G-MP8LLZBFX1",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

type ClassEntry = {
  classId: string;
  name: string;
};

type SchoolStats = {
  schoolId: string;
  totalStudents: number;
  alreadyValid: number;
  updated: number;
  skippedNoStudentClass: number;
  skippedNoMatch: number;
  skippedAmbiguous: number;
  remainingMissingClassId: number;
};

const normalize = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const isValidClassId = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const getRequestedSchoolIds = async (): Promise<string[]> => {
  const schoolArg = process.argv.find((arg) => arg.startsWith("--school="));
  const requestedSchoolId = normalize(schoolArg?.split("=")[1]);

  if (requestedSchoolId) {
    return [requestedSchoolId];
  }

  const schoolsSnapshot = await getDocs(collection(db, "schools"));
  return schoolsSnapshot.docs.map((schoolDoc) => schoolDoc.id);
};

const getClassLookup = async (schoolId: string) => {
  const classesSnapshot = await getDocs(collection(db, "schools", schoolId, "classes"));

  const byName = new Map<string, Set<string>>();

  classesSnapshot.docs.forEach((classDoc) => {
    const data = classDoc.data();
    const classId = normalize(data.classId) || classDoc.id;
    const name = normalize(data.name);

    if (!classId || !name) {
      return;
    }

    const existing = byName.get(name) ?? new Set<string>();
    existing.add(classId);
    byName.set(name, existing);
  });

  return byName;
};

const migrateSchool = async (schoolId: string): Promise<SchoolStats> => {
  const classLookup = await getClassLookup(schoolId);
  const studentsSnapshot = await getDocs(collection(db, "schools", schoolId, "students"));

  let alreadyValid = 0;
  let updated = 0;
  let skippedNoStudentClass = 0;
  let skippedNoMatch = 0;
  let skippedAmbiguous = 0;

  for (const studentDoc of studentsSnapshot.docs) {
    const data = studentDoc.data();
    const existingClassId = normalize(data.classId);

    if (existingClassId) {
      alreadyValid += 1;
      continue;
    }

    const studentClassName = normalize(data.class);

    if (!studentClassName) {
      skippedNoStudentClass += 1;
      continue;
    }

    const matchingClassIds = classLookup.get(studentClassName);

    if (!matchingClassIds || matchingClassIds.size === 0) {
      skippedNoMatch += 1;
      continue;
    }

    if (matchingClassIds.size > 1) {
      skippedAmbiguous += 1;
      continue;
    }

    const [matchedClassId] = Array.from(matchingClassIds);

    if (!isValidClassId(matchedClassId)) {
      skippedNoMatch += 1;
      continue;
    }

    await updateDoc(doc(db, "schools", schoolId, "students", studentDoc.id), {
      classId: matchedClassId,
    });

    updated += 1;
  }

  const verificationSnapshot = await getDocs(collection(db, "schools", schoolId, "students"));
  const remainingMissingClassId = verificationSnapshot.docs.filter((studentDoc) => {
    const student = studentDoc.data();
    return !isValidClassId(student.classId);
  }).length;

  return {
    schoolId,
    totalStudents: studentsSnapshot.size,
    alreadyValid,
    updated,
    skippedNoStudentClass,
    skippedNoMatch,
    skippedAmbiguous,
    remainingMissingClassId,
  };
};

const run = async () => {
  const schoolIds = await getRequestedSchoolIds();

  if (schoolIds.length === 0) {
    console.log("No schools found.");
    return;
  }

  const results: SchoolStats[] = [];

  for (const schoolId of schoolIds) {
    console.log(`Migrating students for ${schoolId}...`);
    const stats = await migrateSchool(schoolId);
    results.push(stats);

    console.log(
      JSON.stringify(
        {
          schoolId: stats.schoolId,
          totalStudents: stats.totalStudents,
          alreadyValid: stats.alreadyValid,
          updated: stats.updated,
          skippedNoStudentClass: stats.skippedNoStudentClass,
          skippedNoMatch: stats.skippedNoMatch,
          skippedAmbiguous: stats.skippedAmbiguous,
          remainingMissingClassId: stats.remainingMissingClassId,
        },
        null,
        2,
      ),
    );
  }

  const totalRemainingMissing = results.reduce(
    (sum, result) => sum + result.remainingMissingClassId,
    0,
  );

  if (totalRemainingMissing > 0) {
    process.exitCode = 1;
  }
};

run().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});

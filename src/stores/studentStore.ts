import { create } from "zustand";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

export interface Student {
  id: string;
  name: string;
  classId: string;
  class: string;
  section: string;
  rollNumber: string;
  totalFees: number;
  paidAmount: number;
  createdAt?: any;
  avatarColor?: string;
  photoURL?: string;
  profileImage?: string;
  parentName?: string;
  parentContact?: string;
  results?: any;
  attendance?: any;
}

const SCHOOL_ID = "school_001";

interface StudentStore {
  students: Student[];
  fetchStudents: () => Promise<void>;
  updatePayment: (id: string, amount: number) => Promise<void>;
}

export const useStudentStore = create<StudentStore>((set) => ({
  students: [],

  fetchStudents: async () => {
    // Fetch from school-specific subcollection (matching the rest of the app)
    const querySnapshot = await getDocs(collection(db, "schools", SCHOOL_ID, "students"));

    const students: Student[] = querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data();

      return {
        id: docSnap.id,
        name: data.name || "",
        classId: data.classId || "",
        class: data.class || "",
        section: data.section || "",
        rollNumber: data.rollNumber || docSnap.id,
        totalFees: Number(data.totalFees) || 0,
        paidAmount: Number(data.paidAmount) || 0,
        createdAt: data.createdAt || null,
        avatarColor: data.avatarColor || "#1e3a5f",
        photoURL: data.photoURL || data.profileImage || "",
        profileImage: data.profileImage || data.photoURL || "",
        parentName: data.parentName || "",
        parentContact: data.parentContact || "",
        results: data.results || {},
        attendance: data.attendance || {},
      };
    });

    set({ students });
  },

  updatePayment: async (id, amount) => {
    // Update in school-specific subcollection
    const studentRef = doc(db, "schools", SCHOOL_ID, "students", id);

    await updateDoc(studentRef, {
      paidAmount: amount,
    });

    const querySnapshot = await getDocs(collection(db, "schools", SCHOOL_ID, "students"));
    const students = querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data();

      return {
        id: docSnap.id,
        name: data.name || "",
        classId: data.classId || "",
        class: data.class || "",
        section: data.section || "",
        rollNumber: data.rollNumber || docSnap.id,
        totalFees: Number(data.totalFees) || 0,
        paidAmount: Number(data.paidAmount) || 0,
        createdAt: data.createdAt || null,
        avatarColor: data.avatarColor || "#1e3a5f",
        photoURL: data.photoURL || data.profileImage || "",
        profileImage: data.profileImage || data.photoURL || "",
        parentName: data.parentName || "",
        parentContact: data.parentContact || "",
        results: data.results || {},
        attendance: data.attendance || {},
      };
    });

    set({ students });
  },
}));

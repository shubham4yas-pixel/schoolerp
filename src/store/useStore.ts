import { create } from 'zustand';
import { db, auth } from '@/lib/firebase';
import { collection, onSnapshot, query, setDoc, doc, deleteDoc, where, arrayUnion, getDoc, addDoc, updateDoc, getDocs, writeBatch } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut as firebaseSignOut, onAuthStateChanged } from 'firebase/auth';
import { Student, Mark, AttendanceRecord, Fee, BusRoute, Feedback, LoginCredential, FeeConfig, ExamConfig, SubjectConfig, ClassConfig, AppUser, Payment } from '@/lib/types';
import { dedupeAttendanceRecords, getAttendanceDocId, normalizeAttendanceRecord, sanitize } from '@/lib/data-utils';
import { supabase } from '@/lib/supabase';

interface AppState {
    rawStudents: Student[];
    students: Student[];
    rawMarks: Mark[];
    marks: Mark[]; // This acts as unifiedMarks for the rest of the application
    attendance: AttendanceRecord[];
    feedbacks: Feedback[];
    fees: Fee[];
    payments: Payment[];
    busRoutes: BusRoute[];
    feeConfigs: FeeConfig[];
    feeSettings: Record<string, { monthlyFee: number; transportFee: number }>;
    exams: ExamConfig[];
    subjects: SubjectConfig[];
    classes: ClassConfig[];
    loginCredentials: LoginCredential[];
    users: AppUser[];
    userRole: 'admin' | 'teacher' | 'accountant';
    initialized: boolean;
    currentUser: AppUser | null;
    currentSchoolId: string;
    loading: {
        students: boolean;
        marks: boolean;
        attendance: boolean;
        fees: boolean;
        busRoutes: boolean;
        credentials: boolean;
        feeConfigs: boolean;
        exams: boolean;
        subjects: boolean;
        classes: boolean;
        users: boolean;
        auth: boolean;
    };

    // Global Filters
    globalFilterClass: string;
    globalFilterSection: string;
    globalFilterSearch: string;

    // Actions
    setGlobalFilterClass: (cls: string) => void;
    setGlobalFilterSection: (section: string) => void;
    setGlobalFilterSearch: (search: string) => void;
    setUserRole: (role: 'admin' | 'teacher' | 'accountant') => void;
    saveFeeConfig: (schoolId: string, config: FeeConfig) => Promise<void>;
    saveExamConfig: (schoolId: string, exam: ExamConfig) => Promise<void>;
    saveSubjectConfig: (schoolId: string, subject: SubjectConfig) => Promise<void>;
    saveClassConfig: (schoolId: string, classConfig: ClassConfig) => Promise<void>;
    updateStudentResult: (schoolId: string, studentId: string, examId: string, subjectId: string, marks: number, source?: string) => Promise<void>;
    logUploadRecord: (schoolId: string, metadata: any) => Promise<void>;
    fetchStudentsByClass: (schoolId: string, classId: string) => () => void;
    listenToClasses: (schoolId: string) => () => void;
    fetchStudents: (schoolId: string) => Promise<void>;
    initListeners: (schoolId: string) => () => void;
    setStudents: (students: Student[]) => void;
    setMarks: (marks: Mark[]) => void;
    setAttendance: (attendance: AttendanceRecord[]) => void;
    addBusRoute: (schoolId: string, route: BusRoute) => Promise<void>;
    updateBusRoute: (schoolId: string, routeId: string, data: Partial<BusRoute>) => Promise<void>;
    addStudent: (schoolId: string, student: Student) => Promise<void>;
    addMark: (schoolId: string, mark: Mark) => Promise<void>;
    addAttendanceRecords: (schoolId: string, records: AttendanceRecord[]) => Promise<void>;
    saveAttendance: (schoolId: string, records: AttendanceRecord[]) => Promise<void>;
    saveFeedbacks: (schoolId: string, feedbacks: Feedback[]) => Promise<void>;
    addFeedback: (schoolId: string, feedback: Feedback) => Promise<void>;
    updateFee: (schoolId: string, studentId: string, data: Partial<Fee>) => Promise<void>;
    fetchPaymentsFromSupabase: (schoolId?: string) => Promise<void>;
    recordPayment: (schoolId: string, payment: Payment) => Promise<void>;
    addLoginCredential: (schoolId: string, credential: LoginCredential) => Promise<void>;
    updateLoginCredential: (schoolId: string, credentialId: string, data: Partial<LoginCredential>) => Promise<void>;
    deleteLoginCredential: (schoolId: string, credentialId: string) => Promise<void>;
    updateExamPublishStatus: (schoolId: string, studentIds: string[], examId: string, isPublished: boolean) => Promise<void>;
    setCurrentUser: (user: AppUser | null) => void;
}

const assembleUnifiedMarks = (rawMarks: Mark[], students: Student[], exams: ExamConfig[], subjects: SubjectConfig[]): Mark[] => {
    const unified: Mark[] = [...rawMarks];
    const subjectsMap = new Map(subjects.map(s => [s.id, s]));
    const examsMap = new Map(exams.map(e => [e.id, e]));

    for (const student of students) {
        if (student.results) {
            for (const [examId, examData] of Object.entries(student.results)) {
                // If it's the old structure (direct subject map) try to cope or skip
                if (!examData || typeof examData !== 'object') continue;

                // Per-student publishing rule
                if (!examData.isPublished) continue;

                const examInfo = examsMap.get(examId);
                const examName = examInfo?.name || examId;

                const subjectsList = examData.subjects || {};
                for (const [subjectId, result] of Object.entries(subjectsList)) {
                    const subject = subjectsMap.get(subjectId);
                    if (!subject) continue;

                    unified.push({
                        id: `R_${student.id}_${examId}_${subjectId}`,
                        studentId: student.id,
                        subject: subject.name,
                        examType: examName as any,
                        marksObtained: result.marks,
                        totalMarks: 100,
                        date: result.updatedAt,
                    });
                }
            }
        }
    }
    return unified;
};

const normalizeClass = (student: Student, classes: ClassConfig[]) => {
    const cls = classes.find(c => c.classId === student.classId || c.id === student.classId);
    return {
        ...student,
        class: student.class || cls?.name || "",
    };
};

const augmentStudents = (rawStudents: Student[], classes: ClassConfig[], feeSettings: Record<string, any>) => {
    return rawStudents.map(student => {
        // STEP 1 — DATA NORMALIZATION (ROOT CAUSE FIX)
        const d = student as any;
        const normalized = {
            ...d,
            name: d.name || "",
            classId: d.classId || "",
            class: d.class || d.className || "",
            section: d.section || "",
            rollNumber: d.rollNumber || "",
            paidAmount: Number(d.paidAmount || 0),
            totalFees: Number(d.totalFees || 0),
            photoURL: d.photoURL || d.profileImage || "",
            profileImage: d.profileImage || d.photoURL || "",
        };

        const withClass = normalizeClass(normalized, classes);

        // STEP 2 — FEE SETTINGS LOOKUP
        const classFee = feeSettings?.[withClass.classId || ""]?.monthlyFee || 0;

        // STEP 3 — TOTAL FEE FALLBACK
        const totalFees = withClass.totalFees && withClass.totalFees > 0
            ? Number(withClass.totalFees)
            : Number(classFee);

        const paidAmount = withClass.paidAmount;

        // STEP 4 — DYNAMIC CALCULATION
        const pendingFees = totalFees - paidAmount;
        
        let feeStatus: 'Paid' | 'Unpaid' | 'Partial' | 'Overpaid' = "Unpaid";
        if (paidAmount === 0) {
            feeStatus = "Unpaid";
        } else if (paidAmount < totalFees) {
            feeStatus = "Partial";
        } else if (paidAmount === totalFees) {
            feeStatus = "Paid";
        } else if (paidAmount > totalFees) {
            feeStatus = "Overpaid";
        }

        return { 
            ...withClass, 
            totalFees,
            paidAmount,
            pendingFees,
            feeStatus,
            fees: {
                total: totalFees,
                paid: paidAmount,
                pending: pendingFees,
                dueAmount: pendingFees,
                status: feeStatus.toLowerCase() as any
            }
        };
    });
};

export const useStore = create<AppState>((set, get) => ({
    rawStudents: [],
    students: [],
    rawMarks: [],
    marks: [],
    attendance: [],
    feedbacks: [],
    fees: [],
    payments: [],
    busRoutes: [],
    feeConfigs: [],
    feeSettings: {},
    exams: [],
    subjects: [],
    classes: [],
    loginCredentials: [],
    users: [],
    userRole: 'admin',
    currentUser: null,
    currentSchoolId: 'school_001',
    loading: {
        students: true,
        marks: true,
        attendance: true,
        fees: true,
        busRoutes: true,
        credentials: true,
        feeConfigs: true,
        exams: true,
        subjects: true,
        classes: true,
        users: true,
        auth: true,
    },
    initialized: false,

    globalFilterClass: '',
    globalFilterSection: '',
    globalFilterSearch: '',

    setGlobalFilterClass: (globalFilterClass) => set({ globalFilterClass, globalFilterSection: '' }), // reset section on class change
    setGlobalFilterSection: (globalFilterSection) => set({ globalFilterSection }),
    setGlobalFilterSearch: (globalFilterSearch) => set({ globalFilterSearch }),
    setUserRole: (userRole) => set({ userRole }),

    setStudents: (rawStudents) => set((state) => ({ 
        rawStudents, 
        students: augmentStudents(rawStudents, state.classes, state.feeSettings), 
        loading: { ...state.loading, students: false } 
    })),
    setMarks: (marks) => set({ marks }),
    setAttendance: (attendance) => set({ attendance }),

    addBusRoute: async (schoolId, route) => {
        if (!db) return;
        if (!navigator.onLine) {
            alert("No internet connection");
            return;
        }
        try {
            await setDoc(doc(db, 'schools', schoolId, 'busRoutes', route.id), sanitize(route));
        } catch (error) {
            console.error("Firestore Error:", error);
            alert("Something went wrong. Please try again.");
        }
    },

    updateBusRoute: async (schoolId, routeId, data) => {
        if (!db) return;
        if (!navigator.onLine) {
            alert("No internet connection");
            return;
        }
        try {
            await setDoc(doc(db, 'schools', schoolId, 'busRoutes', routeId), sanitize(data), { merge: true });
        } catch (error) {
            console.error("Firestore Error:", error);
            alert("Something went wrong. Please try again.");
        }
    },

    addStudent: async (schoolId, student) => {
        if (!db) return;
        try {
            await addDoc(
                collection(db, "schools", "school_001", "students"),
                {
                    name: student.name || "",
                    classId: student.classId || "",
                    class: student.class || "",
                    section: student.section || "",
                    rollNumber: student.rollNumber || "",
                    totalFees: Number(student.totalFees) || 0,
                    paidAmount: Number(student.paidAmount) || 0,
                    photoURL: student.photoURL || student.profileImage || "",
                    profileImage: student.profileImage || student.photoURL || "",
                    createdAt: new Date()
                }
            );
            console.log("✅ Student saved to Central Firestore");
        } catch (error) {
            console.error("❌ Firestore save failed:", error);
        }
    },

    addMark: async (schoolId, mark) => {
        if (!db) return;
        if (!navigator.onLine) {
            alert("No internet connection");
            return;
        }
        try {
            await setDoc(doc(db, 'schools', schoolId, 'marks', mark.id), sanitize(mark));
        } catch (error) {
            console.error("Firestore Error:", error);
            alert("Something went wrong. Please try again.");
        }
    },

    saveAttendance: async (schoolId, records) => {
        if (!db) return;
        if (!navigator.onLine) {
            alert("No internet connection");
            return;
        }
        try {
            const batch = writeBatch(db);
            dedupeAttendanceRecords(records).forEach(record => {
                const normalized = normalizeAttendanceRecord(record);
                const ref = doc(db, 'schools', schoolId, 'attendance', getAttendanceDocId(normalized.studentId, normalized.date));
                batch.set(ref, {
                    id: ref.id,
                    studentId: normalized.studentId,
                    date: normalized.date,
                    status: normalized.status,
                    reason: normalized.reason ?? null,
                    updatedAt: new Date().toISOString(),
                }, { merge: true });
            });
            await batch.commit();
        } catch (error) {
            console.error("Firestore Error:", error);
            alert("Something went wrong. Please try again.");
        }
    },

    addAttendanceRecords: async (schoolId, records) => {
        await get().saveAttendance(schoolId, records);
    },

    saveFeedbacks: async (schoolId, feedbacks) => {
        if (!db || !feedbacks.length) return;
        if (!navigator.onLine) {
            alert("No internet connection");
            return;
        }
        try {
            const batch = writeBatch(db);
            feedbacks.forEach((feedback) => {
                const now = feedback.updatedAt || new Date().toISOString();
                const feedbackText = String(feedback.feedbackText || feedback.remark || '').trim();
                if (!feedback.id || !feedbackText) return;

                batch.set(
                    doc(db, 'schools', schoolId, 'feedbacks', feedback.id),
                    sanitize({
                        ...feedback,
                        feedbackText,
                        remark: feedbackText,
                        status: feedback.status || 'draft',
                        createdAt: feedback.createdAt || now,
                        updatedAt: now,
                        date: feedback.date || now.split('T')[0],
                    }),
                    { merge: true }
                );
            });
            await batch.commit();
        } catch (error) {
            console.error("Firestore Error:", error);
            alert("Something went wrong. Please try again.");
        }
    },

    addFeedback: async (schoolId, feedback) => {
        await get().saveFeedbacks(schoolId, [feedback]);
    },

    updateFee: async (schoolId, studentId, data) => {
        if (!db) return;
        if (!navigator.onLine) {
            alert("No internet connection");
            return;
        }
        try {
            await setDoc(doc(db, 'schools', schoolId, 'fees', studentId), sanitize(data), { merge: true });
        } catch (error) {
            console.error("Firestore Error:", error);
            alert("Something went wrong. Please try again.");
        }
    },
    fetchPaymentsFromSupabase: async (schoolId?: string) => {
        try {
            let query = supabase.from('payments').select('*').order('month_index', { ascending: true });
            if (schoolId) {
                query = query.eq('school_id', schoolId);
            }
            const { data, error } = await query;
            if (error) {
                console.error('fetchPaymentsFromSupabase error:', error);
                return;
            }
            // Map snake_case DB columns to camelCase Payment type
            const payments: Payment[] = (data || []).map((p: any) => ({
                id: p.id,
                studentId: p.student_id,
                studentName: p.student_name,
                classId: p.class_id,
                section: p.section,
                amount: Number(p.amount || 0),
                amount_total: Number(p.amount_total || 0),
                status: p.status,
                date: p.date,
                timestamp: p.timestamp,
                month: p.month,
                monthIndex: p.month_index,
                monthKey: p.month_key,
                year: p.year,
                academicYear: p.academic_year,
                paidAt: p.timestamp,
            }));
            set({ payments, loading: { ...get().loading, fees: false } });
        } catch (err) {
            console.error('fetchPaymentsFromSupabase threw:', err);
        }
    },

    recordPayment: async (schoolId, payment) => {
        try {
            const timestamp = payment.timestamp || new Date().toISOString();

            // ─── STEP 1: Fetch existing payments for this student+month from Supabase ───
            const { data: existingPayments, error: paymentsFetchError } = await supabase
                .from('payments')
                .select('*')
                .eq('student_id', payment.studentId)
                .order('month_index', { ascending: true });

            if (paymentsFetchError) {
                console.error('Fetch payments failed:', paymentsFetchError);
                throw paymentsFetchError;
            }

            // ─── STEP 2: Isolate payments for the exact month being paid ───
            const sameMonthPayments = (existingPayments || []).filter(
                (p: any) =>
                    p.month_index === payment.monthIndex &&
                    p.academic_year === payment.academicYear
            );

            // ─── STEP 3: Lock amount_total from the first DB record (never trust frontend after first payment) ───
            const lockedTotalFee =
                sameMonthPayments.length > 0
                    ? Number(sameMonthPayments[0].amount_total || 0)
                    : Number((payment as any).amount_total || payment.amount || 0);

            // ─── STEP 4: Compute already-paid and remaining due ───
            const totalPaidForMonth = sameMonthPayments.reduce(
                (sum: number, p: any) => sum + Number(p.amount || 0),
                0
            );
            const remainingDue = Math.max(0, lockedTotalFee - totalPaidForMonth);

            // ─── STEP 5: Block if month is already fully paid ───
            if (remainingDue <= 0) {
                alert("This month's fee is already fully paid.");
                return;
            }

            // ─── STEP 6: Determine the amount to insert ───
            // If status is 'paid', pay exactly what's remaining (full settlement).
            // If status is 'partial', pay the requested amount.
            let finalAmount: number;
            if (payment.status === 'paid') {
                finalAmount = remainingDue;
            } else {
                finalAmount = Number(payment.amount || 0);
            }

            // ─── STEP 7: Validate — never allow overpayment ───
            if (finalAmount <= 0) {
                alert('Invalid payment amount.');
                return;
            }
            if (finalAmount > remainingDue) {
                alert(`Cannot pay more than the remaining due amount (₹${remainingDue}).`);
                return;
            }

            // ─── STEP 8: Enforce sequential month payment ───
            const allStudentPayments = (existingPayments || []);
            // Find any month with outstanding balance before the current month
            const monthsPaidSoFar = Array.from(
                new Set(allStudentPayments.map((p: any) => p.month_index))
            ) as number[];
            for (const mIdx of monthsPaidSoFar) {
                if (mIdx >= payment.monthIndex!) continue; // only check prior months
                const priorMonthPmts = allStudentPayments.filter(
                    (p: any) => p.month_index === mIdx && p.academic_year === payment.academicYear
                );
                if (priorMonthPmts.length === 0) continue;
                const priorTotal = Number(priorMonthPmts[0].amount_total || 0);
                const priorPaid = priorMonthPmts.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
                if (priorPaid < priorTotal) {
                    const priorMonth = priorMonthPmts[0].month || `Month ${mIdx}`;
                    alert(`Please clear the pending balance for ${priorMonth} before paying this month.`);
                    return;
                }
            }

            // ─── STEP 9: Determine final status ───
            const newTotalPaid = totalPaidForMonth + finalAmount;
            const finalStatus: string = newTotalPaid >= lockedTotalFee ? 'paid' : 'partial';

            // ─── STEP 10: Insert payment record into Supabase ───
            const { error: paymentError } = await supabase
                .from('payments')
                .insert([{
                    id: `${payment.studentId}_${Date.now()}`,
                    school_id: schoolId,
                    student_id: payment.studentId,
                    student_name: payment.studentName,
                    class_id: payment.classId,
                    section: payment.section,
                    amount: finalAmount,
                    amount_total: lockedTotalFee,    // always use the locked value
                    status: finalStatus,
                    date: payment.date || timestamp.split('T')[0],
                    timestamp,
                    month: payment.month,
                    month_index: payment.monthIndex,
                    month_key: payment.monthKey || `${payment.academicYear}_${payment.monthIndex}`,
                    year: payment.year || new Date(timestamp).getFullYear().toString(),
                    academic_year: payment.academicYear,
                }]);

            if (paymentError) {
                console.error('Payment insert failed:', paymentError);
                throw paymentError;
            }

            // ─── STEP 11: Update student's cumulative paid_amount in Supabase ───
            const { data: studentData, error: fetchStudentError } = await supabase
                .from('students')
                .select('paid_amount')
                .eq('roll_number', payment.studentId)
                .maybeSingle();

            if (fetchStudentError) {
                console.error('Fetch student failed:', fetchStudentError);
                // Non-fatal — don't throw, payment is already recorded
            } else {
                const existingPaid = Number(studentData?.paid_amount || 0);
                const { error: updateError } = await supabase
                    .from('students')
                    .update({ paid_amount: existingPaid + finalAmount })
                    .eq('roll_number', payment.studentId);
                if (updateError) {
                    console.error('Student paid_amount update failed:', updateError);
                }
            }

            // ─── STEP 12: Refresh Zustand payments state from Supabase ───
            // This ensures getFeeSummary() immediately sees the new payment.
            await get().fetchPaymentsFromSupabase(schoolId);

        } catch (error) {
            console.error('Payment error:', error);
            throw error;
        }
    },

    saveFeeConfig: async (schoolId, config) => {
        if (!db) return;
        if (!navigator.onLine) {
            alert("No internet connection");
            return;
        }
        try {
            await setDoc(doc(db, 'schools', schoolId, 'config', 'feeStructure', 'classes', config.classId), sanitize(config));
        } catch (error) {
            console.error("Firestore Error:", error);
            alert("Something went wrong. Please try again.");
        }
    },

    saveExamConfig: async (schoolId, exam) => {
        if (!db) return;
        if (!navigator.onLine) {
            alert("No internet connection");
            return;
        }
        try {
            await setDoc(doc(db, 'schools', schoolId, 'config', 'academic', 'exams', exam.id), sanitize(exam));
        } catch (error) {
            console.error("Firestore Error:", error);
            alert("Something went wrong. Please try again.");
        }
    },

    saveSubjectConfig: async (schoolId, subject) => {
        if (!db) return;
        if (!navigator.onLine) {
            alert("No internet connection");
            return;
        }
        try {
            await setDoc(doc(db, 'schools', schoolId, 'config', 'academic', 'subjects', subject.id), sanitize(subject));
        } catch (error) {
            console.error("Firestore Error:", error);
            alert("Something went wrong. Please try again.");
        }
    },

    saveClassConfig: async (schoolId, classConfig) => {
        if (!db) return;
        try {
            await setDoc(doc(db, 'schools', schoolId, 'classes', classConfig.id), sanitize(classConfig));
        } catch (error) {
            console.error("Firestore Error:", error);
            alert("Something went wrong. Please try again.");
        }
    },

    updateStudentResult: async (schoolId, studentId, examId, subjectId, marks, source = 'manual') => {
      try {
        const now = new Date().toISOString();

        const { error } = await supabase
          .from('marks')
          .upsert(
            [
              {
                id: `${studentId}_${examId}_${subjectId}`,
                school_id: schoolId,
                student_id: studentId,
                subject: subjectId,
                exam_type: examId,
                marks_obtained: Number(marks),
                total_marks: 100,
                date: now,
              }
            ],
            {
              onConflict: 'student_id,exam_type,subject'
            }
          );

        if (error) {
          console.error("Marks insert failed:", error);
          alert("Failed to save marks");
          return;
        }

      } catch (error) {
        console.error("Marks error:", error);
        alert("Something went wrong. Please try again.");
      }
    },

    logUploadRecord: async (schoolId, metadata) => {
        if (!db) return;
        if (!navigator.onLine) {
            alert("No internet connection");
            return;
        }
        try {
            await setDoc(doc(db, 'schools', schoolId, 'uploads', metadata.id), sanitize(metadata));
        } catch (error) {
            console.error("Firestore Error:", error);
            alert("Something went wrong. Please try again.");
        }
    },

    fetchStudentsByClass: (schoolId, classId) => {
        if (!db) return () => { };
        const studentsQuery = query(collection(db, 'schools', schoolId, 'students'), where('classId', '==', classId));
        return onSnapshot(studentsQuery,
            (snapshot) => {
                const classStudents = snapshot.docs.map(doc => doc.data() as Student);
                set(state => {
                    const otherStudents = state.rawStudents.filter(s => s.classId !== classId);
                    const newRaw = [...otherStudents, ...classStudents];
                    return { rawStudents: newRaw, students: augmentStudents(newRaw, state.classes, state.feeSettings), loading: { ...state.loading, students: false } };
                });
            },
            (error) => {
                console.error("Error fetching students by class:", error);
                set(state => ({ loading: { ...state.loading, students: false } }));
            }
        );
    },

    addLoginCredential: async (schoolId, credential) => {
        if (!db) return;
        if (!navigator.onLine) {
            alert("No internet connection");
            return;
        }
        try {
            await setDoc(doc(db, 'schools', schoolId, 'credentials', credential.id), sanitize(credential));
        } catch (error) {
            console.error("Firestore Error:", error);
            alert("Something went wrong. Please try again.");
        }
    },

    updateLoginCredential: async (schoolId, credentialId, data) => {
        if (!db) return;
        if (!navigator.onLine) {
            alert("No internet connection");
            return;
        }
        try {
            await setDoc(doc(db, 'schools', schoolId, 'credentials', credentialId), sanitize(data), { merge: true });
        } catch (error) {
            console.error("Firestore Error:", error);
            alert("Something went wrong. Please try again.");
        }
    },

    deleteLoginCredential: async (schoolId, credentialId) => {
        if (!db) return;
        if (!navigator.onLine) {
            alert("No internet connection");
            return;
        }
        try {
            await deleteDoc(doc(db, 'schools', schoolId, 'credentials', credentialId));
        } catch (error) {
            console.error("Firestore Error:", error);
            alert("Something went wrong. Please try again.");
        }
    },

    updateExamPublishStatus: async (schoolId, studentIds, examId, isPublished) => {
      try {
        const { error } = await supabase
          .from('marks')
          .update({ is_published: isPublished })
          .eq('school_id', schoolId)
          .eq('exam_type', examId)
          .in('student_id', studentIds);

        if (error) {
          console.error("Publish update failed:", error);
          alert("Failed to update publish status");
          return;
        }

      } catch (error) {
        console.error("Publish error:", error);
        alert("Something went wrong while publishing");
      }
    },

    fetchStudents: async (schoolId: string) => {
      const snap = await getDocs(collection(db, "schools", schoolId, "students"));

      const data = snap.docs.map(doc => {
        const d = doc.data();

        return {
          id: doc.id,
          ...d,
          name: d.name || "",
          classId: d.classId || "",
          class: d.class || d.className || "",
          section: d.section || "",
          rollNumber: d.rollNumber || "",
          paidAmount: Number(d.paidAmount || 0),
          totalFees: Number(d.totalFees || 0),
          photoURL: d.photoURL || d.profileImage || "",
          profileImage: d.profileImage || d.photoURL || "",
        };
      }) as any;

      set({ students: data, rawStudents: data, loading: { ...get().loading, students: false } });
    },

    initListeners: () => {
        if (!db) return () => { };

        // Force school_001 identity
        const schoolId = "school_001";
    console.log(`Setting up listeners for school: ${schoolId}`);

    const marksQuery = query(collection(db, 'schools', schoolId, 'marks'));
    const attendanceQuery = query(collection(db, 'schools', schoolId, 'attendance'));
    const feedbacksQuery = query(collection(db, 'schools', schoolId, 'feedbacks'));
    const feesQuery = query(collection(db, 'schools', schoolId, 'fees'));
    const busQuery = query(collection(db, 'schools', schoolId, 'busRoutes'));
    const feeConfigQuery = query(collection(db, 'schools', schoolId, 'config', 'feeStructure', 'classes'));
    const examsQuery = query(collection(db, 'schools', schoolId, 'config', 'academic', 'exams'));
    const subjectsQuery = query(collection(db, 'schools', schoolId, 'config', 'academic', 'subjects'));

    const unsubMarks = onSnapshot(marksQuery,
      (snapshot) => {
        const rawMarks = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as any as Mark));
        set(state => ({ rawMarks, marks: assembleUnifiedMarks(rawMarks, state.students, state.exams, state.subjects), loading: { ...state.loading, marks: false } }));
      },
      (error) => {
        console.error("Error in marks listener:", error);
        set(state => ({ loading: { ...state.loading, marks: false } }));
      }
    );
    const unsubAttendance = onSnapshot(
      attendanceQuery,
      (snapshot) => {
        const attendance = dedupeAttendanceRecords(
          snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as AttendanceRecord[]
        );

        set((state) => ({
          attendance,
          loading: {
            ...state.loading,
            attendance: false,
          },
        }));
      },
      (error) => {
        console.error("Attendance listener error:", error);
      }
    );

    // Payments are stored in Supabase, not Firestore — fetch once on init, then refreshed after each recordPayment
    const unsubPayments = () => {}; // no-op unsubscriber (Firestore listener not used for payments)
    // Kick off initial fetch from Supabase
    get().fetchPaymentsFromSupabase(schoolId).catch(err => {
      console.error('Initial payments fetch from Supabase failed:', err);
      set(state => ({ loading: { ...state.loading, fees: false } }));
    });

    const unsubFeedbacks = onSnapshot(feedbacksQuery,
      (snapshot) => {
        const feedbacks = snapshot.docs
          .map(doc => ({ ...doc.data(), id: doc.id } as any as Feedback))
          .sort((a, b) => new Date(b.updatedAt || b.createdAt || b.date || 0).getTime() - new Date(a.updatedAt || a.createdAt || a.date || 0).getTime());
        set({ feedbacks });
      },
      (error) => {
        console.error("Error in feedback listener:", error);
      }
    );

    const unsubFees = onSnapshot(feesQuery,
      (snapshot) => {
        const fees = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as any as Fee));
        set(state => ({ fees, loading: { ...state.loading, fees: false } }));
      },
      (error) => {
        console.error("Error in fees listener:", error);
        set(state => ({ loading: { ...state.loading, fees: false } }));
      }
    );

    const unsubBus = onSnapshot(busQuery,
      (snapshot) => {
        const busRoutes = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as any as BusRoute));
        set(state => ({ busRoutes, loading: { ...state.loading, busRoutes: false } }));
      },
      (error) => {
        console.error("Error in busRoutes listener:", error);
        set(state => ({ loading: { ...state.loading, busRoutes: false } }));
      }
    );

    const unsubFeeConfig = onSnapshot(feeConfigQuery,
      (snapshot) => {
        const feeConfigs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as any as FeeConfig));
        
        // Populate feeSettings lookup table
        const feeSettingsData: Record<string, { monthlyFee: number; transportFee: number }> = {};
        const state = get();
        
        feeConfigs.forEach(config => {
          if (config.classId) {
            feeSettingsData[config.classId] = {
              monthlyFee: config.totalFee || 0,
              transportFee: config.transportFee || (config.optionalCharges?.transport || 0),
            };
          }
        });

        set(state => {
          const newFeeSettings = feeSettingsData;
          return { 
            feeConfigs, 
            feeSettings: newFeeSettings,
            students: augmentStudents(state.rawStudents, state.classes, newFeeSettings), 
            loading: { ...state.loading, feeConfigs: false } 
          };
        });
      },
      (error) => {
        console.error("Error in feeConfig listener:", error);
        set(state => ({ loading: { ...state.loading, feeConfigs: false } }));
      }
    );

    const credsQuery = query(collection(db, 'schools', schoolId, 'credentials'));
    const unsubCreds = onSnapshot(credsQuery,
      (snapshot) => {
        const loginCredentials = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as any as LoginCredential));
        set(state => ({ loginCredentials, loading: { ...state.loading, credentials: false } }));
      },
      (error) => {
        console.error("Error in credentials listener:", error);
        set(state => ({ loading: { ...state.loading, credentials: false } }));
      }
    );

    const unsubExams = onSnapshot(examsQuery,
      (snapshot) => {
        const exams = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as any as ExamConfig));
        set(state => ({ exams, marks: assembleUnifiedMarks(state.rawMarks, state.students, exams, state.subjects), loading: { ...state.loading, exams: false } }));
      },
      (error) => {
        console.error("Error in exams listener:", error);
        set(state => ({ loading: { ...state.loading, exams: false } }));
      }
    );

    const unsubSubjects = onSnapshot(subjectsQuery,
      (snapshot) => {
        const subjects = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as any as SubjectConfig));
        set(state => ({ subjects, marks: assembleUnifiedMarks(state.rawMarks, state.students, state.exams, subjects), loading: { ...state.loading, subjects: false } }));
      },
      (error) => {
        console.error("Error in subjects listener:", error);
        set(state => ({ loading: { ...state.loading, subjects: false } }));
      }
    );
    const usersQuery = query(collection(db, 'users'));
    const unsubUsers = onSnapshot(usersQuery,
      (snapshot) => {
        const users = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as any as AppUser));
        set({ users, loading: { ...get().loading, users: false } });
      },
      (error) => {
        console.error("Error in users listener:", error);
        set(state => ({ loading: { ...state.loading, users: false } }));
      }
    );

    // Standard Class Listener
    const classesQuery = query(collection(db, 'schools', schoolId, 'classes'));
    const unsubClasses = onSnapshot(classesQuery,
      (snapshot) => {
        const rawClasses = snapshot.docs.map(doc => ({ 
          ...doc.data(),
          id: doc.id, 
          classId: doc.id 
        } as any as ClassConfig));
        // Deduplicate classes by name in the store to prevent UI duplication issues
        const classes = Array.from(new Map(rawClasses.map(c => [c.name, c])).values());
        
        console.log("CLASSES (Deduplicated):", classes);
        set(state => ({
          classes,
          students: augmentStudents(state.rawStudents, classes, state.feeSettings),
          loading: { ...state.loading, classes: false }
        }));
      },
      (error) => {
        console.error("Error in class listener (init):", error);
        set(state => ({ loading: { ...state.loading, classes: false } }));
      }
    );

	        set({ initialized: true });

	        return () => {
	            unsubMarks();
	            unsubAttendance();
	            unsubPayments();
	            unsubFeedbacks();
	            unsubFees();
            unsubBus();
            unsubCreds();
            unsubFeeConfig();
            unsubExams();
            unsubSubjects();
            unsubUsers();
            unsubClasses();
        };
    },

    listenToClasses: () => {
        if (!db) return () => { };
        const schoolId = "school_001";
        const q = query(collection(db, 'schools', schoolId, 'classes'));
        console.log(`Setting up standalone classes listener for school: ${schoolId}`);
        return onSnapshot(q, (snapshot) => {
            const rawClasses = snapshot.docs.map((doc) => ({
                ...doc.data(),
                id: doc.id,
                classId: doc.id,
            } as any as ClassConfig));
            
            const mappedClasses = Array.from(new Map(rawClasses.map(c => [c.name, c])).values());
            console.log("CLASSES (DeduplicatedStandalone):", mappedClasses);
            
            set(state => ({
                classes: mappedClasses,
                students: augmentStudents(state.rawStudents, mappedClasses, state.feeSettings),
                loading: { ...state.loading, classes: false }
            }));
        }, (error) => {
            console.error("Error in classes listener:", error);
            set(state => ({ loading: { ...state.loading, classes: false } }));
        });
    },

    setCurrentUser: (currentUser) => set({
        currentUser,
        currentSchoolId: currentUser?.schoolId || 'school_001',
        loading: { ...get().loading, auth: false }
    }),
}));

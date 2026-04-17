import { create } from 'zustand';
import { db, auth } from '@/firebase';
import { collection, onSnapshot, query, setDoc, doc, deleteDoc, where, arrayUnion, getDoc, addDoc, updateDoc, getDocs, writeBatch } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut as firebaseSignOut, onAuthStateChanged } from 'firebase/auth';
import { Student, Mark, AttendanceRecord, Fee, BusRoute, Feedback, LoginCredential, FeeConfig, ExamConfig, SubjectConfig, ClassConfig, AppUser, Payment } from '@/lib/types';
import { dedupeAttendanceRecords, getAttendanceDocId, normalizeAttendanceRecord, sanitize } from '@/lib/data-utils';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

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
    fetchClassesFromSupabase: (schoolId: string) => Promise<void>;
    fetchSubjectsFromSupabase: (schoolId: string) => Promise<void>;
    fetchExamsFromSupabase: (schoolId: string) => Promise<void>;
    syncStudentsToSupabase: (schoolId: string) => Promise<{ success: number; failed: number }>;
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
    fetchMarksFromSupabase: (schoolId?: string) => Promise<void>;
    setCurrentUser: (user: AppUser | null) => void;
    deleteExamConfig: (schoolId: string, examId: string) => Promise<void>;
    deleteSubjectConfig: (schoolId: string, subjectId: string) => Promise<void>;
    deleteClassConfig: (schoolId: string, classId: string) => Promise<void>;
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
        const classTransportFee = feeSettings?.[withClass.classId || ""]?.transportFee || 0;

        // STEP 3 — TOTAL FEE CALCULATION
        const tuitionFee = withClass.totalFees && withClass.totalFees > 0
            ? Number(withClass.totalFees)
            : Number(classFee);
        
        const busEnabled = !!withClass.transport_enabled;
        const busFee = busEnabled ? Number(withClass.bus?.fee || withClass.bus?.fare || classTransportFee) : 0;

        const totalFees = tuitionFee + busFee;

        const paidAmount = withClass.paidAmount;

        // STEP 4 — DYNAMIC CALCULATION
        const pendingFees = Math.max(0, totalFees - paidAmount);
        
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

    // ─── Supabase fetch helpers ───────────────────────────────────────────────

    fetchClassesFromSupabase: async (schoolId) => {
        try {
            const { data, error } = await supabase
                .from('classes')
                .select('*')
                .eq('school_id', schoolId)
                .order('order', { ascending: true });
            if (error) throw error;
            const rawClasses = (data || []).map((r: any) => ({
                id: r.id,
                classId: r.id,
                name: r.name,
                order: r.order ?? 0,
                sections: r.sections ?? [],
            } as ClassConfig));
            const classes = Array.from(new Map(rawClasses.map(c => [c.name, c])).values());
            set(state => ({
                classes,
                students: augmentStudents(state.rawStudents, classes, state.feeSettings),
                loading: { ...state.loading, classes: false },
            }));
        } catch (err) {
            console.error('fetchClassesFromSupabase failed:', err);
            set(state => ({ loading: { ...state.loading, classes: false } }));
        }
    },

    fetchSubjectsFromSupabase: async (schoolId) => {
        try {
            const { data, error } = await supabase
                .from('subjects')
                .select('*')
                .eq('school_id', schoolId);
            if (error) throw error;
            const subjects = (data || []).map((r: any) => ({
                id: r.id,
                subjectId: r.id,
                name: r.name,
                classIds: r.class_ids ?? [],
            } as SubjectConfig));
            set(state => ({
                subjects,
                marks: assembleUnifiedMarks(state.rawMarks, state.students, state.exams, subjects),
                loading: { ...state.loading, subjects: false },
            }));
        } catch (err) {
            console.error('fetchSubjectsFromSupabase failed:', err);
            set(state => ({ loading: { ...state.loading, subjects: false } }));
        }
    },

    fetchExamsFromSupabase: async (schoolId) => {
        try {
            const { data, error } = await supabase
                .from('exams')
                .select('*')
                .eq('school_id', schoolId)
                .order('order', { ascending: true });
            if (error) throw error;
            const exams = (data || []).map((r: any) => ({
                id: r.id,
                examId: r.id,
                name: r.name,
                order: r.order ?? 0,
                examDate: r.exam_date ?? undefined,
                resultDate: r.result_date ?? undefined,
                isPublished: r.is_published ?? false,
            } as ExamConfig));
            set(state => ({
                exams,
                marks: assembleUnifiedMarks(state.rawMarks, state.students, exams, state.subjects),
                loading: { ...state.loading, exams: false },
            }));
        } catch (err) {
            console.error('fetchExamsFromSupabase failed:', err);
            set(state => ({ loading: { ...state.loading, exams: false } }));
        }
    },

    // ─── Config saves (Supabase) ──────────────────────────────────────────────

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
        try {
            const { error } = await supabase.from('exams').upsert({
                id: exam.id,
                school_id: schoolId,
                name: exam.name,
                order: exam.order ?? 0,
                exam_date: exam.examDate ?? null,
                result_date: exam.resultDate ?? null,
                is_published: exam.isPublished ?? false,
            }, { onConflict: 'id' });
            if (error) throw error;
            await get().fetchExamsFromSupabase(schoolId);
        } catch (error) {
            console.error("saveExamConfig error:", error);
            toast.error("Failed to save exam");
        }
    },

    saveSubjectConfig: async (schoolId, subject) => {
        try {
            const { error } = await supabase.from('subjects').upsert({
                id: subject.id,
                school_id: schoolId,
                name: subject.name,
                class_ids: subject.classIds ?? [],
            }, { onConflict: 'id' });
            if (error) throw error;
            await get().fetchSubjectsFromSupabase(schoolId);
        } catch (error) {
            console.error("saveSubjectConfig error:", error);
            toast.error("Failed to save subject");
        }
    },

    saveClassConfig: async (schoolId, classConfig) => {
        try {
            const { error } = await supabase.from('classes').upsert({
                id: classConfig.id,
                school_id: schoolId,
                name: classConfig.name,
                order: classConfig.order ?? 0,
                sections: classConfig.sections ?? [],
            }, { onConflict: 'id' });
            if (error) throw error;
            await get().fetchClassesFromSupabase(schoolId);
        } catch (error) {
            console.error("saveClassConfig error:", error);
            toast.error("Failed to save class");
        }
    },

    deleteExamConfig: async (schoolId, examId) => {
        try {
            const { error } = await supabase
                .from('exams')
                .delete()
                .eq('id', examId)
                .eq('school_id', schoolId);
            if (error) throw error;
            await get().fetchExamsFromSupabase(schoolId);
        } catch (error) {
            console.error("deleteExamConfig error:", error);
            toast.error("Failed to delete exam");
        }
    },

    deleteSubjectConfig: async (schoolId, subjectId) => {
        try {
            const { error } = await supabase
                .from('subjects')
                .delete()
                .eq('id', subjectId)
                .eq('school_id', schoolId);
            if (error) throw error;
            await get().fetchSubjectsFromSupabase(schoolId);
        } catch (error) {
            console.error("deleteSubjectConfig error:", error);
            toast.error("Failed to delete subject");
        }
    },

    deleteClassConfig: async (schoolId, classId) => {
        try {
            const { error } = await supabase
                .from('classes')
                .delete()
                .eq('id', classId)
                .eq('school_id', schoolId);
            if (error) throw error;
            await get().fetchClassesFromSupabase(schoolId);
        } catch (error) {
            console.error("deleteClassConfig error:", error);
            toast.error("Failed to delete class");
        }
    },

    updateStudentResult: async (schoolId, studentId, examId, subjectId, marks, source = 'manual') => {
      try {
        const now = new Date().toISOString();

        // ─── STEP 1: Fetch existing publish status if record exists ───
        const { data: existingMark } = await supabase
          .from('marks')
          .select('is_published')
          .eq('school_id', schoolId)
          .eq('student_id', studentId)
          .eq('exam_type', examId)
          .eq('subject', subjectId)
          .maybeSingle();

        // ─── STEP 2: Upsert mark (ensures no duplicate key conflict) ───
        const { error } = await supabase
          .from('marks')
          .upsert([{
            id: `${studentId}_${examId}_${subjectId}`,
            school_id: schoolId,
            student_id: studentId,
            subject: subjectId,
            exam_type: examId,
            marks_obtained: Number(marks),
            total_marks: 100,
            date: now,
            is_published: existingMark?.is_published ?? false
          }]);

        if (error) {
          console.error("Marks upsert failed:", error);
          throw error;
        }

        // ─── STEP 3: Refresh state ───
        await get().fetchMarksFromSupabase(schoolId);

      } catch (error) {
        console.error("Marks update error:", error);
        throw error;
      }
    },

    fetchMarksFromSupabase: async (schoolId?: string) => {
        try {
            let query = supabase.from('marks').select('*');
            if (schoolId) query = query.eq('school_id', schoolId);
            
            const { data, error } = await query;
            if (error) throw error;

            const subjectsMap = new Map(get().subjects.map(s => [s.id, s.name]));
            const examsMap = new Map(get().exams.map(e => [e.id, e.name]));

            const rawMarks: Mark[] = (data || []).map((m: any) => ({
                id: m.id,
                studentId: m.student_id,
                subject: subjectsMap.get(m.subject) || m.subject,
                examType: (examsMap.get(m.exam_type) || m.exam_type) as any,
                marksObtained: Number(m.marks_obtained),
                totalMarks: Number(m.total_marks || 100),
                date: m.date,
                isPublished: m.is_published,
                subjectId: m.subject, // Store raw ID for lookup
                examId: m.exam_type   // Store raw ID for lookup
            }));

            set(state => ({ 
                rawMarks, 
                marks: assembleUnifiedMarks(rawMarks, state.students, state.exams, state.subjects),
                loading: { ...state.loading, marks: false } 
            }));
        } catch (err) {
            console.error('fetchMarksFromSupabase failed:', err);
            set(state => ({ loading: { ...state.loading, marks: false } }));
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
          throw error;
        }

        // Refresh state
        await get().fetchMarksFromSupabase(schoolId);

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

    syncStudentsToSupabase: async (schoolId: string) => {
        if (!db) throw new Error("Firebase not initialized");
        
        // 1. Fetch all students from Firestore
        const snap = await getDocs(collection(db, "schools", schoolId, "students"));
        const firebaseStudents = snap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as any[];

        let success = 0;
        let failed = 0;

        // 2. Map and Upsert to Supabase
        // We'll process them in small batches or individually to be safe
        for (const s of firebaseStudents) {
            // Guard: skip students without roll number and id
            if (!s.rollNumber && !s.id) {
                console.error('Skipping student without roll number:', s);
                failed++;
                continue;
            }
            try {
                const { error } = await supabase
                    .from('students')
                    .upsert({
                        // id: s.id.match(/^[0-9a-fA-F-]{36}$/) ? s.id : undefined, // only use if valid UUID
                        school_id: schoolId,
                        roll_number: String(s.rollNumber || s.id || '').trim(),
                        name: s.name || "Unknown",
                        class: s.class || s.className || "",
                        section: s.section || "",
                        parent_name: s.parentName || "",
                        parent_contact: s.parentContact || "",
                        total_fees: Number(s.totalFees || 0),
                        paid_amount: Number(s.paidAmount || 0),
                        is_active: s.isActive !== false,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'school_id,roll_number' });

                if (error) {
                    console.error(`Sync failed for ${s.name}:`, error);
                    failed++;
                } else {
                    success++;
                }
            } catch (err) {
                console.error(`Sync error for ${s.name}:`, err);
                failed++;
            }
        }

        return { success, failed };
    },

    initListeners: () => {
        if (!db) return () => { };

        // Force school_001 identity
        const schoolId = "school_001";
        console.log(`Setting up listeners for school: ${schoolId}`);

        const attendanceQuery = query(collection(db, 'schools', schoolId, 'attendance'));
        const feedbacksQuery  = query(collection(db, 'schools', schoolId, 'feedbacks'));
        const feesQuery       = query(collection(db, 'schools', schoolId, 'fees'));
        const busQuery        = query(collection(db, 'schools', schoolId, 'busRoutes'));
        const feeConfigQuery  = query(collection(db, 'schools', schoolId, 'config', 'feeStructure', 'classes'));

        // ── Marks (Supabase) ─────────────────────────────────────────────────
        const unsubMarks = () => {};
        get().fetchMarksFromSupabase(schoolId).catch(err => {
            console.error('Initial marks fetch failed:', err);
            set(state => ({ loading: { ...state.loading, marks: false } }));
        });

        // ── Classes (Supabase) ───────────────────────────────────────────────
        const unsubClasses = () => {};
        get().fetchClassesFromSupabase(schoolId).catch(err => {
            console.error('Initial classes fetch failed:', err);
            set(state => ({ loading: { ...state.loading, classes: false } }));
        });

        // ── Subjects (Supabase) ──────────────────────────────────────────────
        const unsubSubjects = () => {};
        get().fetchSubjectsFromSupabase(schoolId).catch(err => {
            console.error('Initial subjects fetch failed:', err);
            set(state => ({ loading: { ...state.loading, subjects: false } }));
        });

        // ── Exams (Supabase) ─────────────────────────────────────────────────
        const unsubExams = () => {};
        get().fetchExamsFromSupabase(schoolId).catch(err => {
            console.error('Initial exams fetch failed:', err);
            set(state => ({ loading: { ...state.loading, exams: false } }));
        });

        // ── Attendance (Firebase) ────────────────────────────────────────────
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
                    loading: { ...state.loading, attendance: false },
                }));
            },
            (error) => {
                console.error("Attendance listener error:", error);
            }
        );

        // ── Payments (Supabase) ──────────────────────────────────────────────
        const unsubPayments = () => {};
        get().fetchPaymentsFromSupabase(schoolId).catch(err => {
            console.error('Initial payments fetch from Supabase failed:', err);
            set(state => ({ loading: { ...state.loading, fees: false } }));
        });

        // ── Feedbacks (Firebase) ─────────────────────────────────────────────
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

        // ── Fees (Firebase) ──────────────────────────────────────────────────
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

        // ── Bus Routes (Firebase) ────────────────────────────────────────────
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

        // ── Fee Config (Firebase) ────────────────────────────────────────────
        const unsubFeeConfig = onSnapshot(feeConfigQuery,
            (snapshot) => {
                const feeConfigs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as any as FeeConfig));
                const feeSettingsData: Record<string, { monthlyFee: number; transportFee: number }> = {};
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
                        loading: { ...state.loading, feeConfigs: false },
                    };
                });
            },
            (error) => {
                console.error("Error in feeConfig listener:", error);
                set(state => ({ loading: { ...state.loading, feeConfigs: false } }));
            }
        );

        // ── Credentials (Firebase) ───────────────────────────────────────────
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

        // ── Users (Firebase) ─────────────────────────────────────────────────
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

    listenToClasses: (_schoolId?: string) => {
        // Supabase-backed: kick off an async fetch and return a no-op unsubscribe
        const schoolId = "school_001";
        console.log(`Fetching classes from Supabase for school: ${schoolId}`);
        get().fetchClassesFromSupabase(schoolId).catch(err => {
            console.error('listenToClasses (Supabase) failed:', err);
        });
        return () => {}; // no active subscription to tear down
    },

    setCurrentUser: (currentUser) => set({
        currentUser,
        currentSchoolId: currentUser?.schoolId || 'school_001',
        loading: { ...get().loading, auth: false }
    }),
}));

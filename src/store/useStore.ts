import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { Student, Mark, AttendanceRecord, Fee, BusRoute, Feedback, LoginCredential, FeeConfig, ExamConfig, SubjectConfig, ClassConfig, AppUser, Payment } from '@/lib/types';
import { dedupeAttendanceRecords, getAttendanceDocId, normalizeAttendanceRecord, sanitize } from '@/lib/data-utils';
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
    fetchFeeConfigs: (schoolId: string) => Promise<void>;
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
    updateStudentTransport: (schoolId: string, studentId: string, data: { transport_enabled: boolean; bus_route_id?: string; bus_stop?: string }) => Promise<void>;
    fetchBusRoutes: (schoolId: string) => Promise<void>;
    fetchAttendanceFromSupabase: (schoolId: string) => Promise<void>;
    addStudent: (schoolId: string, student: Student) => Promise<void>;
    addMark: (schoolId: string, mark: Mark) => Promise<void>;
    addAttendanceRecords: (schoolId: string, records: AttendanceRecord[]) => Promise<void>;
    saveAttendance: (schoolId: string, records: AttendanceRecord[]) => Promise<void>;
    saveFeedbacks: (schoolId: string, feedbacks: Feedback[]) => Promise<void>;
    addFeedback: (schoolId: string, feedback: Feedback) => Promise<void>;
    fetchFeedbacksFromSupabase: (schoolId: string) => Promise<void>;
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
    fetchUsersFromSupabase: (schoolId: string) => Promise<void>;
    init: (schoolId: string) => Promise<void>;
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
        users: false,
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

    setStudents: (rawStudents) => set((state: AppState) => ({ 
        rawStudents, 
        students: augmentStudents(rawStudents, state.classes, state.feeSettings), 
        loading: { ...state.loading, students: false } 
    })),
    setMarks: (marks) => set({ marks }),
    setAttendance: (attendance) => set({ attendance }),

    addBusRoute: async (schoolId, route) => {
        try {
            const stops = (route.stops || []).map(s => ({
                name: s.name,
                time: s.time,
                order: s.order,
            }));
            const { error } = await supabase
                .from('bus_routes')
                .upsert({
                    id: route.id,
                    school_id: schoolId,
                    route_name: route.routeName,
                    route_number: route.routeNumber,
                    driver_name: route.driverName,
                    driver_contact: route.driverContact,
                    vehicle_number: route.vehicleNumber,
                    capacity: route.capacity,
                    status: route.status || 'Active',
                    stops: stops,
                    assigned_students: route.assignedStudents || [],
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'id' });
            if (error) throw error;
            await get().fetchBusRoutes(schoolId);
        } catch (error) {
            console.error('addBusRoute error:', error);
            toast.error('Failed to add bus route');
        }
    },

    updateBusRoute: async (schoolId, routeId, data) => {
        try {
            const updatePayload: any = { updated_at: new Date().toISOString() };
            if (data.status !== undefined) updatePayload.status = data.status;
            if (data.driverName !== undefined) updatePayload.driver_name = data.driverName;
            if (data.driverContact !== undefined) updatePayload.driver_contact = data.driverContact;
            if ((data as any).assignedStudents !== undefined) updatePayload.assigned_students = (data as any).assignedStudents;
            if ((data as any).stops !== undefined) updatePayload.stops = (data as any).stops;

            const { error } = await supabase
                .from('bus_routes')
                .update(updatePayload)
                .eq('id', routeId)
                .eq('school_id', schoolId);
            if (error) throw error;
            await get().fetchBusRoutes(schoolId);
        } catch (error) {
            console.error('updateBusRoute error:', error);
            toast.error('Failed to update bus route');
        }
    },

    updateStudentTransport: async (schoolId, studentId, data) => {
        try {
            const { error } = await supabase
                .from('students')
                .update({
                    transport_enabled: data.transport_enabled,
                    uses_bus: data.transport_enabled,
                    bus_route_id: data.bus_route_id || null,
                    bus_stop: data.bus_stop || null,
                    updated_at: new Date().toISOString(),
                })
                .eq('roll_number', studentId)
                .eq('school_id', schoolId);
            if (error) throw error;
            await get().fetchStudents(schoolId);
        } catch (error) {
            console.error('updateStudentTransport error:', error);
            toast.error('Failed to update transport settings');
        }
    },

    fetchBusRoutes: async (schoolId) => {
        try {
            const { data, error } = await supabase
                .from('bus_routes')
                .select('*')
                .eq('school_id', schoolId);
            if (error) throw error;
            const busRoutes: BusRoute[] = (data || []).map((r: any) => ({
                id: r.id,
                // Handle both snake_case (new) and camelCase/legacy column names
                routeName: r.route_name || r.routeName || r.name || '',
                routeNumber: r.route_number || r.routeNumber || '',
                driverName: r.driver_name || r.driverName || '',
                driverContact: r.driver_contact || r.driverContact || r.driver_phone || '',
                vehicleNumber: r.vehicle_number || r.vehicleNumber || r.vehicle_no || '',
                capacity: Number(r.capacity || 40),
                status: r.status || 'Active',
                stops: Array.isArray(r.stops) ? r.stops : [],
                assignedStudents: Array.isArray(r.assigned_students)
                    ? r.assigned_students
                    : Array.isArray(r.assignedStudents) ? r.assignedStudents : [],
            }));
            set((state: AppState) => ({ busRoutes, loading: { ...state.loading, busRoutes: false } }));
        } catch (err) {
            console.error('fetchBusRoutes failed:', err);
            set((state: AppState) => ({ loading: { ...state.loading, busRoutes: false } }));
        }
    },


    fetchAttendanceFromSupabase: async (schoolId) => {
        try {
            set((state: AppState) => ({ loading: { ...state.loading, attendance: true } }));
            
            let allData: any[] = [];
            let page = 0;
            const pageSize = 1000;
            let hasMore = true;

            while (hasMore) {
                const { data, error } = await supabase
                    .from('attendance')
                    .select('*')
                    .eq('school_id', schoolId)
                    .range(page * pageSize, (page + 1) * pageSize - 1);

                if (error) throw error;
                if (!data || data.length === 0) {
                    hasMore = false;
                } else {
                    allData = [...allData, ...data];
                    hasMore = data.length === pageSize;
                    page++;
                }
            }

            const attendance = dedupeAttendanceRecords(
                allData.map((r: any) => ({
                    id: r.id,
                    studentId: r.student_id,
                    date: r.date,
                    status: r.status,
                    reason: r.reason,
                    updatedAt: r.updated_at,
                } as AttendanceRecord))
            );
            set((state: AppState) => ({ attendance, loading: { ...state.loading, attendance: false } }));
        } catch (err) {
            console.error('fetchAttendanceFromSupabase failed:', err);
            set((state: AppState) => ({ loading: { ...state.loading, attendance: false } }));
        }
    },

    addStudent: async (schoolId, student) => {
        try {
            const { error } = await supabase
                .from('students')
                .insert([{
                    school_id: schoolId,
                    roll_number: student.rollNumber,
                    name: student.name || "",
                    class: student.class || "",
                    class_id: student.classId || student.class || "",
                    section: student.section || "",
                    total_fees: Number(student.totalFees || 0),
                    paid_amount: Number(student.paidAmount || 0),
                    parent_name: student.parentName || "",
                    parent_contact: student.parentContact || "",
                    mother_name: (student as any).motherName || "",
                    address: (student as any).address || "",
                    date_of_birth: (student as any).dateOfBirth || null,
                    blood_group: (student as any).bloodGroup || "",
                    transport_enabled: (student as any).transport_enabled || false,
                    uses_bus: (student as any).transport_enabled || false,
                    bus_route_id: (student as any).bus?.route_id || null,
                    bus_stop: (student as any).bus?.stop || null,
                    created_at: new Date().toISOString()
                }]);

            if (error) {
                console.error("❌ Supabase insert failed:", error);
                throw error;
            }

            // Refresh students after insert
            await get().fetchStudents(schoolId);

        } catch (error) {
            console.error("❌ Add student error:", error);
        }
    },

    addMark: async (schoolId, mark) => {
        try {
            const { error } = await supabase.from('marks').upsert({
                id: mark.id,
                school_id: schoolId,
                student_id: mark.studentId,
                subject: mark.subject,
                subject_id: mark.subjectId,
                exam_id: mark.examId,
                exam_type: mark.examType,
                marks_obtained: mark.marksObtained,
                total_marks: mark.totalMarks,
                date: mark.date,
                is_published: mark.isPublished ?? false,
            }, { onConflict: 'id' });
            if (error) throw error;
        } catch (error) {
            console.error('addMark error:', error);
        }
    },

    saveAttendance: async (schoolId, records) => {
        try {
            const deduped = dedupeAttendanceRecords(records).map(record => {
                const normalized = normalizeAttendanceRecord(record);
                return {
                    id: getAttendanceDocId(normalized.studentId, normalized.date),
                    school_id: schoolId,
                    student_id: normalized.studentId,
                    date: normalized.date,
                    status: normalized.status,
                    reason: normalized.reason ?? null,
                    updated_at: new Date().toISOString(),
                };
            });

            const { error } = await supabase
                .from('attendance')
                .upsert(deduped, { onConflict: 'id' });

            if (error) {
                console.error('saveAttendance Supabase error:', error);
                throw error;
            }

            // Refresh attendance state
            const { data } = await supabase
                .from('attendance')
                .select('*')
                .eq('school_id', schoolId);

            if (data) {
                const attendance = dedupeAttendanceRecords(
                    (data || []).map((r: any) => ({
                        id: r.id,
                        studentId: r.student_id,
                        date: r.date,
                        status: r.status,
                        reason: r.reason,
                        updatedAt: r.updated_at,
                    } as AttendanceRecord))
                );
                set((state: AppState) => ({ attendance, loading: { ...state.loading, attendance: false } }));
            }
        } catch (error) {
            console.error('saveAttendance error:', error);
            throw error;
        }
    },

    addAttendanceRecords: async (schoolId, records) => {
        await get().saveAttendance(schoolId, records);
    },

    saveFeedbacks: async (schoolId, feedbacks) => {
        if (!feedbacks.length) return;
        try {
            const rows = feedbacks
                .map(feedback => {
                    const feedbackText = String(feedback.feedbackText || (feedback as any).remark || '').trim();
                    if (!feedback.id || !feedbackText) return null;
                    return {
                        id: feedback.id,
                        school_id: schoolId,
                        student_id: feedback.studentId,
                        class: feedback.class || '',
                        class_id: feedback.classId || '',
                        section: feedback.section || '',
                        teacher_id: feedback.teacherId || '',
                        teacher_name: feedback.teacherName || '',
                        exam_type: feedback.examType || '',
                        feedback_text: feedbackText,
                        status: feedback.status || 'draft',
                        category: feedback.category || 'Academic',
                        created_at: feedback.createdAt || new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    };
                })
                .filter(Boolean);
            if (!rows.length) return;
            const { error } = await supabase.from('feedbacks').upsert(rows, { onConflict: 'id' });
            if (error) {
                console.error('saveFeedbacks DB error:', error.message, error.details);
                toast.error(`Failed to save feedback: ${error.message}`);
                throw error;
            }
            // Refresh feedbacks state so the teacher form shows updated Draft/Published status
            await get().fetchFeedbacksFromSupabase(schoolId);
        } catch (error) {
            console.error('saveFeedbacks error:', error);
        }
    },

    addFeedback: async (schoolId, feedback) => {
        await get().saveFeedbacks(schoolId, [feedback]);
    },

    fetchFeedbacksFromSupabase: async (schoolId) => {
        if (!schoolId) return;
        try {
            // Avoid ordering server-side in case updated_at column is missing;
            // sort client-side instead
            const { data, error } = await supabase
                .from('feedbacks')
                .select('*')
                .eq('school_id', schoolId);
            if (error) {
                console.error('fetchFeedbacksFromSupabase error:', error.message);
                return; // non-fatal — feedbacks just won't show existing status
            }
            const feedbacks: Feedback[] = (data || [])
                .map((row: any) => ({
                    id: String(row.id || ''),
                    studentId: String(row.student_id || row.studentId || ''),
                    class: row.class || '',
                    classId: row.class_id || row.classId || '',
                    section: row.section || '',
                    teacherId: row.teacher_id || row.teacherId || '',
                    teacherName: row.teacher_name || row.teacherName || 'Teacher',
                    examType: row.exam_type || row.examType || '',
                    feedbackText: row.feedback_text || row.feedbackText || '',
                    remark: row.remark || row.feedback_text || '',
                    status: (row.status === 'published' ? 'published' : 'draft') as 'draft' | 'published',
                    category: row.category || undefined,
                    createdAt: row.created_at || row.createdAt || '',
                    updatedAt: row.updated_at || row.updatedAt || '',
                    date: row.date || '',
                }))
                // Sort newest-first client-side
                .sort((a, b) => {
                    const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
                    const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
                    return tb - ta;
                });
            set({ feedbacks });
        } catch (error) {
            console.error('fetchFeedbacksFromSupabase unexpected error:', error);
        }
    },

    updateFee: async (schoolId, studentId, data) => {
        try {
            const { error } = await supabase
                .from('students')
                .update({
                    paid_amount: (data as any).paidAmount || 0,
                    updated_at: new Date().toISOString(),
                })
                .eq('roll_number', studentId)
                .eq('school_id', schoolId);
            if (error) throw error;
        } catch (error) {
            console.error('updateFee error:', error);
        }
    },
    fetchPaymentsFromSupabase: async (schoolId?: string) => {
        try {
            set((state: AppState) => ({ loading: { ...state.loading, fees: true } }));
            
            let allData: any[] = [];
            let page = 0;
            const pageSize = 1000;
            let hasMore = true;

            while (hasMore) {
                let query = supabase.from('payments').select('*').order('month_index', { ascending: true });
                if (schoolId) query = query.eq('school_id', schoolId);
                
                const { data, error } = await query
                    .range(page * pageSize, (page + 1) * pageSize - 1);

                if (error) throw error;
                if (!data || data.length === 0) {
                    hasMore = false;
                } else {
                    allData = [...allData, ...data];
                    hasMore = data.length === pageSize;
                    page++;
                }
            }

            // Map snake_case DB columns to camelCase Payment type
            const payments: Payment[] = allData.map((p: any) => ({
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
                toast.error("This month's fee is already fully paid.");
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
                toast.error('Invalid payment amount.');
                return;
            }
            if (finalAmount > remainingDue) {
                toast.error(`Cannot pay more than the remaining due amount (₹${remainingDue}).`);
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
                    toast.error(`Please clear the pending balance for ${priorMonth} before paying this month.`);
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
            set((state: AppState) => ({
                classes,
                students: augmentStudents(state.rawStudents, classes, state.feeSettings),
                loading: { ...state.loading, classes: false },
            }));
        } catch (err) {
            console.error('fetchClassesFromSupabase failed:', err);
            set((state: AppState) => ({ loading: { ...state.loading, classes: false } }));
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
            set((state: AppState) => ({
                subjects,
                marks: assembleUnifiedMarks(state.rawMarks, state.students, state.exams, subjects),
                loading: { ...state.loading, subjects: false },
            }));
        } catch (err) {
            console.error('fetchSubjectsFromSupabase failed:', err);
            set((state: AppState) => ({ loading: { ...state.loading, subjects: false } }));
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
            set((state: AppState) => ({
                exams,
                marks: assembleUnifiedMarks(state.rawMarks, state.students, exams, state.subjects),
                loading: { ...state.loading, exams: false },
            }));
        } catch (err) {
            console.error('fetchExamsFromSupabase failed:', err);
            set((state: AppState) => ({ loading: { ...state.loading, exams: false } }));
        }
    },

    // ─── Config saves (Supabase) ──────────────────────────────────────────────

    fetchFeeConfigs: async (schoolId) => {
        try {
            const { data, error } = await supabase
                .from('fee_configs')
                .select('*')
                .eq('school_id', schoolId);
            if (error) throw error;

            const feeConfigs: FeeConfig[] = (data || []).map((r: any) => ({
                classId: r.class_id,
                totalFee: Number(r.monthly_fee || r.total_fee || 0),
                transportFee: Number(r.transport_fee || 0),
                optionalCharges: {
                    transport: Number(r.transport_fee || 0),
                },
            }));

            const feeSettingsData: Record<string, { monthlyFee: number; transportFee: number }> = {};
            feeConfigs.forEach(config => {
                if (config.classId) {
                    feeSettingsData[config.classId] = {
                        monthlyFee: config.totalFee || 0,
                        transportFee: config.transportFee || config.optionalCharges?.transport || 0,
                    };
                }
            });

            set((state: AppState) => ({
                feeConfigs,
                feeSettings: feeSettingsData,
                students: augmentStudents(state.rawStudents, state.classes, feeSettingsData),
                loading: { ...state.loading, feeConfigs: false },
            }));
        } catch (err) {
            console.error('fetchFeeConfigs failed:', err);
            set((state: AppState) => ({ loading: { ...state.loading, feeConfigs: false } }));
        }
    },

    saveFeeConfig: async (schoolId, config) => {
        // Safe SELECT → UPDATE or INSERT (no DB unique constraint needed)
        const { data: existing } = await supabase
            .from('fee_configs')
            .select('id')
            .eq('school_id', schoolId)
            .eq('class_id', config.classId)
            .maybeSingle();

        const payload = {
            monthly_fee: config.totalFee,
            transport_fee: config.optionalCharges?.transport || config.transportFee || 0,
            updated_at: new Date().toISOString(),
        };

        let queryError;
        if (existing?.id) {
            const { error } = await supabase.from('fee_configs').update(payload).eq('id', existing.id);
            queryError = error;
        } else {
            const { error } = await supabase.from('fee_configs').insert({
                ...payload,
                school_id: schoolId,
                class_id: config.classId,
            });
            queryError = error;
        }

        if (queryError) {
            console.error('saveFeeConfig error:', queryError);
            throw new Error(queryError.message || 'Failed to save fee structure');
        }
        await get().fetchFeeConfigs(schoolId);
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
        if (!schoolId || !studentId || !examId || !subjectId) {
          throw new Error('Please select an exam and subject before entering marks.');
        }

        const now = new Date().toISOString();

        // Use limit(1) array query — avoids maybeSingle() "multiple rows" error
        const { data: rows, error: selectError } = await supabase
          .from('marks')
          .select('id, is_published')
          .eq('school_id', schoolId)
          .eq('student_id', studentId)
          .eq('exam_type', examId)
          .eq('subject', subjectId)
          .limit(1);

        if (selectError) throw selectError;

        const existing = rows?.[0];
        const savedId = existing?.id || crypto.randomUUID();

        if (existing?.id) {
          // UPDATE existing record — preserves is_published flag
          const { error } = await supabase
            .from('marks')
            .update({
              marks_obtained: Number(marks),
              total_marks: 100,
              date: now,
              updated_at: now,
            })
            .eq('id', existing.id);
          if (error) throw error;
        } else {
          // INSERT new — generate UUID client-side (avoids DB id default issues)
          const { error } = await supabase
            .from('marks')
            .insert({
              id: savedId,
              school_id: schoolId,
              student_id: studentId,
              subject: subjectId,
              exam_type: examId,
              marks_obtained: Number(marks),
              total_marks: 100,
              date: now,
              is_published: false,
              source,
              updated_at: now,
            });
          if (error) throw error;
        }

        // ─── Optimistic local state update (no DB refetch = no jitter) ───
        // Build the mark in the same shape fetchMarksFromSupabase produces
        const state = get();
        const subjectsMap = new Map(state.subjects.map(s => [s.id, s.name]));
        const examsMap    = new Map(state.exams.map(e => [e.id, e.name]));

        const updatedMark: Mark = {
          id: savedId,
          studentId,
          subject:       subjectsMap.get(subjectId) || subjectId,
          examType:      (examsMap.get(examId) || examId) as any,
          marksObtained: Number(marks),
          totalMarks:    100,
          date:          now,
          isPublished:   existing?.is_published ?? false,
          subjectId,
          examId,
        } as any;

        set((state: AppState) => {
          const currentRaw = state.rawMarks || [];
          const idx = currentRaw.findIndex(
            m => (m as any).subjectId === subjectId &&
                 (m as any).examId   === examId &&
                 m.studentId         === studentId
          );
          const newRawMarks = idx >= 0
            ? currentRaw.map((m, i) => (i === idx ? updatedMark : m))
            : [...currentRaw, updatedMark];
          return {
            rawMarks: newRawMarks,
            marks: assembleUnifiedMarks(newRawMarks, state.students, state.exams, state.subjects),
          };
        });

      } catch (error) {
        console.error('updateStudentResult error:', error);
        throw error;
      }
    },


    fetchMarksFromSupabase: async (schoolId?: string) => {
        try {
            set((state: AppState) => ({ loading: { ...state.loading, marks: true } }));
            
            let allData: any[] = [];
            let page = 0;
            const pageSize = 1000;
            let hasMore = true;

            while (hasMore) {
                let query = supabase.from('marks').select('*');
                if (schoolId) query = query.eq('school_id', schoolId);
                
                const { data, error } = await query
                    .range(page * pageSize, (page + 1) * pageSize - 1);

                if (error) throw error;
                if (!data || data.length === 0) {
                    hasMore = false;
                } else {
                    allData = [...allData, ...data];
                    hasMore = data.length === pageSize;
                    page++;
                }
            }

            const subjectsMap = new Map(get().subjects.map(s => [s.id, s.name]));
            const examsMap = new Map(get().exams.map(e => [e.id, e.name]));

            const rawMarks: Mark[] = allData.map((m: any) => ({
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

            set((state: AppState) => ({ 
                rawMarks, 
                marks: assembleUnifiedMarks(rawMarks, state.students, state.exams, state.subjects),
                loading: { ...state.loading, marks: false } 
            }));
        } catch (err) {
            console.error('fetchMarksFromSupabase failed:', err);
            set((state: AppState) => ({ loading: { ...state.loading, marks: false } }));
        }
    },

    logUploadRecord: async (schoolId, metadata) => {
        try {
            // Log to an uploads audit table if it exists; silently skip if not
            await supabase.from('upload_logs').upsert({
                id: metadata.id,
                school_id: schoolId,
                file_name: metadata.fileName,
                uploaded_by: metadata.uploadedBy,
                records_count: metadata.recordsCount || 0,
                created_at: new Date().toISOString(),
            }, { onConflict: 'id' }).then(() => { /* ignore table-not-found errors */ });
        } catch {
            // Non-critical: don't throw
        }
    },

    fetchStudentsByClass: (schoolId, classId) => {
        // Trigger an async fetch and return no-op unsubscribe (Supabase is not realtime here)
        get().fetchStudents(schoolId).catch(err => console.error('fetchStudentsByClass error:', err));
        return () => {};
    },

    fetchUsersFromSupabase: async (schoolId) => {
        try {
            set((state: AppState) => ({ loading: { ...state.loading, users: true } }));
            
            let allData: any[] = [];
            let page = 0;
            const pageSize = 1000;
            let hasMore = true;

            while (hasMore) {
                const { data, error } = await supabase
                    .from('user_profiles')
                    .select('*')
                    .eq('school_id', schoolId)
                    .range(page * pageSize, (page + 1) * pageSize - 1);

                if (error) throw error;
                if (!data || data.length === 0) {
                    hasMore = false;
                } else {
                    allData = [...allData, ...data];
                    hasMore = data.length === pageSize;
                    page++;
                }
            }

            const users: AppUser[] = allData.map((p: any) => ({
                uid: p.id,
                email: p.email || '',
                name: p.name || p.email || '',
                role: p.role || 'student',
                schoolId: p.school_id || schoolId,
                classId: p.class_id || undefined,
                section: p.section || undefined,
                rollNumber: p.roll_number || undefined,
                linkedStudentId: p.linked_student_id || undefined,
                linkedChildrenIds: p.linked_children_ids || undefined,
                emailSent: Boolean(p.email_sent ?? p.emailSent),
                createdAt: p.created_at || new Date().toISOString(),
            }));
            set((state: AppState) => ({ users, loading: { ...state.loading, users: false } }));
        } catch (err) {
            console.error('fetchUsersFromSupabase failed:', err);
            set((state: AppState) => ({ loading: { ...state.loading, users: false } }));
        }
    },

    addLoginCredential: async (schoolId, credential) => {
        try {
            // user_profiles.id MUST be the Supabase auth UID (credential.uid)
            // NOT credential.id (which is the generated CRED_... identifier)
            const profileId = credential.uid || credential.id;
            if (!profileId) {
                console.error('addLoginCredential: no uid available on credential', credential);
                toast.error('Failed to save credential: missing user ID');
                return;
            }

            const payload = {
                id: profileId,
                school_id: schoolId,
                email: credential.username || (credential as any).email || '',
                name: credential.name || '',
                role: credential.role || 'student',
                roll_number: (credential as any).rollNumber || '',
                class_id: credential.classId || '',
                section: (credential as any).section || '',
                linked_student_id: credential.linkedStudentId || '',
                linked_children_ids: (credential as any).linkedChildrenIds || [],
                email_sent: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };

            console.log('[addLoginCredential] Upserting profile:', payload);

            const { error } = await supabase
                .from('user_profiles')
                .upsert(payload, { onConflict: 'id' });

            if (error) {
                console.error('[addLoginCredential] Supabase upsert failed:', JSON.stringify(error));
                toast.error(`Credential DB write failed: ${error.message || error.code || 'RLS or schema error'}. Run fix_user_profiles_rls.sql in Supabase.`);
                return;
            }

            console.log('[addLoginCredential] Profile saved successfully for', payload.email);
            // Refresh the users list in store
            await get().fetchUsersFromSupabase(schoolId);
        } catch (err: any) {
            console.error('[addLoginCredential] Unexpected error:', err);
            toast.error('Failed to save credential: ' + (err?.message || String(err)));
        }
    },

    updateLoginCredential: async (schoolId, credentialId, data) => {
        try {
            const { error } = await supabase.from('user_profiles')
                .update({ ...data, updated_at: new Date().toISOString() })
                .eq('id', credentialId)
                .eq('school_id', schoolId);
            if (error) {
                console.error('[updateLoginCredential] Supabase update failed:', JSON.stringify(error));
                throw error;
            }
            await get().fetchUsersFromSupabase(schoolId);
        } catch (error) {
            console.error('updateLoginCredential error:', error);
            toast.error('Failed to update credential');
        }
    },

    deleteLoginCredential: async (schoolId, credentialId) => {
        try {
            const { error } = await supabase.from('user_profiles')
                .delete()
                .eq('id', credentialId)
                .eq('school_id', schoolId);
            if (error) throw error;
            await get().fetchUsersFromSupabase(schoolId);
        } catch (error) {
            console.error('deleteLoginCredential error:', error);
            toast.error('Failed to delete credential');
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
          console.error('Publish update failed:', error);
          throw error;
        }

        // ─── Optimistic local state update (no full DB refetch = no jitter) ───
        // Flip isPublished for every mark matching this exam + studentIds list
        const studentIdSet = new Set(studentIds);
        set((state: AppState) => {
          const newRawMarks = (state.rawMarks || []).map(m => {
            const matchesExam    = (m as any).examId === examId;
            const matchesStudent = studentIdSet.has(m.studentId);
            if (matchesExam && matchesStudent) {
              return { ...m, isPublished };
            }
            return m;
          });
          return {
            rawMarks: newRawMarks,
            marks: assembleUnifiedMarks(newRawMarks, state.students, state.exams, state.subjects),
          };
        });

      } catch (error) {
        console.error('Publish error:', error);
        toast.error('Something went wrong while publishing/unpublishing marks');
      }
    },

    fetchStudents: async (schoolId: string) => {
      try {
        set((state: AppState) => ({ loading: { ...state.loading, students: true } }));
        
        let allData: any[] = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from('students')
            .select('*')
            .eq('school_id', schoolId)
            .range(page * pageSize, (page + 1) * pageSize - 1);

          if (error) throw error;
          if (!data || data.length === 0) {
            hasMore = false;
          } else {
            allData = [...allData, ...data];
            hasMore = data.length === pageSize;
            page++;
          }
        }

        const data = allData;

        // Build a lookup: class name string → class UUID from the loaded classes list
        // DB stores "Class 3", "Nursery" etc. in the `class` column.
        // The store's classes use UUIDs as classId. We need to resolve them.
        const { classes } = get();
        const classNameToId = new Map<string, string>();
        classes.forEach(c => {
          classNameToId.set(c.name.trim().toLowerCase(), c.classId);
          classNameToId.set(c.classId.trim().toLowerCase(), c.classId);
        });

        const resolveClassId = (s: any): string => {
          const rawClass = (s.class_id || s.class || '').trim();
          // Try exact match first, then case-insensitive
          return classNameToId.get(rawClass.toLowerCase()) || rawClass;
        };

        const formatted = (data || []).map((s: any) => ({
          id: s.roll_number,
          name: s.name || "",
          classId: resolveClassId(s),
          class: s.class || "",
          section: s.section || "",
          rollNumber: s.roll_number || "",
          paidAmount: Number(s.paid_amount || 0),
          totalFees: Number(s.total_fees || 0),
          photoURL: s.photo_url || "",
          profileImage: s.photo_url || "",
          transport_enabled: s.transport_enabled || s.uses_bus || false,
          className: s.class || "",
          schoolId: s.school_id || schoolId,
          parentName: s.parent_name || "",
          parentContact: s.parent_contact || "",
          motherName: s.mother_name || "",
          address: s.address || "",
          dateOfBirth: s.date_of_birth || "",
          bloodGroup: s.blood_group || "",
          bus: {
            opted: s.transport_enabled || s.uses_bus || false,
            enabled: s.transport_enabled || s.uses_bus || false,
            routeId: s.bus_route_id || null,
            stopName: s.bus_stop || null,
            route_id: s.bus_route_id || null,
            stop: s.bus_stop || null
          },
          enrollmentDate: s.enrollment_date || s.created_at || new Date().toISOString(),
          avatarColor: s.avatar_color || "#3B82F6",
        }));
        const formattedStudents = formatted as unknown as Student[];

        set((state) => {
          const updatedStudents = augmentStudents(formattedStudents, state.classes, state.feeSettings);
          return {
            rawStudents: formattedStudents,
            students: updatedStudents,
            loading: { ...state.loading, students: false }
          };
        });

      } catch (err) {
        console.error('fetchStudents failed:', err);
        set((state) => ({ loading: { ...state.loading, students: false } }));
      }
    },

    syncStudentsToSupabase: async (schoolId: string) => {
        // 1. Fetch all students from Firestore
        // TODO: Remove after full Firebase deprecation (migration complete)
        // Firebase removed — no longer fetching from Firestore
        const firebaseStudents: any[] = [];

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

    initListeners: (schoolId: string) => {
        // All data is loaded via init() — no real-time subscriptions needed.
        // This function is kept for interface compatibility.
        console.log(`[initListeners] No-op for school: ${schoolId}. Data loaded via init().`);
        return () => {};
    },

    listenToClasses: (schoolId: string) => {
        // Supabase-backed: kick off an async fetch and return a no-op unsubscribe
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

    init: async (schoolId: string) => {
      const start = Date.now();
      console.log(`🚀 [INIT] Starting sequential initialization for school: ${schoolId}`);
      
      try {
        // Step 1: Essential configuration (Classes, Subjects, Exams, Fee Configs) + Users
        await Promise.allSettled([
          get().fetchClassesFromSupabase(schoolId),
          get().fetchSubjectsFromSupabase(schoolId),
          get().fetchExamsFromSupabase(schoolId),
          get().fetchFeeConfigs(schoolId),
          get().fetchBusRoutes(schoolId),
          get().fetchUsersFromSupabase(schoolId),
        ]);

        // Step 2: Students (Depends on Classes for reliable augmentation)
        console.log("⏳ [INIT] Step 2: Fetching Students...");
        await get().fetchStudents(schoolId);
        console.log(`✅ [INIT] Students loaded: ${get().students.length}`);

        // Step 3: Results, Financials, Attendance & Feedbacks
        await Promise.allSettled([
          get().fetchPaymentsFromSupabase(schoolId),
          get().fetchMarksFromSupabase(schoolId),
          get().fetchAttendanceFromSupabase(schoolId),
          get().fetchFeedbacksFromSupabase(schoolId),
        ]);

        const duration = Date.now() - start;
        
        set({ initialized: true });

        // Force all critical loading flags to false to ensure dashboard displays
        set((state) => ({
          loading: {
            ...state.loading,
            students: false,
            marks: false,
            classes: false,
            fees: false,
            subjects: false,
            exams: false
          }
        }));
      } catch (err) {
        console.error("❌ [INIT] Critical initialization error:", err);
        // Ensure UI doesn't hang even on failure
        set((state) => ({
          loading: {
            ...state.loading,
            students: false,
            marks: false,
            classes: false,
            fees: false
          }
        }));
      }
    },
}));

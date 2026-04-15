import { Student, Mark, AttendanceRecord, Feedback, Fee, BusRoute, StudentFees, FeeConfig, ACADEMIC_MONTHS, Payment, SubjectConfig, ExamConfig } from './types';
import { useStore } from '../store/useStore';

type FeeSettingsMap = Record<string, { monthlyFee: number; transportFee: number }>;
type NormalizedAttendanceStatus = 'present' | 'absent' | 'leave';

export function calculateFeeStatus(paid: number, total: number): StudentFees {
    const p = Math.max(0, paid);
    const t = Math.max(0, total);
    const pending = t - p;
    const status: StudentFees['status'] = p === 0 ? 'unpaid' : p >= t ? 'paid' : 'partial';
    return { total: t, paid: p, dueAmount: Math.max(0, pending), pending: Math.max(0, pending), status };
}

export const sanitize = (obj: any): any => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(sanitize);
    const result: any = {};
    Object.keys(obj).forEach(key => {
        if (obj[key] !== undefined) {
            result[key] = sanitize(obj[key]);
        }
    });
    return result;
};

export const getTodayDateString = () => new Date().toISOString().split('T')[0];

export const getAttendanceDocId = (studentId: string, date: string) =>
    `ATT_${date}_${studentId}`;

export const normalizeAttendanceStatus = (status?: AttendanceRecord['status'] | string): NormalizedAttendanceStatus => {
    const value = String(status || '').trim().toLowerCase();
    if (value === 'present' || value === 'late') return 'present';
    if (value === 'leave' || value === 'excused') return 'leave';
    return 'absent';
};

export const getAttendanceStatusLabel = (status?: AttendanceRecord['status'] | string) => {
    const normalized = normalizeAttendanceStatus(status);
    if (normalized === 'present') return 'Present';
    if (normalized === 'leave') return 'Leave';
    return 'Absent';
};

export const isAttendanceEditable = (selectedDate: string) => {
    if (!selectedDate) return false;

    const selected = new Date(selectedDate);
    const now = new Date();

    const isToday = (
        selected.getFullYear() === now.getFullYear() &&
        selected.getMonth() === now.getMonth() &&
        selected.getDate() === now.getDate()
    );

    return isToday;
};

export const normalizeAttendanceRecord = (record: AttendanceRecord): AttendanceRecord => {
    const studentId = String(record.studentId || '').trim();
    const date = String(record.date || '').trim();
    const normalizedStatus = normalizeAttendanceStatus(record.status);
    const reason = normalizedStatus === 'present' ? null : (record.reason || '').trim() || null;

    return {
        ...record,
        id: record.id || getAttendanceDocId(studentId, date),
        studentId,
        date,
        status: normalizedStatus,
        reason,
        updatedAt: record.updatedAt || new Date().toISOString(),
    };
};

export const dedupeAttendanceRecords = (records: AttendanceRecord[]) => {
    const byStudentDate = new Map<string, AttendanceRecord>();

    records.forEach(record => {
        const normalized = normalizeAttendanceRecord(record);
        const key = `${normalized.studentId}__${normalized.date}`;
        const existing = byStudentDate.get(key);
        const existingTime = existing ? new Date(existing.updatedAt || existing.date).getTime() : -1;
        const nextTime = new Date(normalized.updatedAt || normalized.date).getTime();

        if (!existing || nextTime >= existingTime) {
            byStudentDate.set(key, normalized);
        }
    });

    return Array.from(byStudentDate.values());
};

export const getAcademicContext = () => {
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const now = new Date();
    const monthIdx = now.getMonth();
    const currentMonth = months[monthIdx];
    const currentMonthIndex = ACADEMIC_MONTHS.findIndex(entry => entry.name === currentMonth);

    const year = now.getFullYear();
    // If month is Jan(0), Feb(1), Mar(2), it's part of the previous year's session (e.g. 2024-25)
    const academicYear = monthIdx < 3 ? `${year - 1}-${String(year).slice(-2)}` : `${year}-${String(year + 1).slice(-2)}`;

    return { currentMonth, currentMonthIndex, academicYear };
};

const toAmount = (value: unknown) => Number(value || 0);

export const getAcademicMonthIndex = (month?: string) =>
    ACADEMIC_MONTHS.findIndex(entry => entry.name === month);

const LEGACY_ACADEMIC_MONTH_INDEX_MAP: Record<number, number> = {
    4: 0,
    5: 1,
    6: 2,
    7: 3,
    8: 4,
    9: 5,
    10: 6,
    11: 7,
    12: 8,
    1: 9,
    2: 10,
    3: 11,
};

export const normalizeAcademicMonthIndex = (monthIndex?: number, month?: string) => {
    const derivedFromMonth = getAcademicMonthIndex(month);
    if (derivedFromMonth >= 0) return derivedFromMonth;

    if (typeof monthIndex !== 'number' || Number.isNaN(monthIndex)) {
        return -1;
    }

    if (monthIndex >= 0 && monthIndex <= 11) {
        return monthIndex;
    }

    return LEGACY_ACADEMIC_MONTH_INDEX_MAP[monthIndex] ?? -1;
};

const sortTransactions = (left: Payment, right: Payment) => {
    const monthDelta = normalizeAcademicMonthIndex(left.monthIndex, left.month) - normalizeAcademicMonthIndex(right.monthIndex, right.month);
    if (monthDelta !== 0) return monthDelta;
    return new Date(left.paidAt || left.timestamp || left.updatedAt || left.date || 0).getTime() - new Date(right.paidAt || right.timestamp || right.updatedAt || right.date || 0).getTime();
};

const getMonthlyFeeBreakdown = (student: Student, feeSettingsOverride?: FeeSettingsMap) => {
    const { feeSettings: storeFeeSettings, feeConfigs } = useStore.getState();
    const feeSettings = feeSettingsOverride || storeFeeSettings;
    const classConfig = feeSettings?.[student.classId || ""];
    const config = feeConfigs.find(cfg => cfg.classId === student.classId);
    const baseFee = toAmount(classConfig?.monthlyFee || config?.totalFee || student.totalFees || 0);
    const busEnabled = student.bus?.enabled || student.bus?.opted;
    const busFee = busEnabled
        ? toAmount(
            student.bus?.fee ||
            student.bus?.fare ||
            classConfig?.transportFee ||
            config?.transportFee ||
            config?.optionalCharges?.transport ||
            0
        )
        : 0;

    return {
        baseFee,
        busFee,
        totalFee: baseFee + busFee,
    };
};

const normalizeAcademicYear = (year?: string) => {
  if (!year) return '';
  // convert "26-27" -> "2026-27"
  if (/^\d{2}-\d{2}$/.test(year)) {
    const start = Number(year.split('-')[0]);
    return `20${start}-${year.split('-')[1]}`;
  }
  return year;
};

export function getStudentPaymentTransactions(studentId: string, academicYear?: string, month?: string): Payment[] {
    const { payments } = useStore.getState();
    const { academicYear: currentAcademicYear } = getAcademicContext();
    const effectiveAcademicYear = academicYear || currentAcademicYear;

    return (payments || [])
        .filter(payment =>
            (payment.studentId === studentId || (payment as any).student_id === studentId) &&
            normalizeAcademicYear(payment.academicYear) === normalizeAcademicYear(effectiveAcademicYear) &&
            (!month || payment.month === month)
        )
        .sort(sortTransactions);
}

export interface StudentPendingStatus {
    baseFee: number;
    busFee: number;
    monthlyFee: number;
    expectedFee: number;
    paid: number;
    due: number;
    isPending: boolean;
    status: 'paid' | 'partial' | 'unpaid';
    currentMonthIndex: number;
    academicYear: string;
    transactions: Payment[];
}

export function getStudentPendingStatus(
    student: Student,
    transactions: Payment[],
    feeSettings: FeeSettingsMap,
    currentMonthIndex: number,
    academicYear: string,
): StudentPendingStatus {
    const normalizedCurrentMonthIndex = Math.max(0, currentMonthIndex);
    const { baseFee, busFee, totalFee } = getMonthlyFeeBreakdown(student, feeSettings);

    const relevantTransactions = (transactions || [])
        .filter(payment =>
            payment.studentId === student.id &&
            payment.academicYear === academicYear &&
            normalizeAcademicMonthIndex(payment.monthIndex, payment.month) >= 0 &&
            normalizeAcademicMonthIndex(payment.monthIndex, payment.month) <= normalizedCurrentMonthIndex
        )
        .sort(sortTransactions);

    const paid = relevantTransactions.reduce(
    (sum, payment) => sum + toAmount(payment.amount),
    0
  );
    const expectedFee = totalFee * (normalizedCurrentMonthIndex + 1);
    const due = Math.max(0, expectedFee - paid);
    const isPending = paid < expectedFee;

    let status: 'paid' | 'partial' | 'unpaid' = 'unpaid';
    if (!isPending) {
        status = 'paid';
    } else if (paid > 0) {
        status = 'partial';
    }

    return {
        baseFee,
        busFee,
        monthlyFee: totalFee,
        expectedFee,
        paid,
        due,
        isPending,
        status,
        currentMonthIndex: normalizedCurrentMonthIndex,
        academicYear,
        transactions: relevantTransactions,
    };
}

export function getNextPayableMonth(student: Student, academicYear?: string): string | null {
    const { academicYear: currentAcademicYear } = getAcademicContext();
    const effectiveAcademicYear = academicYear || currentAcademicYear;

    for (const entry of ACADEMIC_MONTHS) {
        const summary = getFeeSummary(student, entry.name, effectiveAcademicYear);
        if (summary.due > 0) {
            return entry.name;
        }
    }

    return null;
}

export function getPaymentMonthGuard(student: Student, month: string, academicYear?: string) {
    const { academicYear: currentAcademicYear } = getAcademicContext();
    const effectiveAcademicYear = academicYear || currentAcademicYear;
    const nextPayableMonth = getNextPayableMonth(student, effectiveAcademicYear);

    if (!month) {
        return {
            allowed: false,
            nextPayableMonth,
            reason: 'Select a month before recording payment.',
        };
    }

    if (!nextPayableMonth) {
        return {
            allowed: false,
            nextPayableMonth: null,
            reason: 'All academic months are fully paid.',
        };
    }

    if (nextPayableMonth !== month) {
        return {
            allowed: false,
            nextPayableMonth,
            reason: `Complete ${nextPayableMonth} before paying ${month}.`,
        };
    }

    return {
        allowed: true,
        nextPayableMonth,
        reason: '',
    };
}

export function normalizeClassString(cls?: string): string {
    if (!cls) return '';
    return String(cls).trim().toUpperCase().replace(/^CLASS\s+/i, '');
}

/**
 * Formats a class name to ensure it has a "Class " prefix, 
 * but avoids duplication if the name already includes it.
 */
export function formatClassName(name?: string): string {
    if (!name) return 'Class N/A';
    const trimmed = name.trim();
    if (/^class\s+/i.test(trimmed)) return trimmed;
    return `Class ${trimmed}`;
}

/** 
 * 🔐 LOCKED FEE LOGIC - DO NOT MODIFY WITHOUT PERMISSION
 * This core engine enforces financial integrity by deriving totals 
 * from Fee Settings + Student Profile exclusively.
 */
export function getFeeSummary(student: Student, month?: string, academicYearOverride?: string) {
    const { currentMonth, academicYear } = getAcademicContext();
    const effectiveMonth = month || currentMonth;
    const effectiveAcademicYear = academicYearOverride || academicYear;
    const { baseFee, busFee, totalFee } = getMonthlyFeeBreakdown(student);
    const transactions = getStudentPaymentTransactions(student.id, effectiveAcademicYear, effectiveMonth);
    console.log("DEBUG payments for student:", student.id, transactions);
    // Ensure transactions are strictly for the selected month only (avoid cross-month aggregation issues)
    const monthlyTransactions = transactions.filter(
        t => t.month === effectiveMonth && normalizeAcademicYear(t.academicYear) === normalizeAcademicYear(effectiveAcademicYear)
    );
    const paid = Math.min(
        monthlyTransactions.reduce(
            (sum, payment) => sum + toAmount(payment.amount),
            0
        ),
        totalFee
    );
    const due = Math.max(0, totalFee - paid);
    // Prevent overpayment logic issues
    const cappedPaid = Math.min(paid, totalFee);

    let status: 'paid' | 'partial' | 'unpaid' = 'unpaid';
    if (cappedPaid === 0) {
        status = 'unpaid';
    } else if (cappedPaid >= totalFee) {
        status = 'paid';
    } else {
        status = 'partial';
    }

    return {
        baseFee,
        busFee,
        totalFee,
        paid: cappedPaid,
        due,
        status,
        month: effectiveMonth,
        monthlyFee: totalFee,
        transactions: monthlyTransactions,
        academicYear: effectiveAcademicYear,
    };
}


export function getStudentMarks(studentId: string, marks: Mark[]) {
    return marks.filter(m => m.studentId === studentId);
}

export function getStudentAttendance(studentId: string, attendance: AttendanceRecord[], monthKey = getTodayDateString().slice(0, 7)) {
    return dedupeAttendanceRecords(attendance)
        .filter(a => a.studentId === studentId && (!monthKey || a.date.startsWith(monthKey)));
}

export function getAttendancePercentage(studentId: string, attendance: AttendanceRecord[]) {
    const records = getStudentAttendance(studentId, attendance);
    if (records.length === 0) return 0;
    const present = records.filter(r => normalizeAttendanceStatus(r.status) === 'present').length;
    return Math.round((present / records.length) * 100);
}

export function getStudentFeedback(studentId: string, feedbacks: Feedback[]) {
    return feedbacks
        .filter(f => f.studentId === studentId)
        .sort((a, b) => {
            const left = new Date(b.updatedAt || b.createdAt || b.date || 0).getTime();
            const right = new Date(a.updatedAt || a.createdAt || a.date || 0).getTime();
            return left - right;
        });
}

const getUniqueNonEmptyValues = (values: string[]) =>
    Array.from(
        new Set(
            values
                .map(value => String(value || '').trim())
                .filter(Boolean)
        )
    );

export function getAvailableSubjectsForMarks(
    marks: Mark[],
    subjectConfigs: SubjectConfig[] = [],
    classId?: string,
) {
    const markedSubjects = getUniqueNonEmptyValues((marks || []).map(mark => mark.subject));

    if (markedSubjects.length === 0) {
        return [];
    }

    const configuredSubjects = (subjectConfigs || [])
        .filter(subject => !classId || !subject.classIds || subject.classIds.length === 0 || subject.classIds.includes(classId))
        .map(subject => String(subject.name || '').trim())
        .filter(Boolean);

    const orderedConfiguredSubjects = configuredSubjects.filter(subject => markedSubjects.includes(subject));
    const remainingMarkedSubjects = markedSubjects
        .filter(subject => !orderedConfiguredSubjects.includes(subject))
        .sort((left, right) => left.localeCompare(right));

    return [...orderedConfiguredSubjects, ...remainingMarkedSubjects];
}

export function getAvailableExamTypesForMarks(
    marks: Mark[],
    exams: ExamConfig[] = [],
) {
    const markedExamTypes = getUniqueNonEmptyValues((marks || []).map(mark => String(mark.examType || '')));

    if (markedExamTypes.length === 0) {
        return [];
    }

    const orderedConfiguredExamTypes = [...(exams || [])]
        .sort((left, right) => left.order - right.order)
        .map(exam => String(exam.name || '').trim())
        .filter(name => markedExamTypes.includes(name));

    const remainingExamTypes = markedExamTypes
        .filter(name => !orderedConfiguredExamTypes.includes(name))
        .sort((left, right) => left.localeCompare(right));

    return [...orderedConfiguredExamTypes, ...remainingExamTypes];
}

export function getSubjectAverage(studentId: string, subject: string, marks: Mark[]) {
    const subjectMarks = marks.filter(m => m.studentId === studentId && m.subject === subject);
    if (subjectMarks.length === 0) return 0;
    return Math.round(subjectMarks.reduce((sum, m) => sum + (m.marksObtained / m.totalMarks) * 100, 0) / subjectMarks.length);
}

export function getSubjectExamScore(studentId: string, subject: string, examType: Mark['examType'], marks: Mark[]) {
    const m = marks.find(mk => mk.studentId === studentId && mk.subject === subject && mk.examType === examType);
    return m ? Math.round((m.marksObtained / m.totalMarks) * 100) : 0;
}

export function getOverallPercentage(studentId: string, marks: Mark[]) {
    const studentMarks = getStudentMarks(studentId, marks);
    if (studentMarks.length === 0) return 0;
    const total = studentMarks.reduce((sum, m) => sum + (m.marksObtained / m.totalMarks) * 100, 0);
    return Math.round(total / studentMarks.length);
}

export function getClassRanking(studentId: string, students: Student[], marks: Mark[]) {
    const student = students.find(s => s.id === studentId);
    if (!student) return { rank: 0, total: 0, scope: 'Class' };

    // PART 1: DEFINE SCOPE
    let scopeStudents = students.filter(s => s.classId === student.classId);
    let scope = 'Class';

    if (student.section) {
        scopeStudents = scopeStudents.filter(s => (s.section || "") === student.section);
        scope = 'Section';
    }

    // PART 2 & 3: CALCULATE & SORT
    const percentages = scopeStudents.map(s => ({
        id: s.id,
        pct: getOverallPercentage(s.id, marks)
    }));

    percentages.sort((a, b) => b.pct - a.pct);

    // PART 4: ASSIGN RANK
    const rank = percentages.findIndex(p => p.id === studentId) + 1;
    return { rank, total: scopeStudents.length, scope };
}

export function getSubjectAnalysis(studentId: string, marks: Mark[], subjects: string[]) {
    const scores = subjects.map(sub => ({
        subject: sub,
        average: getSubjectAverage(studentId, sub, marks),
        // For backwards compatibility, we still look for these types, 
        // but a more robust way would be to pass the dynamic exams here.
        endTerm: getSubjectExamScore(studentId, sub, 'Final' as any, marks),
        periodic: getSubjectExamScore(studentId, sub, 'Periodic Test' as any, marks),
        midterm: getSubjectExamScore(studentId, sub, 'Midterm' as any, marks),
    }));
    scores.sort((a, b) => b.average - a.average);
    const strong = scores.filter(s => s.average >= 75);
    const weak = scores.filter(s => s.average < 65);
    const improving = scores.filter(s => s.endTerm > s.periodic + 5);
    const declining = scores.filter(s => s.endTerm < s.periodic - 5);
    return { scores, strong, weak, improving, declining };
}

export function searchStudents(query: string, students: Student[], classFilter?: string): Student[] {
    let result = students;
    if (classFilter) result = result.filter(s => s.classId === classFilter);
    if (query) result = result.filter(s => 
        (s.name || "").toLowerCase().includes(query.toLowerCase()) || 
        (s.id || "").toLowerCase().includes(query.toLowerCase())
    );
    return result;
}

/** Get sorted unique class values from the student list */
export function getUniqueClasses(students: Student[]): string[] {
    return Array.from(new Set(students.map(s => s.classId))).sort();
}

/** Get sorted unique section values for a given class */
export function getUniqueSections(students: Student[], className: string): string[] {
    return Array.from(new Set(students.filter(s => s.classId === className).map(s => s.section))).sort();
}

/** Filter students by class and optionally section */
export function getStudentsByClassSection(students: Student[], cls: string, section?: string) {
    if (!students) return [];
    return students.filter(s => (s.classId || "") === cls && (!section || (s.section || "") === section));
}

export function getClassName(classId: string, classes: { classId: string; name: string }[]): string {
    const safeId = normalizeClassString(classId);
    const cls = classes.find(c => normalizeClassString(c.classId) === safeId);
    return formatClassName(cls ? cls.name : classId);
}

export function getStudentBusRoute(studentId: string, busRoutes: BusRoute[]): BusRoute | undefined {
    return busRoutes.find(r => r.assignedStudents.includes(studentId));
}

export function getClassAverage(className: string, subject: string, students: Student[], marks: Mark[]) {
    const classStudents = students.filter(s => s.classId === className);
    const avgs = classStudents.map(s => getSubjectAverage(s.id, subject, marks)).filter(a => a > 0);
    if (avgs.length === 0) return 0;
    return Math.round(avgs.reduce((s, a) => s + a, 0) / avgs.length);
}



export function generateAISummary(studentId: string, students: Student[], marks: Mark[], attendance: AttendanceRecord[], subjects: string[]): string[] {
    const summaries: string[] = [];
    if (subjects.length === 0) return ['No academic data available.'];

    const subjectScores = subjects.map(s => ({ subject: s, avg: getSubjectAverage(studentId, s, marks) }));
    subjectScores.sort((a, b) => b.avg - a.avg);
    const best = subjectScores[0];
    const worst = subjectScores.find(s => s.avg > 0) || subjectScores[subjectScores.length - 1];

    if (best && best.avg > 0) summaries.push(`Strong performance in ${best.subject} with an average of ${best.avg}%.`);
    if (worst && worst.avg > 0 && worst.avg < 70 && worst !== best) summaries.push(`Needs improvement in ${worst.subject} (${worst.avg}% average).`);

    const attPct = getAttendancePercentage(studentId, attendance);
    if (attPct < 80) summaries.push(`Attendance is below expectations at ${attPct}%. Regular attendance is important.`);
    else if (attPct >= 90) summaries.push(`Excellent attendance record at ${attPct}%.`);

    const studentMarks = getStudentMarks(studentId, marks);
    // Dynamic trend logic
    if (studentMarks.length >= 2) {
        const sorted = [...studentMarks].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const recent = sorted.slice(-Math.ceil(sorted.length / 2));
        const older = sorted.slice(0, Math.floor(sorted.length / 2));

        const recentAvg = recent.reduce((s, m) => s + (m.marksObtained / m.totalMarks), 0) / recent.length;
        const olderAvg = older.reduce((s, m) => s + (m.marksObtained / m.totalMarks), 0) / older.length;

        if (recentAvg > olderAvg + 0.05) summaries.push('Performance is showing an improving trend across assessments.');
        else if (recentAvg < olderAvg - 0.05) summaries.push('Performance has declined recently. Review recommended.');
    }

    if (summaries.length === 0) summaries.push('Performance is steady across all subjects.');
    return summaries;
}

export function getEndTermPercentage(studentId: string, marks: Mark[]) {
    const finals = marks.filter(m => m.studentId === studentId && m.examType === 'Final');
    if (finals.length === 0) return 0;
    return Math.round(finals.reduce((sum, m) => sum + (m.marksObtained / m.totalMarks) * 100, 0) / finals.length);
}

export interface SystemAlert {
    id: string;
    type: 'attendance_critical' | 'fees_pending' | 'performance_low';
    count: number;
    severity: 'warning' | 'destructive' | 'info';
    message: string;
    studentIds: string[];
}

/** Generate actionable system alerts based on student data */
export function getSystemAlerts(
    students: Student[],
    marks: Mark[],
    attendance: AttendanceRecord[],
    transactions: Payment[],
    feeSettings: FeeSettingsMap,
    currentMonthIndex: number,
    academicYear: string,
): SystemAlert[] {
    const alerts: SystemAlert[] = [];

    // 1. Low Attendance (< 75%)
    const lowAtt = students.filter(s => {
        const pct = getAttendancePercentage(s.id, attendance);
        const records = getStudentAttendance(s.id, attendance);
        return records.length > 0 && pct < 75;
    });
    if (lowAtt.length > 0) {
        alerts.push({
            id: 'alert-att',
            type: 'attendance_critical',
            count: lowAtt.length,
            severity: 'warning',
            message: `${lowAtt.length} students with critical attendance (<75%)`,
            studentIds: lowAtt.map(s => s.id)
        });
    }

    // 2. Fee Defaulters (due > 0)
    const defaulters = students.filter(s => getStudentPendingStatus(s, transactions, feeSettings, currentMonthIndex, academicYear).isPending);
    if (defaulters.length > 0) {
        alerts.push({
            id: 'alert-fees',
            type: 'fees_pending',
            count: defaulters.length,
            severity: 'destructive',
            message: `${defaulters.length} students with pending fee payments`,
            studentIds: defaulters.map(s => s.id)
        });
    }

    // 3. Low Performers (< 40% overall)
    const lowPerf = students.filter(s => {
        const pct = getOverallPercentage(s.id, marks);
        const studentMarks = marks.filter(m => m.studentId === s.id);
        return studentMarks.length > 0 && pct < 40;
    });
    if (lowPerf.length > 0) {
        alerts.push({
            id: 'alert-perf',
            type: 'performance_low',
            count: lowPerf.length,
            severity: 'warning',
            message: `${lowPerf.length} students performing below 40%`,
            studentIds: lowPerf.map(s => s.id)
        });
    }

    return alerts;
}

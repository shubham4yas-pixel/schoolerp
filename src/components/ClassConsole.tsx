import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useStore } from '@/store/useStore';
import { useAuth } from '@/contexts/AuthContext';
import { Student, Mark, AttendanceRecord, ACADEMIC_MONTHS, Payment } from '@/lib/types';
import {
    getUniqueClasses,
    getUniqueSections,
    getStudentsByClassSection,
    getOverallPercentage,
    getAttendancePercentage,
    getFeeSummary,
    getClassName,
    getAcademicContext,
    getPaymentMonthGuard,
    formatClassName,
} from '@/lib/data-utils';
import AttendanceEntryPanel from '@/components/AttendanceEntryPanel';
import StudentAvatar from '@/components/StudentAvatar';
import { toast } from 'sonner';
import { Users, Save, Loader2, ClipboardList, Calendar, IndianRupee, RotateCcw, Check, CheckSquare, XSquare, Send, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';

type ConsoleMode = 'marks' | 'attendance' | 'fees';

// Moved to dynamic store config

/** Inline editable cell */
const EditCell = ({ value, onChange, type = 'text', placeholder = '', className = '' }: { value: string; onChange: (v: string) => void; type?: string; placeholder?: string; className?: string }) => (
    <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-2 py-1.5 text-sm bg-muted/60 border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-ring min-w-[60px] ${className}`}
    />
);

/** Inline status selector */
const StatusCell = ({ value, onChange, options, colors }: {
    value: string;
    onChange: (v: string) => void;
    options: string[];
    colors: Record<string, string>;
}) => (
    <div className="flex gap-1 flex-wrap">
        {(options || []).map(opt => (
            <button
                key={opt}
                type="button"
                onClick={() => onChange(opt)}
                className={`px-2 py-1 rounded text-xs font-medium transition-all ${value === opt ? colors[opt] : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}
            >
                {opt}
            </button>
        ))}
    </div>
);

interface MarksRow { obtained: string; total: string; examType: string; date: string; }
interface AttRow { status: 'Present' | 'Absent' | 'Leave'; reason: string; }
interface FeeRow { total: string; paid: string; }

const ClassConsole = ({ onStudentClick }: { onStudentClick?: (student: Student) => void }) => {
    const { schoolId } = useAuth();
    const {
        students,
        marks,
        attendance,
        loading,
        globalFilterClass: selectedClass,
        globalFilterSection: selectedSection,
        setGlobalFilterClass: setSelectedClass,
        setGlobalFilterSection: setSelectedSection,
        feeSettings,
        feeConfigs: storeFeeConfigs,
        subjects: allSubjects,
        exams,
        classes: storeClasses,
        updateStudentResult,
        updateExamPublishStatus,
        recordPayment,
        saveAttendance,
    } = useStore();

    useEffect(() => {
        console.log("STORE STUDENTS:", students);
        console.log("SELECTED CLASS:", selectedClass);
        console.log("CLASSES:", storeClasses);
    }, [students, selectedClass, storeClasses]);

    useEffect(() => {
        console.log("FINAL STUDENTS:", students);
    }, [students]);

    useEffect(() => {
        console.log("Students:", students);
    }, [students]);

    const uniqueClasses = storeClasses;

    const sortedExams = useMemo(() => [...exams].sort((a, b) => a.order - b.order), [exams]);
    const examOptions = sortedExams.map(e => ({ id: e.id, name: e.name }));

    const applicableSubjects = useMemo(() => {
        if (!selectedClass || allSubjects.length === 0) return [];
        return allSubjects.filter(sub => !sub.classIds || sub.classIds.length === 0 || sub.classIds.includes(selectedClass));
    }, [selectedClass, allSubjects]);

    const [mode, setMode] = useState<ConsoleMode>('attendance');
    const [saving, setSaving] = useState(false);

    // ─── Shared Marks Context (Synced with Data Entry) ──────────────────────────
    const MARKS_CONTEXT_KEY = 'marks_entry_context';
    const getSafeMarksContext = () => {
        try {
            const saved = localStorage.getItem(MARKS_CONTEXT_KEY);
            return saved ? JSON.parse(saved) : null;
        } catch { return null; }
    };

    const [marksContext, setMarksContext] = useState(getSafeMarksContext() || {
        subjectId: '',
        examId: exams?.[0]?.id || '',
        date: new Date().toISOString().split('T')[0],
        totalMarks: '100'
    });

    useEffect(() => {
        localStorage.setItem(MARKS_CONTEXT_KEY, JSON.stringify(marksContext));
    }, [marksContext]);

    const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);

    // Initialize/Sync subject and exam
    useEffect(() => {
        if (storeClasses.length > 0 && !selectedClass) {
            setSelectedClass(storeClasses[0].classId);
        }
    }, [storeClasses, selectedClass]);

    useEffect(() => {
        if (applicableSubjects.length > 0 && !applicableSubjects.find(s => s.id === marksContext.subjectId)) {
            setMarksContext(prev => ({ ...prev, subjectId: applicableSubjects[0].id }));
        }
    }, [applicableSubjects]);

    useEffect(() => {
        if (examOptions.length > 0 && !examOptions.find(e => e.id === marksContext.examId)) {
            setMarksContext(prev => ({ ...prev, examId: examOptions[0].id }));
        }
    }, [examOptions]);

    const sections = useMemo(() => {
        if (!selectedClass) return [];
        const config = storeClasses.find(c => c.classId === selectedClass);
        if (config && config.sections) return config.sections;
        return getUniqueSections(students as any, selectedClass);
    }, [students, selectedClass, storeClasses]);

    const { currentMonth: CURRENT_MONTH, academicYear: ACADEMIC_YEAR } = useMemo(() => getAcademicContext(), []);

    const filteredStudents = useMemo(() => {
        if (!selectedClass) return students;
        return getStudentsByClassSection(students, selectedClass, selectedSection || undefined);
    }, [students, selectedClass, selectedSection]);

    useEffect(() => {
        console.log("STUDENTS LIVE:", students);
    }, [students]);

    // ─── Row State ────────────────────────────────────────────────────────────────
    const [localMarks, setLocalMarks] = useState<Record<string, string>>({});
    const [attRows, setAttRows] = useState<Record<string, AttRow>>({});
    const [feeRows, setFeeRows] = useState<Record<string, FeeRow>>({});
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [savingStatus, setSavingStatus] = useState<Record<string, 'idle' | 'saving' | 'saved' | 'error'>>({});
    const autoSaveTimers = useRef<Record<string, NodeJS.Timeout>>({});

    const triggerAutoSaveMark = (sId: string, obtained: string) => {
        if (!marksContext.examId || !marksContext.subjectId) return;
        const oNum = parseFloat(obtained);
        const tNum = parseFloat(marksContext.totalMarks);

        if (obtained === '') {
            setSavingStatus(prev => ({ ...prev, [sId]: 'idle' }));
            return;
        }

        if (isNaN(oNum) || oNum < 0 || oNum > tNum) {
            setSavingStatus(prev => ({ ...prev, [sId]: 'error' }));
            return;
        }

        if (autoSaveTimers.current[sId]) clearTimeout(autoSaveTimers.current[sId]);
        setSavingStatus(prev => ({ ...prev, [sId]: 'saving' }));

        autoSaveTimers.current[sId] = setTimeout(async () => {
            try {
                await updateStudentResult(schoolId!, sId, marksContext.examId, marksContext.subjectId, oNum, 'class_console');
                setSavingStatus(prev => ({ ...prev, [sId]: 'saved' }));
                setTimeout(() => setSavingStatus(prev => ({ ...prev, [sId]: 'idle' })), 2000);
            } catch (err) {
                setSavingStatus(prev => ({ ...prev, [sId]: 'error' }));
            }
        }, 1000);
    };

    const getMarkRow = (id: string, s?: Student): MarksRow => {
        const student = s || students.find(x => x.id === id);
        const savedMarks = student?.results?.[marksContext.examId]?.subjects?.[marksContext.subjectId]?.marks?.toString() || '';

        return {
            obtained: localMarks[id] ?? savedMarks,
            total: marksContext.totalMarks,
            examType: (examOptions.find(e => e.id === marksContext.examId)?.name || marksContext.examId),
            date: marksContext.date
        };
    };

    const getAttRow = (id: string): AttRow =>
        attRows[id] ?? { status: 'Present', reason: '' };

    const getFeeRow = (id: string): FeeRow => {
        const student = students.find(s => s.id === id);
        if (!student) return { total: '0', paid: '0' };

        const feeSummary = getFeeSummary(student, CURRENT_MONTH, ACADEMIC_YEAR);
        return feeRows[id] ?? { total: feeSummary.totalFee.toString(), paid: feeSummary.paid.toString() };
    };

    const updateMark = (id: string, val: string) => {
        const student = students.find(s => s.id === id);
        const isPublished = student?.results?.[marksContext.examId]?.isPublished;
        if (mode === 'marks' && isPublished) {
            toast.error('Results are already published. Unpublish first to edit.');
            return;
        }
        setLocalMarks(prev => ({ ...prev, [id]: val }));
        triggerAutoSaveMark(id, val);
    };

    const updateAtt = (id: string, field: keyof AttRow, val: any) =>
        setAttRows(prev => {
            const current = prev[id] || { status: 'Present', reason: '' };
            return { ...prev, [id]: { ...current, [field]: val } };
        });

    const updateFee = (id: string, field: 'paid', val: string) =>
        setFeeRows(prev => {
            const student = students.find(s => s.id === id);
            if (!student) return prev;
            const feeStatus = getFeeSummary(student, CURRENT_MONTH, ACADEMIC_YEAR);
            const current = prev[id] || { total: feeStatus.totalFee.toString(), paid: '0' };
            return { ...prev, [id]: { ...current, [field]: val } };
        });

    const currentExam = exams.find(e => e.id === marksContext.examId);
    const [publishing, setPublishing] = useState(false);
    const { logUploadRecord, saveExamConfig } = useStore();

    // ─── Simple hash for duplicate detection ──────────────────────────────
    const getFileHash = (str: string) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(36);
    };

    // ─── Excel Template Download ──────────────────────────────────────────────
    const handleDownloadTemplate = () => {
        if (!selectedClass || !marksContext.subjectId || !marksContext.examId) {
            toast.error("Please select a class, subject and exam first.");
            return;
        }

        const subObj = applicableSubjects.find(s => s.id === marksContext.subjectId);
        const subName = subObj?.name || marksContext.subjectId;

        const headers = ["Roll No", "Student ID", "Name", "Marks", "Out Of"];
        const data = filteredStudents.map(s => ({
            "Roll No": s.rollNumber || s.id,
            "Student ID": s.id,
            "Name": s.name,
            "Marks": "",
            "Out Of": marksContext.totalMarks
        }));

        const ws = XLSX.utils.json_to_sheet(data, { header: headers });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Marks Template");
        XLSX.writeFile(wb, `${getClassName(selectedClass, storeClasses)}_${subName}_${marksContext.examId}_Template.xlsx`);
        toast.success("Template downloaded!");
    };

    // ─── Excel Import Parsing ──────────────────────────────────────────────────
    const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result as string;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const data: any[] = XLSX.utils.sheet_to_json(ws);

                if (!data.length) {
                    toast.error("File is empty or invalid format");
                    return;
                }

                setSaving(true);
                let processedCount = 0;

                for (const row of data) {
                    const sId = row["Student ID"];
                    const rNo = row["Roll No"];
                    const marks = row["Marks"];

                    // Match by ID primarily, fallback to roll number
                    const student = students.find(s => s.id === sId) || (rNo ? students.find(s => s.rollNumber === rNo) : null);

                    if (student && marks !== undefined && marks !== "" && marksContext.subjectId && marksContext.examId) {
                        const val = parseFloat(marks);
                        if (!isNaN(val)) {
                            await updateStudentResult(schoolId!, student.id, marksContext.examId, marksContext.subjectId, val, 'template_upload');
                            processedCount++;
                        }
                    }
                }

                toast.success(`Import complete! Processed ${processedCount} students.`);
                e.target.value = '';
            } catch (err) {
                toast.error("Error reading file");
            } finally {
                setSaving(false);
            }
        };
        reader.readAsBinaryString(file);
    };

    const handlePublishAll = async (publish: boolean) => {
        if (!marksContext.examId || !filteredStudents.length) return;
        const action = publish ? 'publish' : 'unpublish';
        if (!window.confirm(`Are you sure you want to ${action} results for all ${filteredStudents.length} students?`)) return;

        setPublishing(true);
        try {
            await updateExamPublishStatus(schoolId!, filteredStudents.map(s => s.id), marksContext.examId, publish);
            toast.success(`Marks ${publish ? 'published' : 'unpublished'}!`);
        } catch (err) {
            toast.error('Failed to update status');
        }
        setPublishing(false);
    };

    const handlePublishSelected = async (publish: boolean) => {
        if (!marksContext.examId || selectedIds.size === 0) return;
        setPublishing(true);
        try {
            await updateExamPublishStatus(schoolId!, Array.from(selectedIds), marksContext.examId, publish);
            toast.success(`Selected marks ${publish ? 'published' : 'unpublished'}!`);
            setSelectedIds(new Set());
        } catch (err) {
            toast.error('Failed to update status');
        }
        setPublishing(false);
    };

    // ─── Bulk mark all attendance ─────────────────────────────────────────────────
    const markAll = (status: 'Present' | 'Absent' | 'Leave') => {
        const next: Record<string, AttRow> = {};
        filteredStudents.forEach(s => { next[s.id] = { status, reason: '' }; });
        setAttRows(next);
    };

    // ─── Save ─────────────────────────────────────────────────────────────────────
    const handleSave = async () => {
        if (!filteredStudents.length) { toast.error('No students to save'); return; }
        setSaving(true);
        try {
            if (mode === 'attendance') {
                await saveAttendance(schoolId!, filteredStudents.map(s => {
                    const row = getAttRow(s.id);
                    return {
                        id: '',
                        studentId: s.id,
                        date: attendanceDate,
                        status: row.status,
                        reason: row.status === 'Present' ? null : row.reason || null,
                        updatedAt: new Date().toISOString(),
                    } as AttendanceRecord;
                }));
                toast.success(`Attendance saved for ${filteredStudents.length} students`);
                setAttRows({});
            }

            else if (mode === 'fees') {
                const selectedMonthData = ACADEMIC_MONTHS.find(m => m.name === CURRENT_MONTH);
                if (!selectedMonthData) {
                    toast.error('Invalid fee month');
                    setSaving(false);
                    return;
                }

                let savedCount = 0;
                let skippedLocked = 0;
                let skippedInvalid = 0;

                for (const s of filteredStudents) {
                    const row = getFeeRow(s.id);
                    const feeStatus = getFeeSummary(s, CURRENT_MONTH, ACADEMIC_YEAR);
                    const currentPaid = Number(feeStatus.paid || 0);
                    const requestedPaid = Number(row.paid || 0);
                    const remaining = Number(feeStatus.due || 0);

                    if (requestedPaid <= currentPaid) {
                        if (requestedPaid < currentPaid) skippedInvalid++;
                        continue;
                    }

                    if (requestedPaid > Number(feeStatus.totalFee || 0)) {
                        skippedInvalid++;
                        continue;
                    }

                    const paymentGuard = getPaymentMonthGuard(s, CURRENT_MONTH, ACADEMIC_YEAR);
                    if (!paymentGuard.allowed) {
                        skippedLocked++;
                        continue;
                    }

                    const amount = requestedPaid - currentPaid;
                    const timestamp = new Date().toISOString();
                    const paymentRecord = {
                        id: `PAY_${Date.now()}_${s.id}`,
                        studentId: s.id,
                        studentName: s.name,
                        classId: s.classId,
                        section: s.section,
                        month: CURRENT_MONTH,
                        monthIndex: selectedMonthData.index,
                        monthKey: `${ACADEMIC_YEAR}_${selectedMonthData.index}`,
                        year: new Date().getFullYear().toString(),
                        academicYear: ACADEMIC_YEAR,
                        amount,
                        amount_total: Number(feeStatus.totalFee || remaining),
                        status: amount >= remaining ? 'paid' : 'partial',
                        date: timestamp.split('T')[0],
                        timestamp,
                        paidAt: timestamp,
                    } as any;

                    await recordPayment(schoolId!, paymentRecord);
                    savedCount++;
                }

                toast.success(`Fees updated for ${savedCount} students${skippedLocked ? `, ${skippedLocked} locked by previous due` : ''}${skippedInvalid ? `, ${skippedInvalid} invalid amounts` : ''}`);
                setFeeRows({});
            }
        } catch (err) {
            toast.error('Save failed — check console');
            console.error(err);
        }
        setSaving(false);
    };

    const reset = () => { setLocalMarks({}); setAttRows({}); setFeeRows({}); };

    // ─── Derived stats ────────────────────────────────────────────────────────────
    const presentCount = filteredStudents.filter(s => (attRows[s.id]?.status ?? 'Present') === 'Present').length;

    const modeColors = {
        marks: 'bg-indigo-600 text-white',
        attendance: 'bg-emerald-600 text-white',
        fees: 'bg-orange-500 text-white',
    };

    const attColors: Record<string, string> = {
        Present: 'bg-success text-white',
        Absent: 'bg-destructive text-white',
        Leave: 'bg-warning text-white',
    };

    const [isDataTimeout, setIsDataTimeout] = useState(false);

    // Safety timeout for loading state
    useEffect(() => {
        if (loading.students) {
            const timer = setTimeout(() => setIsDataTimeout(true), 5000);
            return () => clearTimeout(timer);
        }
    }, [loading.students]);

    if (loading.students && !isDataTimeout) {
        return (
            <div className="flex items-center justify-center py-20 gap-3">
                <Loader2 className="w-7 h-7 animate-spin text-primary" />
                <span className="text-muted-foreground font-medium">Loading Class Console...</span>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* ─── Header ─────────────────────────────────────────────────────────── */}
            <div className="bg-card rounded-xl border border-border p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h2 className="font-display font-bold text-foreground text-xl flex items-center gap-2">
                            <Users className="w-5 h-5 text-primary" /> {formatClassName(getClassName(selectedClass, storeClasses) || "Loading")} Console
                        </h2>
                        <p className="text-sm text-muted-foreground mt-0.5">Select class and edit all student data in one place</p>
                    </div>

                    {/* Mode switcher */}
                    <div className="flex gap-1.5 bg-muted/40 p-1 rounded-xl">
                        {([
                            { id: 'attendance', label: 'Attendance', icon: <Calendar className="w-3.5 h-3.5" /> },
                            { id: 'marks', label: 'Marks', icon: <ClipboardList className="w-3.5 h-3.5" /> },
                            { id: 'fees', label: 'Fees', icon: <IndianRupee className="w-3.5 h-3.5" /> },
                        ] as const).map(m => (
                            <button
                                key={m.id}
                                onClick={() => setMode(m.id)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${mode === m.id ? modeColors[m.id] : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                {m.icon} {m.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ─── Filters ──────────────────────────────────────────────────────── */}
                <div className="flex flex-wrap gap-3 mt-5 items-end">
                    {mode !== 'attendance' && (
                        <>
                            {/* 1. Class and Section filters - Moved to the front */}
                            <div className="min-w-[140px]">
                                <label className="block text-xs font-medium text-muted-foreground mb-1">Class</label>
                                <select
                                    value={selectedClass}
                                    onChange={e => {
                                        setSelectedClass(e.target.value);
                                        setSelectedSection(''); // reset section on class change
                                    }}
                                    className="w-full pl-3 pr-4 py-2 text-sm bg-muted/50 border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring font-medium"
                                >
                                    <option value="">Select Class...</option>
                                    {uniqueClasses.map(c => (
                                        <option key={c.classId} value={c.classId}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            {selectedClass && (
                                <div className="min-w-[100px]">
                                    <label className="block text-xs font-medium text-muted-foreground mb-1">Section</label>
                                    <select
                                        value={selectedSection}
                                        onChange={e => setSelectedSection(e.target.value)}
                                        className="w-full pl-3 pr-4 py-2 text-sm bg-muted/50 border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring font-medium"
                                    >
                                        <option value="">All Sec</option>
                                        {sections.map(s => (
                                            <option key={s} value={s}>Sec {s}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </>
                    )}
                    {/* 2. Attendance Mode specific Date filter */}
                    {mode === 'attendance' && (
                        <>
                            <div className="min-w-[120px]">
                                <label className="block text-xs font-medium text-muted-foreground mb-1">Date</label>
                                <input
                                    type="date"
                                    value={attendanceDate}
                                    onChange={e => setAttendanceDate(e.target.value)}
                                    className="w-full px-3 py-2 text-sm bg-muted/50 border border-border rounded-lg text-foreground"
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>

            {mode === 'attendance' ? (
                <AttendanceEntryPanel students={students} onStudentClick={onStudentClick} title="Mark Attendance" />
            ) : (
                /* ─── Guard Section ─────────────────────────────────────────────────── */
                !selectedClass ? (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border border-dashed border-border rounded-xl bg-card">
                        <Users className="w-10 h-10 mb-3 opacity-30" />
                        <p className="font-medium text-lg">Select a class to load students</p>
                        <p className="text-sm mt-1 opacity-70">Use the Class dropdown above to get started</p>
                    </div>
                ) : mode === 'marks' && (!marksContext.subjectId || !marksContext.examId) ? (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border border-dashed border-border rounded-xl bg-card">
                        <ClipboardList className="w-10 h-10 mb-3 opacity-30" />
                        <p className="font-medium text-lg">Please select class, subject, and exam</p>
                        <p className="text-sm mt-1 opacity-70 font-medium">Academic configuration is required before entering marks</p>
                    </div>
                ) : filteredStudents.length === 0 ? (
                    <div className="flex flex-col items-center py-12 text-muted-foreground border border-dashed border-border rounded-xl bg-card">
                        <Users className="w-8 h-8 mb-2 opacity-30" />
                        <p className="font-medium">No students in {formatClassName(getClassName(selectedClass, storeClasses) || selectedClass)}{selectedSection ? `-${selectedSection}` : ''}</p>
                    </div>
                ) : (
                    <>
                        {/* ─── Summary strip ─────────────────────────────────────────────── */}
                        <div className="flex flex-wrap gap-3 items-center">
                            <span className="text-sm font-medium text-muted-foreground">
                                {filteredStudents.length} students · {formatClassName(getClassName(selectedClass, storeClasses))} {selectedSection ? `-${selectedSection}` : ''}
                            </span>
                            <div className="ml-auto flex gap-2">
                                {mode === 'marks' && (
                                    <>
                                        <button
                                            onClick={() => handlePublishAll(true)}
                                            disabled={publishing}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                                        >
                                            <Send className="w-3.5 h-3.5" /> Publish All
                                        </button>
                                        <button
                                            onClick={() => handlePublishSelected(true)}
                                            disabled={publishing || selectedIds.size === 0}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                                        >
                                            <Send className="w-3.5 h-3.5" /> Publish Selected
                                        </button>
                                        <button
                                            onClick={() => handlePublishAll(false)}
                                            disabled={publishing}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                                        >
                                            <RotateCcw className="w-3.5 h-3.5" /> Unpublish All
                                        </button>
                                        <button
                                            onClick={() => handlePublishSelected(false)}
                                            disabled={publishing || selectedIds.size === 0}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/80 hover:bg-orange-500 text-white rounded-lg text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                                        >
                                            <RotateCcw className="w-3.5 h-3.5" /> Unpublish Selected
                                        </button>
                                    </>
                                )}

                                {/* Excel Controls */}
                                {mode === 'marks' && selectedClass && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleDownloadTemplate}
                                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-all"
                                        >
                                            <Upload className="w-3.5 h-3.5 rotate-180" /> Template
                                        </button>
                                        <label className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-all cursor-pointer">
                                            <Upload className="w-3.5 h-3.5" /> Upload Excel
                                            <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleExcelUpload} />
                                        </label>
                                    </div>
                                )}
                                <button onClick={reset} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors">
                                    <RotateCcw className="w-3 h-3" /> Reset
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving || (mode === 'marks' && currentExam?.isPublished)}
                                    className="flex items-center gap-2 px-4 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60"
                                >
                                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                    {saving ? 'Saving...' : `Save All (${filteredStudents.length})`}
                                </button>
                            </div>
                        </div>

                        {/* ─── Main Editable Table ───────────────────────────────────────── */}
                        <div className="bg-card rounded-xl border border-border overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-border bg-muted/30">
                                            <th className="px-4 py-3 text-left w-8">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.size === filteredStudents.length && filteredStudents.length > 0}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setSelectedIds(new Set(filteredStudents.map(s => s.id)));
                                                        else setSelectedIds(new Set());
                                                    }}
                                                    className="w-4 h-4 rounded accent-primary"
                                                />
                                            </th>
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Student</th>
                                            <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Section</th>
                                            {mode === 'marks' && (
                                                <>
                                                    <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Marks</th>
                                                    <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Out of</th>
                                                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Overall%</th>
                                                </>
                                            )}
                                            {mode === 'fees' && (
                                                <>
                                                    <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total Fee (₹)</th>
                                                    <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Paid (₹)</th>
                                                    <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                                                </>
                                            )}
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {(filteredStudents || []).map((s, i) => {
                                            const markRow = getMarkRow(s.id, s as any);
                                            const feeStatus = mode === 'fees' ? getFeeSummary(s as any, CURRENT_MONTH, ACADEMIC_YEAR) : null;
                                            const rowPaid = mode === 'fees' ? getFeeRow(s.id).paid : "";

                                            const isPublished = (s as any).results?.[marksContext.examId]?.isPublished;

                                            return (
                                                <tr key={s.id} className={`border-b border-border/50 transition-colors hover:bg-muted/20 ${selectedIds.has(s.id) ? 'bg-primary/5' : ''}`}>
                                                    {/* Selection */}
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedIds.has(s.id)}
                                                            onChange={() => {
                                                                const next = new Set(selectedIds);
                                                                if (next.has(s.id)) next.delete(s.id);
                                                                else next.add(s.id);
                                                                setSelectedIds(next);
                                                            }}
                                                            className="w-4 h-4 rounded accent-primary"
                                                        />
                                                    </td>

                                                    {/* Student */}
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2.5">
                                                            <StudentAvatar
                                                                student={s}
                                                                className="w-7 h-7 rounded-lg flex-shrink-0"
                                                                initialsClassName="text-[10px] font-bold text-white"
                                                            />
                                                            <div className="min-w-0">
                                                                <div
                                                                    className={`font-medium text-foreground truncate max-w-[170px] flex items-center gap-1.5 ${onStudentClick ? 'cursor-pointer hover:text-primary hover:underline transition-colors' : ''}`}
                                                                    onClick={onStudentClick ? (e) => { e.stopPropagation(); onStudentClick(s as any); } : undefined}
                                                                >
                                                                    <span className="font-bold text-xs opacity-60 flex-shrink-0">[{s.rollNumber || s.id}]</span>
                                                                    {s.name}
                                                                </div>
                                                                <div className="text-[10px] text-muted-foreground font-mono opacity-50 uppercase tracking-tighter">ID: {s.id}</div>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Section */}
                                                    <td className="px-3 py-3 text-muted-foreground hidden sm:table-cell">{s.section}</td>

                                                    {/* ─── Marks Mode ──────────────────────────────────── */}
                                                    {mode === 'marks' && (
                                                        <>
                                                            <td className="px-3 py-2">
                                                                {isPublished ? (
                                                                    <div className="flex items-center gap-1.5 px-2 py-1.5 bg-success/10 text-success rounded-md border border-success/20 text-xs font-bold">
                                                                        <Check className="w-3 h-3" /> {markRow.obtained || '0'}
                                                                    </div>
                                                                ) : (
                                                                    <div className="relative">
                                                                        <EditCell
                                                                            value={markRow.obtained}
                                                                            onChange={v => updateMark(s.id, v)}
                                                                            type="number"
                                                                            placeholder="e.g. 78"
                                                                            className={savingStatus[s.id] === 'saving' ? 'pr-8' : ''}
                                                                        />
                                                                        {savingStatus[s.id] === 'saving' && (
                                                                            <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                                                                <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                                                                            </div>
                                                                        )}
                                                                        {savingStatus[s.id] === 'saved' && (
                                                                            <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                                                                <Check className="w-3 h-3 text-success animate-in fade-in zoom-in duration-300" />
                                                                            </div>
                                                                        )}
                                                                        {savingStatus[s.id] === 'error' && (
                                                                            <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                                                                <XSquare className="w-3 h-3 text-destructive" />
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                <div className="flex items-center gap-1 text-sm font-medium text-muted-foreground/60">
                                                                    <span className="text-[10px] uppercase font-bold tracking-tighter">/</span>
                                                                    {markRow.total}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 text-right hidden md:table-cell">
                                                                <div className="flex flex-col items-end gap-1">
                                                                    <span className={`text-sm font-semibold ${getOverallPercentage(s.id, marks) >= 75 ? 'text-success' : 'text-warning'}`}>
                                                                        {getOverallPercentage(s.id, marks)}%
                                                                    </span>
                                                                    {isPublished ? (
                                                                        <span className="text-[10px] font-bold text-success uppercase">Published</span>
                                                                    ) : (
                                                                        <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-50">Draft</span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </>
                                                    )}

                                                    {/* ─── Fees Mode ───────────────────────────────────── */}
                                                    {mode === 'fees' && (
                                                        <>
                                                            <td className="px-3 py-2">
                                                                <div className="px-2 py-1.5 text-sm font-bold text-foreground bg-muted/40 border border-border/50 rounded-md flex items-center gap-1">
                                                                    <span className="text-[10px] text-muted-foreground mr-1">₹</span>
                                                                    {feeStatus?.totalFee}
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                <div className="flex flex-col gap-2">
                                                                    <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                                                                        <EditCell
                                                                            value={rowPaid}
                                                                            onChange={v => updateFee(s.id, 'paid', v)}
                                                                            type="number"
                                                                            placeholder="Amount Paid..."
                                                                        />
                                                                    </div>
                                                                    {feeStatus?.status === 'paid' && (
                                                                        <div className="flex items-center gap-1.5 px-2 py-1 bg-success/10 text-success rounded-md text-[10px] font-bold">
                                                                            <Check className="w-3 h-3" /> Fully Paid
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-3">
                                                                <div className="flex flex-col gap-0.5">
                                                                    <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded w-fit ${feeStatus?.status === 'paid' ? 'bg-success text-white' :
                                                                            feeStatus?.status === 'partial' ? 'bg-warning text-white' :
                                                                                'bg-muted-foreground text-white'
                                                                        }`}>
                                                                        {feeStatus?.status}
                                                                    </span>
                                                                    {feeStatus?.status !== 'paid' && (feeStatus?.totalFee || 0) > 0 && (
                                                                        <span className="text-[10px] text-destructive font-bold uppercase">₹{feeStatus?.due} due</span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </>
                                                    )}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Footer with save */}
                            <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
                                <span className="text-xs text-muted-foreground">
                                    {mode === 'marks' && `${applicableSubjects.find(s => s.id === marksContext.subjectId)?.name || ''} · ${examOptions.find(e => e.id === marksContext.examId)?.name || ''} · ${marksContext.date} ${currentExam?.isPublished ? '(Published)' : ''}`}
                                    {mode === 'fees' && `${filteredStudents.length} students · bulk fee update`}
                                </span>
                                <div className="flex items-center gap-3">
                                    {mode !== 'marks' && (
                                        <button
                                            onClick={handleSave}
                                            disabled={saving}
                                            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60"
                                        >
                                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                            {saving ? 'Saving...' : 'Save All Changes'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                )
            )}
        </div >
    );
};

export default ClassConsole;

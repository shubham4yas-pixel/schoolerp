import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useStore } from '@/store/useStore';
import { useAuth } from '@/contexts/AuthContext';
import { Student } from '@/lib/types';
import { getStudentsByClassSection, getClassName, getUniqueSections } from '@/lib/data-utils';
import { ClipboardList, Loader2, RotateCcw, Send, Upload, Save, Check } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

interface BatchMarksEntryProps {
    onStudentClick?: (student: Student) => void;
    hideFilters?: boolean;
}

const PERSIST_KEY = 'marks_entry_context';

const BatchMarksEntry = ({ onStudentClick, hideFilters = false }: BatchMarksEntryProps) => {
    const { schoolId, role } = useAuth();
    const {
        students,
        globalFilterClass: filterClass,
        globalFilterSection: filterSection,
        setGlobalFilterClass,
        setGlobalFilterSection,
        exams,
        subjects: allSubjects,
        updateStudentResult,
        updateExamPublishStatus,
        classes,
        marks: unifiedMarks
    } = useStore();

    const getSafeContext = () => {
        try {
            const saved = localStorage.getItem(PERSIST_KEY);
            return saved ? JSON.parse(saved) : null;
        } catch { return null; }
    };

    const [context, setContext] = useState(getSafeContext() || {
        subjectId: '',
        examId: exams?.[0]?.id || '',
        date: new Date().toISOString().split('T')[0],
        totalMarks: '100'
    });

    const [publishing, setPublishing] = useState(false);
    const [saving, setSaving] = useState(false);
    const sortedExams = useMemo(() => [...exams].sort((a, b) => a.order - b.order), [exams]);
    const examValues = sortedExams.map(e => e.id);
    const examLabels = sortedExams.map(e => e.name);

    const [localMarks, setLocalMarks] = useState<Record<string, string>>({});
    const [savingStatus, setSavingStatus] = useState<Record<string, 'idle' | 'saving' | 'saved' | 'error'>>({});
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const filteredStudents = useMemo(
        () => filterClass ? getStudentsByClassSection(students, filterClass, filterSection || undefined) : [],
        [students, filterClass, filterSection]
    );

    const toggleStudent = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        if (selectedIds.size === filteredStudents.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(filteredStudents.map(s => s.id)));
    };

    useEffect(() => {
        localStorage.setItem(PERSIST_KEY, JSON.stringify(context));
    }, [context]);

    const handleDownloadTemplate = () => {
        if (!filterClass || !context.subjectId || !context.examId) {
            toast.error("Please select a class, subject and exam first.");
            return;
        }

        const subName = allSubjects.find(s => s.id === context.subjectId)?.name || context.subjectId;
        const headers = ["Roll No", "Student ID", "Name", "Marks", "Out Of"];
        const data = filteredStudents.map(s => ({
            "Roll No": s.rollNumber || s.id,
            "Student ID": s.id,
            "Name": s.name,
            "Marks": "",
            "Out Of": context.totalMarks
        }));

        const ws = XLSX.utils.json_to_sheet(data, { header: headers });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Marks Template");
        XLSX.writeFile(wb, `${getClassName(filterClass, classes)}_${subName}_${context.examId}_Template.xlsx`);
        toast.success("Template downloaded!");
    };

    const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const data = XLSX.utils.sheet_to_json<any>(ws);

                if (!data.length) {
                    toast.error("File is empty or invalid format");
                    return;
                }

                setSaving(true);
                let processedCount = 0;
                for (const row of data) {
                    const sId = row["Student ID"];
                    const rNo = row["Roll No"];
                    const marksVal = row["Marks"];

                    const student = students.find(s => s.id === sId) || (rNo ? students.find(s => String(s.rollNumber || (s as any).roll_number) === String(rNo)) : null);

                    if (student && marksVal !== undefined && marksVal !== "" && context.subjectId && context.examId) {
                        const val = parseFloat(marksVal);
                        if (!isNaN(val)) {
                            await updateStudentResult(schoolId!, student.id, context.examId, context.subjectId, val, 'bulk_entry');
                            processedCount++;
                        }
                    }
                }
                toast.success(`Imported marks for ${processedCount} students`);
            } catch (err) {
                toast.error("Import failed. Check file format.");
            } finally {
                setSaving(false);
            }
        };
        reader.readAsBinaryString(file);
    };

    const reset = () => {
        setLocalMarks({});
        setSavingStatus({});
    };

    const handleMassPublish = async (ids: string[], isPublished: boolean) => {
        if (!ids.length || !context.examId) return;
        setPublishing(true);
        try {
            await updateExamPublishStatus(schoolId!, ids, context.examId, isPublished);
            toast.success(`Marks ${isPublished ? 'published' : 'unpublished'} for ${ids.length} students`);
            if (ids.length === selectedIds.size) setSelectedIds(new Set());
        } catch (err) {
            toast.error("Status update failed");
        } finally {
            setPublishing(false);
        }
    };

    const applicableSubjects = useMemo(() => {
        if (!filterClass || allSubjects.length === 0) return { values: [], labels: [] };
        const filtered = allSubjects.filter(sub => !sub.classIds || sub.classIds.length === 0 || sub.classIds.includes(filterClass));
        return { values: filtered.map(s => s.id), labels: filtered.map(s => s.name) };
    }, [filterClass, allSubjects]);

    const handleMarkChange = (studentId: string, val: string) => {
        const key = `${studentId}-${context.subjectId}`;
        setLocalMarks(prev => ({ ...prev, [key]: val }));
        const marksNum = parseFloat(val);
        const totalNum = parseFloat(context.totalMarks);

        if (val === '') {
            setSavingStatus(prev => ({ ...prev, [key]: 'idle' }));
        } else if (!isNaN(marksNum) && marksNum >= 0 && marksNum <= totalNum) {
            triggerAutoSave(studentId, marksNum);
        } else {
            setSavingStatus(prev => ({ ...prev, [key]: 'error' }));
        }
    };

    const autoSaveTimers = useRef<Record<string, NodeJS.Timeout>>({});
    const triggerAutoSave = (studentId: string, marksVal: number) => {
        const key = `${studentId}-${context.subjectId}`;
        if (autoSaveTimers.current[key]) clearTimeout(autoSaveTimers.current[key]);
        setSavingStatus(prev => ({ ...prev, [key]: 'saving' }));

        autoSaveTimers.current[key] = setTimeout(async () => {
            try {
                await updateStudentResult(schoolId!, studentId, context.examId, context.subjectId, marksVal, 'bulk_entry');
                setSavingStatus(prev => ({ ...prev, [key]: 'saved' }));
                setTimeout(() => setSavingStatus(prev => ({ ...prev, [key]: 'idle' })), 2000);
            } catch (err) {
                setSavingStatus(prev => ({ ...prev, [key]: 'error' }));
            }
        }, 1000);
    };

    const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
        const inputs = document.querySelectorAll('.mark-input');
        if (e.key === 'ArrowDown' || e.key === 'Enter') {
            (inputs[index + 1] as HTMLElement)?.focus();
        } else if (e.key === 'ArrowUp') {
            (inputs[index - 1] as HTMLElement)?.focus();
        }
    };

    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex flex-wrap gap-4 items-center justify-between">
                <div className="flex items-center gap-3">
                    <h3 className="font-display font-black text-foreground text-sm uppercase tracking-[0.15em]">Batch Marks Entry</h3>
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                    {context.examId && (
                        <>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleMassPublish(filteredStudents.map(s => s.id), true)}
                                    disabled={publishing || filteredStudents.length === 0}
                                    className="h-9 px-4 text-[10px] font-black uppercase tracking-wider bg-[#059669] text-white rounded-full hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-md shadow-emerald-500/20 disabled:opacity-50"
                                >
                                    <Send className="w-3.5 h-3.5" /> Publish All
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleMassPublish(Array.from(selectedIds), true)}
                                    disabled={publishing || selectedIds.size === 0}
                                    className="h-9 px-4 text-[10px] font-black uppercase tracking-wider bg-[#c084fc] text-white rounded-full hover:bg-purple-500 transition-all flex items-center gap-2 shadow-md shadow-purple-500/20 disabled:opacity-50"
                                >
                                    <Send className="w-3.5 h-3.5" /> Publish Selected
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleMassPublish(filteredStudents.map(s => s.id), false)}
                                    disabled={publishing || filteredStudents.length === 0}
                                    className="h-9 px-4 text-[10px] font-black uppercase tracking-wider bg-[#ea580c] text-white rounded-full hover:bg-orange-700 transition-all flex items-center gap-2 shadow-md shadow-orange-500/20 disabled:opacity-50"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" /> Unpublish All
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleMassPublish(Array.from(selectedIds), false)}
                                    disabled={publishing || selectedIds.size === 0}
                                    className="h-9 px-4 text-[10px] font-black uppercase tracking-wider bg-orange-50 text-orange-600 border border-orange-200 rounded-full hover:bg-orange-100 transition-all flex items-center gap-2 disabled:opacity-40"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" /> Unpublish Selected
                                </button>
                            </div>

                            <div className="flex items-center gap-2 border-l border-border pl-2 border-dashed">
                                <button
                                    type="button"
                                    onClick={handleDownloadTemplate}
                                    className="h-9 px-4 text-[10px] font-black uppercase tracking-wider bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-full hover:bg-indigo-100 transition-all flex items-center gap-2"
                                >
                                    <Upload className="w-3.5 h-3.5 rotate-180" /> Template
                                </button>
                                <label className="h-9 px-4 text-[10px] font-black uppercase tracking-wider bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full hover:bg-emerald-100 transition-all flex items-center gap-2 cursor-pointer">
                                    <Upload className="w-3.5 h-3.5" /> Upload Excel
                                    <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleExcelUpload} />
                                </label>
                            </div>
                            <button
                                type="button"
                                onClick={reset}
                                className="h-9 px-4 text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200 transition-all flex items-center gap-2"
                            >
                                <RotateCcw className="w-3.5 h-3.5" /> Reset
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="bg-card p-6 rounded-2xl border border-border shadow-soft">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
                    <div className="space-y-1.5">
                        <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Class</label>
                        <select
                            value={filterClass}
                            onChange={e => {
                                setGlobalFilterClass(e.target.value);
                                setGlobalFilterSection('');
                            }}
                            className="w-full h-11 pl-4 pr-4 text-sm bg-slate-50 border border-slate-200 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all appearance-none cursor-pointer"
                        >
                            <option value="">Select Class...</option>
                            {classes.sort((a, b) => a.order - b.order).map(c => (
                                <option key={c.classId} value={c.classId}>{getClassName(c.classId, classes)}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Section</label>
                        <select
                            value={filterSection}
                            onChange={e => setGlobalFilterSection(e.target.value)}
                            disabled={!filterClass}
                            className="w-full h-11 pl-4 pr-10 text-sm bg-slate-50 border border-slate-200 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all appearance-none cursor-pointer disabled:opacity-50"
                        >
                            <option value="">All Sec</option>
                            {getUniqueSections(students, filterClass).map(s => (
                                <option key={s} value={s}>Sec {s}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Exam</label>
                        <select
                            value={context.examId}
                            onChange={v => setContext({ ...context, examId: v.target.value })}
                            className="w-full h-11 pl-4 pr-4 text-sm bg-slate-50 border border-slate-200 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all appearance-none cursor-pointer"
                        >
                            <option value="">Select Exam...</option>
                            {examValues.map((v, i) => (
                                <option key={v} value={v}>{examLabels[i]}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Subject</label>
                        <select
                            value={context.subjectId}
                            onChange={v => setContext({ ...context, subjectId: v.target.value })}
                            className="w-full h-11 pl-4 pr-4 text-sm bg-slate-50 border border-slate-200 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all appearance-none cursor-pointer"
                        >
                            <option value="">Select Subject...</option>
                            {applicableSubjects.values.map((v, i) => (
                                <option key={v} value={v}>{applicableSubjects.labels[i]}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 text-center w-full">Total Marks</label>
                        <input
                            type="number"
                            value={context.totalMarks}
                            onChange={e => setContext({ ...context, totalMarks: e.target.value })}
                            className="w-full h-11 px-3 text-sm bg-slate-50 border border-slate-200 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 font-black text-center"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Exam Date</label>
                        <input
                            type="date"
                            value={context.date}
                            onChange={e => setContext({ ...context, date: e.target.value })}
                            className="w-full h-11 px-4 text-sm bg-slate-50 border border-slate-200 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 font-bold transition-all"
                        />
                    </div>
                </div>
            </div>

            {!filterClass ? (
                 <div className="py-16 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-2xl bg-muted/5">
                    <ClipboardList className="w-12 h-12 opacity-20 mb-3" />
                    <p className="text-sm font-bold tracking-tight">Select a class to load students</p>
                </div>
            ) : filteredStudents.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-2xl bg-muted/5">
                    <Loader2 className="w-10 h-10 animate-spin opacity-20 mb-3" />
                    <p className="text-sm font-bold tracking-tight">No students found for this selection</p>
                </div>
            ) : (
                <div className="border border-border rounded-2xl overflow-hidden shadow-soft bg-card">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-muted/30 border-b border-border">
                                <th className="px-5 py-3 text-left w-10">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.size === filteredStudents.length && filteredStudents.length > 0}
                                        onChange={toggleAll}
                                        className="w-4 h-4 rounded border-border text-primary accent-primary"
                                    />
                                </th>
                                <th className="px-5 py-3 text-left font-black uppercase tracking-widest text-[9px] text-muted-foreground">Roll No</th>
                                <th className="px-5 py-3 text-left font-black uppercase tracking-widest text-[9px] text-muted-foreground">Student Name</th>
                                <th className="px-5 py-3 text-right font-black uppercase tracking-widest text-[9px] text-muted-foreground w-48">Marks</th>
                                <th className="px-5 py-3 text-center font-black uppercase tracking-widest text-[9px] text-muted-foreground w-24">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {filteredStudents.map((student, idx) => {
                                const key = `${student.id}-${context.subjectId}`;
                                const status = savingStatus[key] || 'idle';
                                
                                const currentMark = unifiedMarks.find(m => 
                                    m.studentId === student.id && 
                                    m.examId === context.examId && 
                                    m.subjectId === context.subjectId
                                );
                                
                                const currentVal = localMarks[key] ?? (currentMark?.marksObtained?.toString() || '');
                                const isPublished = currentMark?.isPublished;

                                return (
                                    <tr key={student.id} className={`hover:bg-muted/10 transition-colors ${selectedIds.has(student.id) ? 'bg-primary/5' : ''}`}>
                                        <td className="px-5 py-4">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(student.id)}
                                                onChange={() => toggleStudent(student.id)}
                                                className="w-4 h-4 rounded border-border text-primary accent-primary"
                                            />
                                        </td>
                                        <td className="px-5 py-4 font-black text-[10px] text-primary/40 uppercase tracking-tighter">[{student.rollNumber || student.id}]</td>
                                        <td className="px-5 py-4 font-bold text-foreground flex items-center gap-2">
                                            <div 
                                                className={onStudentClick ? "cursor-pointer hover:text-primary hover:underline transition-colors" : ""}
                                                onClick={onStudentClick ? () => onStudentClick(student) : undefined}
                                            >
                                                {student.name}
                                            </div>
                                            {isPublished && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" title="Published" />}
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex items-center justify-end gap-2 text-muted-foreground font-semibold">
                                                <input
                                                    type="number"
                                                    className="mark-input w-24 bg-background border border-border rounded-lg px-3 py-2 font-black text-primary text-right outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                                    value={currentVal}
                                                    onChange={(e) => handleMarkChange(student.id, e.target.value)}
                                                    onKeyDown={(e) => handleKeyDown(e, idx)}
                                                    placeholder="-"
                                                    disabled={publishing}
                                                />
                                                <span className="opacity-40 text-xs font-black uppercase">/ {context.totalMarks}</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex justify-center">
                                                {status === 'saving' && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
                                                {status === 'saved' && <div className="px-2 py-0.5 bg-success/10 text-success rounded text-[9px] font-black uppercase tracking-widest flex items-center gap-1"><Check className="w-3 h-3" /> Saved</div>}
                                                {status === 'error' && <div className="px-2 py-0.5 bg-destructive/10 text-destructive rounded text-[9px] font-black uppercase tracking-widest">Invalid</div>}
                                                {status === 'idle' && isPublished && <div className="px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded text-[8px] font-black uppercase tracking-widest">Published</div>}
                                                {status === 'idle' && !isPublished && currentVal && <div className="px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-100 rounded text-[8px] font-black uppercase tracking-widest">Draft</div>}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default BatchMarksEntry;

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useStore } from '@/store/useStore';
import { useAuth } from '@/contexts/AuthContext';
import { Student, Mark, Feedback, FeeRecord, Payment, ACADEMIC_MONTHS } from '@/lib/types';
import { calculateFeeStatus, getStudentsByClassSection, getFeeSummary, normalizeClassString, getClassName, getUniqueSections, getAcademicContext, getNextPayableMonth, getPaymentMonthGuard } from '@/lib/data-utils';
import ClassSectionFilter from '@/components/ClassSectionFilter';
import StudentCombobox from '@/components/StudentCombobox';
import AttendanceEntryPanel from '@/components/AttendanceEntryPanel';
import { UserPlus, ClipboardList, Calendar, MessageSquare, IndianRupee, Check, ChevronRight, ChevronLeft, Loader2, Users, CheckSquare, Bus, RotateCcw, Send, Upload, Save } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { hasSubAccess } from '@/lib/rbac-utils';
import BatchMarksEntry from '@/components/BatchMarksEntry';

const colors = ['#1e3a5f', '#d4950a', '#2e8b6e', '#000085e9', '#dc4545', '#0891b2', '#9333ea'];

type FormTab = 'student' | 'marks' | 'attendance' | 'feedback' | 'fees';

const DataEntryForms = () => {
  const { schoolId, role } = useAuth();
  const { students, loading, addStudent, addMark, classes } = useStore();

  const formTabs = useMemo(() => {
    const allTabs: { id: FormTab; label: string; icon: React.ReactNode }[] = [
      { id: 'student', label: 'Register Student', icon: <UserPlus className="w-4 h-4" /> },
      { id: 'marks', label: 'Enter Marks', icon: <ClipboardList className="w-4 h-4" /> },
      { id: 'attendance', label: 'Attendance', icon: <Calendar className="w-4 h-4" /> },
      { id: 'feedback', label: 'Feedback', icon: <MessageSquare className="w-4 h-4" /> },
      { id: 'fees', label: 'Fee Update', icon: <IndianRupee className="w-4 h-4" /> },
    ];
    if (!role) return [];
    return allTabs.filter(tab => hasSubAccess(role, tab.id));
  }, [role]);

  const [activeForm, setActiveForm] = useState<FormTab>(() => {
    const saved = localStorage.getItem('active_data_form') as FormTab;
    if (saved && hasSubAccess(role || 'admin', saved)) return saved;
    return (formTabs && formTabs.length > 0) ? formTabs[0].id : 'student';
  });

  useEffect(() => {
    if (role && !hasSubAccess(role, activeForm)) {
      if (formTabs.length > 0) setActiveForm(formTabs[0].id);
    }
  }, [role, activeForm, formTabs]);

  useEffect(() => {
    localStorage.setItem('active_data_form', activeForm);
  }, [activeForm]);

  const [isDataTimeout, setIsDataTimeout] = useState(false);

  // Safety timeout for loading state
  useEffect(() => {
    if (loading.students || loading.marks) {
      const timer = setTimeout(() => setIsDataTimeout(true), 5000);
      return () => clearTimeout(timer);
    }
  }, [loading.students, loading.marks]);

  if ((loading.students || loading.marks) && !isDataTimeout) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-muted-foreground text-sm font-medium">Initializing data entry forms...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {formTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveForm(tab.id)}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${activeForm === tab.id
              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30'
              : 'bg-card border border-border text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-card rounded-2xl border border-border p-6 shadow-soft">
        {activeForm === 'student' && <StudentRegistrationForm schoolId={schoolId} addStudent={addStudent} students={students} role={role} />}
        {activeForm === 'marks' && <MarksEntryForm schoolId={schoolId} addMark={addMark} students={students} role={role} />}
        {activeForm === 'attendance' && <AttendanceForm students={students} />}
        {activeForm === 'feedback' && <FeedbackForm schoolId={schoolId} students={students} role={role} />}
        {activeForm === 'fees' && <FeeUpdateForm schoolId={schoolId} students={students} role={role} />}
      </div>
    </div>
  );
};

// ─── Student Registration ──────────────────────────────────────────────────────
const StudentRegistrationForm = ({ schoolId, addStudent, students, role }: { schoolId: string; addStudent: any; students: Student[]; role: string | null }) => {
  const { feeConfigs, classes, loading } = useStore();
  const sortedClasses = useMemo(() => (classes ? [...classes].sort((a, b) => a.order - b.order) : []), [classes]);
  const defaultClass = sortedClasses.length > 0 ? sortedClasses[0].classId : '';

  const [form, setForm] = useState({ 
    name: '', 
    classId: defaultClass, 
    className: sortedClasses.length > 0 ? sortedClasses[0].name : '',
    section: 'A', 
    parentName: '', 
    parentContact: '', 
    address: '', 
    dateOfBirth: '', 
    bloodGroup: '', 
    rollNumber: '',
    totalFees: '0',
    paidAmount: '0'
  });
  const [busOpted, setBusOpted] = useState(false);
  const [bus, setBus] = useState({ pickup: '', drop: '', route: '', fee: '0' });

  // Auto-fill total fee from config when class changes
  useEffect(() => {
    if (!feeConfigs) return;
    const config = feeConfigs.find(c => c.classId === form.classId);
    if (config) {
      setForm(f => ({ ...f, totalFees: config.totalFee.toString() }));
      setBus(b => ({ ...b, fee: (config.optionalCharges?.transport || 0).toString() }));
    }
  }, [form.classId, feeConfigs]);

  useEffect(() => {
    if (sortedClasses.length > 0 && !sortedClasses.find(c => c.classId === form.classId)) {
      const first = sortedClasses[0];
      setForm(f => ({ ...f, classId: first.classId, className: first.name }));
    }
  }, [sortedClasses, form.classId]);

  // Effective total = tuition + bus fee (if opted)
  const effectiveTotalFee = parseFloat(form.totalFees) || 0;
  const effectiveBusFee = busOpted ? (parseFloat(bus.fee) || 0) : 0;
  const grandTotal = effectiveTotalFee + effectiveBusFee;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.parentName || !form.parentContact) { toast.error('Please fill required fields'); return; }
    if (!form.className) { toast.error('Class selection is required'); return; }

    const newStudent: Student = {
      id: "", // ID will be auto-generated by Firestore
      name: form.name, 
      class: form.className, // Mandatory identifier
      classId: form.classId, 
      className: form.className,
      section: form.section,
      schoolId: 'school_001',
      rollNumber: form.rollNumber || `R${Date.now()}`, // Fallback unique ID
      totalFees: Number(form.totalFees || 0),
      paidAmount: Number(form.paidAmount || 0),
      parentName: form.parentName, 
      parentContact: form.parentContact,
      enrollmentDate: new Date().toISOString().split('T')[0],
      avatarColor: colors[Math.floor(Math.random() * colors.length)],
      isActive: true, // For state management sync
      address: form.address, 
      dateOfBirth: form.dateOfBirth, 
      bloodGroup: form.bloodGroup,
      transport_enabled: busOpted,
      bus: { 
        opted: busOpted, 
        enabled: busOpted,
        pickup: bus.pickup, 
        drop: bus.drop, 
        route: bus.route, 
        fee: parseFloat(bus.fee) || 0 
      },
    };

    // Supabase insert logic
    const { supabase } = await import('@/lib/supabase');

    const { error } = await supabase
      .from('students')
      .insert([
        {
          school_id: schoolId,
          name: newStudent.name,
          class: newStudent.class,
          class_id: newStudent.classId,
          section: newStudent.section,
          roll_number: newStudent.rollNumber,
          total_fees: newStudent.totalFees,
          paid_amount: newStudent.paidAmount,
          transport_enabled: busOpted,
          created_at: new Date().toISOString(),
        }
      ]);

    if (error) {
      console.error("Student insert failed:", error);
      toast.error("Failed to register student");
      return;
    }

    toast.success(`${form.name} registration successful`);
    setForm({ 
      name: '', 
      classId: defaultClass, 
      className: sortedClasses.length > 0 ? sortedClasses[0].name : '',
      section: 'A', 
      parentName: '', 
      parentContact: '', 
      address: '', 
      dateOfBirth: '', 
      bloodGroup: '', 
      rollNumber: '',
      totalFees: '0',
      paidAmount: '0'
    });
    setBusOpted(false);
    setBus({ pickup: '', drop: '', route: '', fee: '0' });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="font-display font-semibold text-foreground text-lg">Register New Student</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Student Name *" value={form.name} onChange={v => setForm({ ...form, name: v })} />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Class"
            value={form.className}
            onChange={(name) => {
              const cls = sortedClasses.find(c => c.name === name);
              if (cls) {
                setForm({ ...form, className: name, classId: cls.classId });
              }
            }}
            options={sortedClasses.map(c => c.name)}
            placeholder={
              loading.classes
                ? "Syncing classes..."
                : sortedClasses.length === 0
                  ? "No classes configured"
                  : "Select class"
            }
          />
          <Select
            label="Section"
            value={form.section}
            onChange={(v) => setForm({ ...form, section: v })}
            options={sortedClasses.find(c => c.classId === form.classId)?.sections || []}
            placeholder={!form.classId ? "Select Class First" : "Select Section"}
          />
        </div>
        <Input label="Parent Name *" value={form.parentName} onChange={v => setForm({ ...form, parentName: v })} />
        <Input label="Parent Contact *" value={form.parentContact} onChange={v => setForm({ ...form, parentContact: v })} />
        <Input label="Date of Birth" type="date" value={form.dateOfBirth} onChange={v => setForm({ ...form, dateOfBirth: v })} />
        <Input label="Blood Group" value={form.bloodGroup} onChange={v => setForm({ ...form, bloodGroup: v })} placeholder="e.g. B+" />
        <div className="md:col-span-2">
          <Input label="Address" value={form.address} onChange={v => setForm({ ...form, address: v })} />
        </div>
        <Input 
          label="Roll Number *" 
          value={form.rollNumber} 
          onChange={v => setForm({ ...form, rollNumber: v })} 
          placeholder="Required Unique ID"
        />
        <div className="md:col-span-2 p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-3">
          <Input
            label={`Tuition Fee (${getClassName(form.classId, classes)})`}
            type="number"
            value={form.totalFees}
            onChange={v => setForm({ ...form, totalFees: v })}
            placeholder="Total academic fee for this student"
          />
          <Input
            label="Initial Paid Amount (₹)"
            type="number"
            value={form.paidAmount}
            onChange={v => setForm({ ...form, paidAmount: v })}
            placeholder="Amount paid during registration"
          />
          {busOpted && effectiveBusFee > 0 && (
            <div className="flex items-center justify-between text-sm pt-1">
              <span className="text-muted-foreground">Transport Fee + Tuition</span>
              <span className="font-bold text-primary">₹{(Number(form.paidAmount) || 0).toLocaleString()} paid of ₹{(grandTotal).toLocaleString()} total</span>
            </div>
          )}
        </div>
      </div>

      {/* Bus opt-in — action-based reveal */}
      <div className="p-4 bg-muted/20 border border-border rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Bus className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground tracking-tight">Transport Services</p>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">School Bus Requirement</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setBusOpted(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${busOpted ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
              Yes
            </button>
            <button type="button" onClick={() => setBusOpted(false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${!busOpted ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
              No
            </button>
          </div>
        </div>
        {busOpted && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <Input label="Pickup Point" value={bus.pickup} onChange={v => setBus(b => ({ ...b, pickup: v }))} placeholder="e.g. Main Gate" />
            <Input label="Drop Point" value={bus.drop} onChange={v => setBus(b => ({ ...b, drop: v }))} placeholder="e.g. Park Colony" />
            <Input label="Bus Route" value={bus.route} onChange={v => setBus(b => ({ ...b, route: v }))} placeholder="e.g. Route A" />
            <Input label="Bus Fee (₹)" type="number" value={bus.fee} onChange={v => setBus(b => ({ ...b, fee: v }))} placeholder="e.g. 3000" />
          </div>
        )}
      </div>

      <SubmitBtn label="Register Student" disabled={role !== 'admin'} />
    </form>
  );
};

// ─── Marks Entry ─────────────────────────────────────────────────────────────
const MarksEntryForm = ({ schoolId, addMark, students, role }: { schoolId: string; addMark: any; students: Student[]; role: string | null }) => {
  return <BatchMarksEntry />;
};

// ─── Attendance ───────────────────────────────────────────────────────────────
const AttendanceForm = ({ students }: { students: Student[] }) => (
  <AttendanceEntryPanel students={students} />
);

// ─── Feedback ─────────────────────────────────────────────────────────────────
const GENERAL_FEEDBACK_EXAM = '__general__';

const FeedbackForm = ({ schoolId, students, role }: { schoolId: string; students: Student[]; role: string | null }) => {
  const { user } = useAuth();
  const {
    feedbacks,
    saveFeedbacks,
    exams,
    classes,
    globalFilterClass,
    globalFilterSection,
  } = useStore();

  const sortedExams = useMemo(() => [...exams].sort((a, b) => a.order - b.order), [exams]);
  const [examId, setExamId] = useState('');
  const [feedbackData, setFeedbackData] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const selectedExamName = useMemo(
    () => sortedExams.find(exam => exam.id === examId)?.name || '',
    [sortedExams, examId]
  );

  const filteredStudents = useMemo(
    () => globalFilterClass ? getStudentsByClassSection(students, globalFilterClass, globalFilterSection || undefined) : [],
    [students, globalFilterClass, globalFilterSection]
  );

  const feedbackLookup = useMemo(() => {
    const map = new Map<string, Feedback>();
    const selectedClassName = globalFilterClass ? getClassName(globalFilterClass, classes) : '';

    feedbacks.forEach((feedback) => {
      const matchesClass = !globalFilterClass ||
        feedback.classId === globalFilterClass ||
        (!feedback.classId && (feedback.class || '') === selectedClassName);
      const matchesSection = !globalFilterSection || (feedback.section || '') === globalFilterSection;
      const matchesExam = selectedExamName
        ? (feedback.examType || '') === selectedExamName
        : !(feedback.examType || '').trim();

      if (matchesClass && matchesSection && matchesExam && !map.has(feedback.studentId)) {
        map.set(feedback.studentId, feedback);
      }
    });

    return map;
  }, [feedbacks, globalFilterClass, globalFilterSection, selectedExamName, classes]);

  useEffect(() => {
    const next: Record<string, string> = {};
    filteredStudents.forEach((student) => {
      const existing = feedbackLookup.get(student.id);
      next[student.id] = String(existing?.feedbackText || existing?.remark || '');
    });
    setFeedbackData(next);
    setSelectedIds(new Set());
    setHasChanges(false);
  }, [filteredStudents, feedbackLookup]);

  const toggleStudent = (studentId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredStudents.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredStudents.map(student => student.id)));
  };

  const updateFeedback = (studentId: string, value: string) => {
    setFeedbackData((prev) => ({
      ...prev,
      [studentId]: value,
    }));
    setHasChanges(true);
  };

  const getRowStatus = (studentId: string) => {
    const existing = feedbackLookup.get(studentId);
    const currentText = String(feedbackData[studentId] || '').trim();
    const existingText = String(existing?.feedbackText || existing?.remark || '').trim();

    if (currentText && currentText !== existingText) {
      return { label: 'Unsaved', className: 'bg-amber-100 text-amber-800 border-amber-200' };
    }
    if (existing?.status === 'published') {
      return { label: 'Published', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
    }
    if (existing?.status === 'draft') {
      return { label: 'Draft', className: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
    return { label: 'Not saved', className: 'bg-muted text-muted-foreground border-border' };
  };

  const buildPayload = (studentIds: string[], status: 'draft' | 'published') => {
    const now = new Date().toISOString();

    return studentIds.flatMap((studentId) => {
      const student = filteredStudents.find(entry => entry.id === studentId);
      const feedbackText = String(feedbackData[studentId] || '').trim();
      if (!student || !feedbackText) return [];

      const existing = feedbackLookup.get(studentId);
      const nextId = existing?.id || `FB_${student.id}_${examId || GENERAL_FEEDBACK_EXAM}`;

      return [{
        id: nextId,
        studentId: student.id,
        class: getClassName(student.classId, classes) || student.class || '',
        classId: student.classId,
        section: student.section || '',
        teacherId: user?.uid || existing?.teacherId || '',
        teacherName: user?.name || user?.email || existing?.teacherName || 'Teacher',
        examType: selectedExamName || '',
        feedbackText,
        remark: feedbackText,
        status,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
        date: now.split('T')[0],
      } as Feedback];
    });
  };

  const handleSaveAll = async () => {
    if (!globalFilterClass) {
      toast.error('Please select a class');
      return;
    }

    const records = buildPayload(filteredStudents.map(student => student.id), 'draft');
    if (!records.length) {
      toast.error('Enter feedback for at least one student');
      return;
    }

    setSaving(true);
    try {
      await saveFeedbacks(schoolId, records);
      setHasChanges(false);
      toast.success(`Saved ${records.length} feedback draft${records.length === 1 ? '' : 's'}`);
    } catch (error) {
      console.error('Failed to save feedback drafts:', error);
      toast.error('Failed to save feedback drafts');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (studentIds: string[]) => {
    if (!globalFilterClass) {
      toast.error('Please select a class');
      return;
    }

    const records = buildPayload(studentIds, 'published');
    if (!records.length) {
      toast.error('Select students with feedback to publish');
      return;
    }

    setPublishing(true);
    try {
      await saveFeedbacks(schoolId, records);
      setHasChanges(false);
      setSelectedIds(new Set());
      toast.success(`Published ${records.length} feedback entr${records.length === 1 ? 'y' : 'ies'}`);
    } catch (error) {
      console.error('Failed to publish feedback:', error);
      toast.error('Failed to publish feedback');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="font-display font-semibold text-foreground text-lg">Batch Feedback Entry</h3>
          {selectedIds.size > 0 && (
            <span className="px-2.5 py-0.5 bg-primary/10 text-primary text-[10px] font-black uppercase rounded-full border border-primary/20">
              {selectedIds.size} Selected
            </span>
          )}
          {hasChanges && (
            <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-black uppercase rounded-full border border-amber-200">
              Unsaved Changes
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={!hasChanges || saving}
            className="h-8 px-3 text-[11px] font-bold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            {saving ? 'Saving...' : 'Save All'}
          </button>
          <button
            type="button"
            onClick={() => handlePublish(filteredStudents.map(student => student.id))}
            disabled={publishing || filteredStudents.length === 0}
            className="h-8 px-3 text-[11px] font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            {publishing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
            Publish All
          </button>
          <button
            type="button"
            onClick={() => handlePublish(Array.from(selectedIds))}
            disabled={publishing || selectedIds.size === 0}
            className="h-8 px-3 text-[11px] font-bold rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            <Send className="w-3 h-3" />
            Publish Selected
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_240px] gap-4">
        <div className="space-y-3">
          <ClassSectionFilter students={students} useGlobal compact />
        </div>
        <Select
          label="Exam (Optional)"
          value={examId}
          onChange={setExamId}
          options={['', ...sortedExams.map(exam => exam.id)]}
          labels={['General Feedback', ...sortedExams.map(exam => exam.name)]}
          placeholder="General Feedback"
        />
      </div>

      {!globalFilterClass ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border border-dashed border-border rounded-xl bg-card">
          <Users className="w-10 h-10 mb-3 opacity-30" />
          <p className="font-medium text-lg">Select a class to load students</p>
          <p className="text-sm mt-1 opacity-70">Use the class and section filters above to start feedback entry</p>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-muted-foreground border border-dashed border-border rounded-xl bg-card">
          <Users className="w-8 h-8 mb-2 opacity-30" />
          <p className="font-medium">
            No students in {getClassName(globalFilterClass, classes)}{globalFilterSection ? `-${globalFilterSection}` : ''}
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.size > 0 && selectedIds.size === filteredStudents.length}
                      onChange={toggleAll}
                      className="rounded border-border"
                    />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Student</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Feedback</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Updated</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => {
                  const existing = feedbackLookup.get(student.id);
                  const statusMeta = getRowStatus(student.id);

                  return (
                    <tr key={student.id} className="border-b border-border/50 transition-colors hover:bg-muted/20">
                      <td className="px-4 py-3 align-top">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(student.id)}
                          onChange={() => toggleStudent(student.id)}
                          className="mt-2 rounded border-border"
                        />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="min-w-[180px]">
                          <div className="font-medium text-foreground flex items-center gap-1.5">
                            <span className="font-bold text-xs opacity-60">[{student.rollNumber || student.id}]</span>
                            {student.name}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-1">
                            {getClassName(student.classId, classes)} {student.section ? `· ${student.section}` : ''}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <textarea
                          value={feedbackData[student.id] || ''}
                          onChange={(event) => updateFeedback(student.id, event.target.value)}
                          placeholder={`Write ${selectedExamName || 'general'} feedback for ${student.name}...`}
                          className="w-full min-w-[280px] min-h-[88px] px-3 py-2 text-sm bg-muted/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                        />
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="flex flex-col gap-2 min-w-[110px]">
                          <span className={`inline-flex items-center justify-center px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-full border ${statusMeta.className}`}>
                            {statusMeta.label}
                          </span>
                          {existing?.examType && (
                            <span className="text-[11px] text-muted-foreground">
                              {existing.examType}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top hidden lg:table-cell">
                        <span className="text-xs text-muted-foreground">
                          {existing?.updatedAt || existing?.createdAt || existing?.date
                            ? new Date(existing.updatedAt || existing.createdAt || existing.date || Date.now()).toLocaleString()
                            : '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Fee Update ───────────────────────────────────────────────────────────────
const FeeUpdateForm = ({ schoolId, students, role }: { schoolId: string; students: Student[]; role: string | null }) => {
  const { recordPayment, payments, feeSettings, classes, globalFilterClass: filterClass, globalFilterSection: filterSection, setGlobalFilterClass, setGlobalFilterSection } = useStore();
  
  // Step 6 — ADD DEBUG LOG
  useEffect(() => {
    console.log("feeSettings:", feeSettings);
  }, [feeSettings]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [indivMonth, setIndivMonth] = useState('');
  const [indivStatus, setIndivStatus] = useState('');
  const [indivPaid, setIndivPaid] = useState('');
  const [indivSaving, setIndivSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPaid, setBulkPaid] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [mode, setMode] = useState<'individual' | 'bulk'>('individual');

  const { currentMonth: CURRENT_MONTH, academicYear: ACADEMIC_YEAR } = useMemo(() => getAcademicContext(), []);
  const academicMonths = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];

  const filteredStudents = useMemo(
    () => filterClass ? getStudentsByClassSection(students, filterClass, filterSection || undefined) : [],
    [students, filterClass, filterSection]
  );

  const selectedStudent = useMemo(() => students.find(s => s.id === selectedStudentId), [students, selectedStudentId]);
  const nextPayableMonth = useMemo(() => {
    if (!selectedStudent) return null;
    return getNextPayableMonth(selectedStudent, ACADEMIC_YEAR);
  }, [selectedStudent, ACADEMIC_YEAR, payments]);
  const activeIndividualMonth = indivMonth || nextPayableMonth || CURRENT_MONTH;

  const summary = useMemo(() => {
    if (!selectedStudent) return null;
    return getFeeSummary(selectedStudent, activeIndividualMonth, ACADEMIC_YEAR);
  }, [selectedStudent, activeIndividualMonth, ACADEMIC_YEAR, payments]);

  const computedDue = useMemo(() => {
    return Number(summary?.due || 0);
  }, [summary]);

  useEffect(() => {
    if (!selectedStudent) return;
    setIndivMonth(getNextPayableMonth(selectedStudent, ACADEMIC_YEAR) || CURRENT_MONTH);
    setIndivStatus('');
    setIndivPaid('');
  }, [selectedStudentId, selectedStudent, ACADEMIC_YEAR, CURRENT_MONTH, payments]);

  const toggleStudent = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredStudents.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredStudents.map(s => s.id)));
  };

  const handleBulkUpdate = async () => {
    if (selectedIds.size === 0) return;
    setBulkSaving(true);
    try {
      const selectedMonthData = ACADEMIC_MONTHS.find(m => m.name === CURRENT_MONTH);
      if (!selectedMonthData) {
        toast.error("Invalid month for bulk update");
        setBulkSaving(false);
        return;
      }
      const monthKey = `${ACADEMIC_YEAR}_${selectedMonthData.index}`;

      const ids = Array.from(selectedIds);
      let count = 0;
      let skippedLocked = 0;
      let skippedPaid = 0;
      let skippedInvalid = 0;
      for (const id of ids) {
        const s = students.find(stu => stu.id === id);
        if (!s) continue;

        const paymentGuard = getPaymentMonthGuard(s, CURRENT_MONTH, ACADEMIC_YEAR);
        if (!paymentGuard.allowed) {
          skippedLocked++;
          continue;
        }

        const sum = getFeeSummary(s, CURRENT_MONTH, ACADEMIC_YEAR);
        if (Number(sum.due || 0) <= 0) {
          skippedPaid++;
          continue;
        }

        const paidAmount = bulkPaid ? Number(bulkPaid || 0) : Number(sum.due || 0);
        if (paidAmount <= 0 || paidAmount > Number(sum.due || 0)) {
          skippedInvalid++;
          continue;
        }
        const paymentId = `PAY_${Date.now()}_${id}`;

        const paymentRecord: Payment = {
          id: paymentId,
          studentId: id,
          studentName: s.name,
          classId: s.classId,
          section: s.section,
          month: CURRENT_MONTH,
          monthIndex: selectedMonthData.index,
          monthKey: monthKey,
          year: new Date().getFullYear().toString(),
          academicYear: ACADEMIC_YEAR,
          amount: paidAmount,
          amount_total: Number(sum.totalFee || paidAmount),
          status: paidAmount >= Number(sum.due || 0) ? 'paid' : 'partial',
          date: new Date().toISOString().split('T')[0],
          timestamp: new Date().toISOString(),
          paidAt: new Date().toISOString()
        };

        await recordPayment(schoolId, paymentRecord);
        count++;
      }
      toast.success(`Fees updated for ${count} students${skippedPaid ? `, ${skippedPaid} already paid` : ''}${skippedLocked ? `, ${skippedLocked} locked by previous due` : ''}${skippedInvalid ? `, ${skippedInvalid} invalid amounts` : ''}`);
      setSelectedIds(new Set());
      setBulkPaid('');
    } catch (err) {
      toast.error("Bulk update failed");
    } finally {
      setBulkSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button onClick={() => setMode('individual')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${mode === 'individual' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>Individual Payment</button>
        <button onClick={() => setMode('bulk')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${mode === 'bulk' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>Bulk Update</button>
      </div>

      {mode === 'individual' ? (
        <div className="space-y-4 max-w-lg">
          <div className="space-y-2">
            <label className="block text-xs font-medium text-muted-foreground">Select Student</label>
            <StudentCombobox students={students} selectedId={selectedStudentId} onSelect={setSelectedStudentId} />
          </div>

          {selectedStudent && (
            <div className="p-5 bg-primary/5 border border-primary/20 rounded-2xl space-y-4">
	              <div className="flex justify-between items-start">
	                <div>
	                  <h4 className="font-bold text-foreground">{selectedStudent.name}</h4>
	                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{getClassName(selectedStudent.classId, classes)} • Section {selectedStudent.section}</p>
	                </div>
	                <div className="text-right">
	                  <p className="text-[10px] font-black uppercase text-primary tracking-widest">Balance Due</p>
	                  {(() => {
	                    const balance = Number(computedDue || 0);
	                    const monthlyFee = Number(feeSettings?.[selectedStudent.classId || ""]?.monthlyFee || summary?.baseFee || 0);
	                    const busFee = Number(selectedStudent.bus?.fee || selectedStudent.bus?.fare || summary?.busFee || 0);
	                    const showBusBreakdown = !!selectedStudent.transport_enabled;

	                    // STEP 7 — VERIFY DATA FLOW
	                    console.log("feeSettings:", feeSettings);
	                    console.log("selectedStudent (profile):", selectedStudent);

	                    return (
	                      <div className="space-y-1">
	                        <p className="text-xl font-black text-primary leading-none">
	                          ₹{balance.toLocaleString()}
	                        </p>
	                        {showBusBreakdown && (
	                          <p className="text-[10px] font-medium text-muted-foreground">
	                            (₹{monthlyFee.toLocaleString()} + ₹{busFee.toLocaleString()} bus)
	                          </p>
	                        )}
	                      </div>
	                    );
	                  })()}
	                </div>
	              </div>

              <div className="grid grid-cols-2 gap-3">
                <Select label="Month" value={indivMonth} onChange={setIndivMonth} options={academicMonths} placeholder="Select Month..." />
                <Select label="Status" value={indivStatus} onChange={setIndivStatus} options={['paid', 'partial']} placeholder="Select Status..." />
              </div>
              {indivStatus === 'partial' && <Input label="Amount Paid" type="number" value={indivPaid} onChange={setIndivPaid} placeholder="Enter partial amount" />}
              <button
                type="button"
                onClick={async () => {
                  if (!indivMonth || !indivStatus) {
                    alert("Please select both month and status before recording payment");
                    return;
                  }

                  if (!selectedStudent) {
                    toast.error("Please select a student");
                    return;
                  }
                  
                  setIndivSaving(true);
                  try {
                    const selectedMonthData = ACADEMIC_MONTHS.find(m => m.name === indivMonth);
                    if (!selectedMonthData) {
                      toast.error("Invalid month");
                      setIndivSaving(false);
                      return;
                    }

                    const paymentGuard = getPaymentMonthGuard(selectedStudent, indivMonth, ACADEMIC_YEAR);
                    if (!paymentGuard.allowed) {
                      alert(paymentGuard.reason);
                      setIndivSaving(false);
                      return;
                    }

                    const monthSummary = getFeeSummary(selectedStudent, indivMonth, ACADEMIC_YEAR);
                    const monthPayments = payments.filter(p =>
                      p.studentId === selectedStudent.id &&
                      p.month === indivMonth &&
                      p.academicYear === ACADEMIC_YEAR
                    );
                    const totalPaid = monthPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
                    const balance = Math.max(Number(monthSummary.totalFee || 0) - totalPaid, 0);

                    if (balance <= 0) {
                      alert("Already fully paid");
                      setIndivSaving(false);
                      return;
                    }

                    let amount = 0;

                    if (indivStatus === 'paid') {
                      amount = balance;
                    } else if (indivStatus === 'partial') {
                      amount = parseFloat(indivPaid);

                      if (isNaN(amount) || amount <= 0) {
                        alert("Enter valid amount");
                        setIndivSaving(false);
                        return;
                      }

                      if (amount > balance) {
                        alert(`Cannot pay more than ₹${balance}`);
                        setIndivSaving(false);
                        return;
                      }
                    }

                    const paymentRecord: Payment = {
                      id: `PAY_${Date.now()}_${selectedStudent.id}`,
                      studentId: selectedStudent.id,
                      studentName: selectedStudent.name,
                      classId: selectedStudent.classId,
                      section: selectedStudent.section,
                      month: indivMonth,
                      monthIndex: selectedMonthData.index,
                      monthKey: `${ACADEMIC_YEAR}_${selectedMonthData.index}`,
                      year: new Date().getFullYear().toString(),
                      academicYear: ACADEMIC_YEAR,
                      amount,
                      amount_total: Number(monthSummary.totalFee || amount),
                      status: amount === balance ? 'paid' : 'partial',
                      date: new Date().toISOString().split('T')[0],
                      timestamp: new Date().toISOString(),
                      paidAt: new Date().toISOString()
                    };

                    await recordPayment(schoolId, paymentRecord);
                    // force refresh by triggering state dependency
                    setIndivMonth(prev => prev);
                    toast.success(`Fee for ${indivMonth} recorded successfully`);
                    setIndivStatus('');
                    setIndivPaid('');
                  } catch (err: any) {
                    toast.error("Payment failed: " + err.message);
                  } finally {
                    setIndivSaving(false);
                  }
                }}
                className="w-full py-3 bg-primary text-white rounded-xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all hover:-translate-y-0.5 active:translate-y-0"
              >
                {indivSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <IndianRupee className="w-4 h-4" />} Record Payment
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <ClassSectionFilter students={students} useGlobal />
	          <div className="bg-muted/20 border border-border rounded-2xl overflow-hidden">
	            <div className="flex items-center justify-between p-3 bg-muted/30 border-b border-border">
	              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Students ({filteredStudents.length})</span>
	              <button type="button" onClick={toggleAll} className="text-[10px] font-black uppercase tracking-widest text-primary hover:text-primary/70 transition-colors">
	                {selectedIds.size === filteredStudents.length ? 'DESELECT ALL' : 'SELECT ALL'}
	              </button>
	            </div>
	            <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-3 space-y-2">
	              <div className="grid grid-cols-12 gap-3 px-8 pb-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
	                <div className="col-span-12 md:col-span-5">Student</div>
	                <div className="col-span-4 md:col-span-2 text-center">Monthly Fee</div>
	                <div className="col-span-4 md:col-span-2 text-center">Bus Fee</div>
	                <div className="col-span-4 md:col-span-3 text-right">Total Due</div>
	              </div>
	              {filteredStudents.map(s => {
	                const sum = getFeeSummary(s, CURRENT_MONTH, ACADEMIC_YEAR);
	                const isBusUser = !!s.transport_enabled;
	                return (
                  <label key={s.id} className="flex items-center gap-4 p-3 bg-card border border-border rounded-xl cursor-pointer hover:bg-muted/30 transition-all group">
                    <input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleStudent(s.id)} className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20 accent-primary" />
                    <div className="flex-1 min-w-0 grid grid-cols-12 gap-3 items-center">
                      <div className="col-span-12 md:col-span-5 flex flex-col">
                        <p className="text-sm font-bold text-foreground truncate group-hover:text-primary">{s.name}</p>
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-tight">ID: {s.id}</p>
                      </div>
                      <div className="col-span-4 md:col-span-2 text-center text-[10px] font-bold text-muted-foreground">₹{sum.baseFee}</div>
                      <div className="col-span-4 md:col-span-2 text-center text-[10px] font-bold text-primary">{isBusUser ? `₹${sum.busFee}` : '—'}</div>
                      <div className="col-span-4 md:col-span-3 text-right font-black text-foreground">₹{sum.due}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <Input label="Amount Paid" type="number" value={bulkPaid} onChange={setBulkPaid} placeholder="Leave empty for full payment" />
          </div>
          <button onClick={handleBulkUpdate} disabled={bulkSaving || selectedIds.size === 0} className="w-full py-4 bg-primary text-white rounded-xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 disabled:opacity-50">
            {bulkSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />} Update {selectedIds.size} Students
          </button>
        </div>
      )}
    </div>
  );
};

const Input = ({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) => (
  <div className="space-y-1.5 flex-1 min-w-[120px]">
    <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">{label}</label>
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full px-4 py-2.5 text-sm bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium" />
  </div>
);

const Select = ({ label, value, onChange, options, labels, placeholder }: { label: string; value: string; onChange: (v: string) => void; options: string[]; labels?: string[]; placeholder?: string }) => (
  <div className="space-y-1.5 flex-1 min-w-[120px]">
    <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">{label}</label>
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full px-4 py-2.5 text-sm bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-bold appearance-none">
      {placeholder && <option value="">{placeholder}</option>}
      {(options || []).map((o, i) => <option key={o} value={o}>{labels ? labels[i] : o}</option>)}
    </select>
  </div>
);

const SubmitBtn = ({ label, disabled }: { label: string; disabled?: boolean }) => (
  <button type="submit" disabled={disabled} className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-black uppercase tracking-widest shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none">
    <Check className="w-4 h-4" />
    {label}
  </button>
);

const EmptySection = ({ message }: { message: string }) => (
  <div className="py-16 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-2xl bg-muted/5">
    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
      <Users className="w-8 h-8 opacity-20" />
    </div>
    <p className="text-sm font-bold tracking-tight">{message}</p>
    <p className="text-xs font-medium opacity-60">Try adjusting your filters above.</p>
  </div>
);

export default DataEntryForms;

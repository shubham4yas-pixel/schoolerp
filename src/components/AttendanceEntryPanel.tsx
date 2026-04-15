import { useEffect, useMemo, useState } from 'react';
import { Calendar, CheckSquare, Loader2, RotateCcw, Save, Users, XSquare } from 'lucide-react';
import { toast } from 'sonner';
import ClassSectionFilter from '@/components/ClassSectionFilter';
import { useAuth } from '@/contexts/AuthContext';
import {
  getAttendancePercentage,
  getAttendanceStatusLabel,
  getClassName,
  getStudentAttendance,
  getStudentsByClassSection,
  normalizeAttendanceStatus,
} from '@/lib/data-utils';
import { AttendanceRecord, Student } from '@/lib/types';
import { useStore } from '@/store/useStore';
import StudentAvatar from '@/components/StudentAvatar';

type AttendanceDraft = {
  status: 'present' | 'absent' | 'leave';
  reason: string;
};

const STATUS_OPTIONS: Array<{ value: AttendanceDraft['status']; label: string; activeClass: string }> = [
  { value: 'present', label: 'Present', activeClass: 'bg-success text-white' },
  { value: 'absent', label: 'Absent', activeClass: 'bg-destructive text-white' },
  { value: 'leave', label: 'Leave', activeClass: 'bg-warning text-white' },
];

const defaultDraft = (): AttendanceDraft => ({ status: 'present', reason: '' });

const buildDrafts = (students: Student[], attendance: AttendanceRecord[], date: string) => {
  const existing = new Map<string, AttendanceDraft>();

  attendance
    .filter(record => record.date === date)
    .forEach(record => {
      existing.set(record.studentId, {
        status: normalizeAttendanceStatus(record.status),
        reason: record.reason || '',
      });
    });

  const drafts: Record<string, AttendanceDraft> = {};
  students.forEach(student => {
    drafts[student.id] = existing.get(student.id) || defaultDraft();
  });
  return drafts;
};

const AttendanceEntryPanel = ({
  students,
  title = 'Mark Attendance',
  onStudentClick,
}: {
  students: Student[];
  title?: string;
  onStudentClick?: (student: Student) => void;
}) => {
  const { schoolId } = useAuth();
  const {
    attendance,
    classes,
    globalFilterClass,
    globalFilterSection,
    saveAttendance,
  } = useStore();

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [rows, setRows] = useState<Record<string, AttendanceDraft>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const today = new Date();

  const filteredStudents = useMemo(
    () => globalFilterClass ? getStudentsByClassSection(students, globalFilterClass, globalFilterSection || undefined) : [],
    [students, globalFilterClass, globalFilterSection],
  );

  useEffect(() => {
    setRows(buildDrafts(filteredStudents, attendance, date));
    setHasChanges(false);
  }, [filteredStudents, attendance, date]);

  const isToday = (() => {
    const selected = new Date(date);
    return (
      selected.getFullYear() === today.getFullYear() &&
      selected.getMonth() === today.getMonth() &&
      selected.getDate() === today.getDate()
    );
  })();
  const isLocked = !isToday;

  const presentCount = filteredStudents.filter(student => (rows[student.id] || defaultDraft()).status === 'present').length;

  if (!students || !date) {
    return null;
  }

  const updateRow = (studentId: string, patch: Partial<AttendanceDraft>) => {
    if (isLocked) return;
    setRows(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || defaultDraft()),
        ...patch,
      },
    }));
    setHasChanges(true);
  };

  const markAll = (status: AttendanceDraft['status']) => {
    if (isLocked) return;
    const next: Record<string, AttendanceDraft> = {};
    filteredStudents.forEach(student => {
      const current = rows[student.id] || defaultDraft();
      next[student.id] = {
        status,
        reason: status === 'present' ? '' : current.reason,
      };
    });
    setRows(next);
    setHasChanges(true);
  };

  const handleReset = () => {
    setRows(buildDrafts(filteredStudents, attendance, date));
    setHasChanges(false);
  };

  const handleSave = async () => {
    if (!globalFilterClass) {
      toast.error('Please select a class');
      return;
    }
    if (!filteredStudents.length) {
      toast.error('No students to save');
      return;
    }
    if (isLocked) {
      toast.error('Past attendance is locked. Only today can be edited.');
      return;
    }
    if (!hasChanges) {
      return;
    }

    setSaving(true);
    try {
      const records: AttendanceRecord[] = filteredStudents.map(student => {
        const row = rows[student.id] || defaultDraft();
        return {
          id: '',
          studentId: student.id,
          date,
          status: row.status,
          reason: row.status === 'present' ? null : row.reason.trim() || null,
          updatedAt: new Date().toISOString(),
        };
      });

      await saveAttendance(schoolId, records);
      setHasChanges(false);
      toast.success(`Attendance saved for ${filteredStudents.length} students`);
    } catch (error) {
      console.error('Failed to save attendance:', error);
      toast.error('Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="font-display font-semibold text-foreground text-lg">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              One attendance entry per student per day. Today can be edited, older dates are read-only.
            </p>
          </div>
          <div className="min-w-[140px]">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Date</label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="date"
                value={date}
                onChange={event => setDate(event.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-muted/50 border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring font-medium"
              />
            </div>
          </div>
        </div>

        <div className="mt-4">
          <ClassSectionFilter students={students} useGlobal compact />
        </div>

        {globalFilterClass && filteredStudents.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <button
              type="button"
              onClick={() => markAll('present')}
              disabled={isLocked}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-success/10 text-success border border-success/20 rounded-lg hover:bg-success/20 transition-colors disabled:opacity-50"
            >
              <CheckSquare className="w-3.5 h-3.5" /> All Present
            </button>
            <button
              type="button"
              onClick={() => markAll('absent')}
              disabled={isLocked}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20 rounded-lg hover:bg-destructive/20 transition-colors disabled:opacity-50"
            >
              <XSquare className="w-3.5 h-3.5" /> All Absent
            </button>
            {isLocked && (
              <span className="text-xs font-medium text-warning">
                Viewing locked attendance for {date}
              </span>
            )}
          </div>
        )}
      </div>

      {!globalFilterClass ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border border-dashed border-border rounded-xl bg-card">
          <Users className="w-10 h-10 mb-3 opacity-30" />
          <p className="font-medium text-lg">Select a class to load students</p>
          <p className="text-sm mt-1 opacity-70">Use the class and section filters above to get started</p>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-muted-foreground border border-dashed border-border rounded-xl bg-card">
          <Users className="w-8 h-8 mb-2 opacity-30" />
          <p className="font-medium">
            No students in {getClassName(globalFilterClass, classes)}{globalFilterSection ? `-${globalFilterSection}` : ''}
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-3 items-center">
            <span className="text-sm font-medium text-muted-foreground">
              {filteredStudents.length} students · {getClassName(globalFilterClass, classes)} {globalFilterSection ? `-${globalFilterSection}` : ''}
            </span>
            <span className="text-sm text-success font-medium">
              {presentCount} present · {filteredStudents.length - presentCount} absent/leave
            </span>
          </div>

          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Student</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Section</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reason</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Curr. Att%</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map(student => {
                    const row = rows[student.id] || defaultDraft();
                    const monthlyRecords = getStudentAttendance(student.id, attendance);
                    const currentPct = getAttendancePercentage(student.id, attendance);
                    const showReason = row.status === 'absent' || row.status === 'leave';

                    return (
                      <tr
                        key={student.id}
                        className={`border-b border-border/50 transition-colors hover:bg-muted/20 ${row.status === 'absent' ? 'bg-destructive/5' : ''}`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <StudentAvatar
                              student={student}
                              className="w-7 h-7 rounded-lg flex-shrink-0"
                              initialsClassName="text-[10px] font-bold text-white"
                            />
                            <div className="min-w-0">
                              <div
                                className={`font-medium text-foreground truncate max-w-[220px] flex items-center gap-1.5 ${onStudentClick ? 'cursor-pointer hover:text-primary hover:underline transition-colors' : ''}`}
                                onClick={onStudentClick ? () => onStudentClick(student) : undefined}
                              >
                                <span className="font-bold text-xs opacity-60 flex-shrink-0">[{student.rollNumber || student.id}]</span>
                                {student.name}
                              </div>
                              <div className="text-[10px] text-muted-foreground font-mono opacity-50 uppercase tracking-tighter">
                                {monthlyRecords.length} recorded day{monthlyRecords.length === 1 ? '' : 's'} this month
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground hidden sm:table-cell">{student.section}</td>
                        <td className="px-3 py-3">
                          <div className="flex gap-1 flex-wrap">
                            {STATUS_OPTIONS.map(option => (
                              <button
                                key={option.value}
                                type="button"
                                disabled={isLocked}
                                onClick={() => updateRow(student.id, { status: option.value, reason: option.value === 'present' ? '' : row.reason })}
                                className={`px-2 py-1 rounded text-xs font-medium transition-all ${row.status === option.value ? option.activeClass : 'bg-muted/50 text-muted-foreground hover:bg-muted'} disabled:opacity-50`}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          {showReason ? (
                            <input
                              value={row.reason}
                              disabled={isLocked}
                              onChange={event => updateRow(student.id, { reason: event.target.value })}
                              placeholder={`Reason for ${getAttendanceStatusLabel(row.status).toLowerCase()}...`}
                              className="w-full px-2 py-1.5 text-sm bg-muted/60 border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-ring min-w-[120px] disabled:bg-muted/40"
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right hidden md:table-cell">
                          <span className={`text-sm font-semibold ${currentPct >= 75 ? 'text-success' : 'text-warning'}`}>
                            {currentPct}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
              <span className="text-xs text-muted-foreground">
                {presentCount}/{filteredStudents.length} present · {isToday ? 'editable today' : 'read-only history'}
              </span>
              <div className="flex items-center gap-3">
                {hasChanges && !isLocked && (
                  <span className="text-xs font-medium text-warning">Unsaved changes</span>
                )}
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!hasChanges || saving || isLocked}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Saving...' : 'Save Attendance'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AttendanceEntryPanel;

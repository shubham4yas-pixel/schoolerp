import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import {
  getOverallPercentage,
  getAttendancePercentage,
  getSubjectAnalysis,
  getClassRanking,
  getStudentBusRoute,
  getClassName,
  getStudentAttendance,
  getStudentPendingStatus,
  getAcademicContext,
} from '@/lib/data-utils';
import ClassSectionFilter from '@/components/ClassSectionFilter';
import StudentAvatar from '@/components/StudentAvatar';
import { Student } from '@/lib/types';
import { User, MapPin, Phone, Calendar, Droplets, Bus, BookOpen, TrendingUp, Award, MessageSquare, ChevronDown, ChevronUp, Loader2, AlertCircle, Filter } from 'lucide-react';

const StudentSearch = () => {
  const { students, marks, attendance, loading, payments, feeSettings, busRoutes, classes: storeClasses } = useStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const filterType = searchParams.get('filter');
  const [query, setQuery] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { currentMonthIndex, academicYear } = useMemo(() => getAcademicContext(), []);

  const filterLabel = useMemo(() => {
    switch (filterType) {
      case 'fees_pending': return 'Students with Pending Fees';
      case 'attendance_critical': return 'Low Attendance Students';
      case 'performance_low': return 'Low Performing Students';
      default: return null;
    }
  }, [filterType]);

  const results = useMemo(() => {
    let list = students;

    // Apply URL Filter Logic
    if (filterType === "fees_pending") {
      list = list.filter(s => getStudentPendingStatus(s, payments, feeSettings, currentMonthIndex, academicYear).isPending);
    } else if (filterType === "attendance_critical") {
      list = list.filter(s => {
        const pct = getAttendancePercentage(s.id, attendance);
        const records = getStudentAttendance(s.id, attendance);
        return records.length > 0 && pct < 75;
      });
    } else if (filterType === "performance_low") {
      list = list.filter(s => {
        const pct = getOverallPercentage(s.id, marks);
        const studentMarks = marks.filter(m => m.studentId === s.id);
        return studentMarks.length > 0 && pct < 40;
      });
    }

    return list.filter(s => {
      const matchesClass = !classFilter || (s.classId || "") === classFilter;
      const matchesSection = !sectionFilter || (s.section || "") === sectionFilter;
      const matchesQuery = !query ||
        (s.name || "").toLowerCase().includes(query.toLowerCase()) ||
        (s.id || "").toLowerCase().includes(query.toLowerCase()) ||
        (s.rollNumber || "").toLowerCase().includes(query.toLowerCase());
      return matchesClass && matchesSection && matchesQuery;
    });
  }, [students, marks, attendance, payments, feeSettings, currentMonthIndex, academicYear, classFilter, sectionFilter, query, filterType]);

  if (loading.students || loading.marks) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {filterLabel && (
        <div className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-2xl px-5 py-4 shadow-sm mb-2">
          <div className="flex items-center gap-3 text-primary font-bold">
            <Filter className="w-5 h-5" />
            <span className="tracking-tight text-lg">Showing: {filterLabel}</span>
          </div>
          <button
            onClick={() => setSearchParams({})}
            className="px-4 py-1.5 text-xs font-black uppercase tracking-widest bg-primary/10 text-primary border border-primary/20 rounded-xl hover:bg-primary/20 transition-all"
          >
            Clear Filter
          </button>
        </div>
      )}

      {!filterLabel && (
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-display font-semibold text-foreground text-lg mb-4">Student Search</h3>
          <ClassSectionFilter
            students={students}
            selectedClass={classFilter}
            selectedSection={sectionFilter}
            searchQuery={query}
            onClassChange={cls => { setClassFilter(cls); setSectionFilter(''); }}
            onSectionChange={setSectionFilter}
            onSearchChange={setQuery}
            showSearch
          />
        </div>
      )}

      <div className="space-y-3">
        {results.map(s => (
          <StudentSearchCard
            key={s.id}
            student={s}
            expanded={expandedId === s.id}
            onToggle={() => setExpandedId(expandedId === s.id ? null : s.id)}
            storeData={{ students, marks, attendance, payments, feeSettings, busRoutes, classes: storeClasses, currentMonthIndex, academicYear }}
          />
        ))}
        {results.length === 0 && (
          <div className="bg-card rounded-xl border border-border p-12 text-center">
            <User className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-foreground font-bold">No students match this condition</p>
            <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters or search query.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const StudentSearchCard = ({ student, expanded, onToggle, storeData }: { student: Student; expanded: boolean; onToggle: () => void; storeData: any }) => {
  const { students, marks, attendance, payments, feeSettings, busRoutes, classes: storeClasses, currentMonthIndex, academicYear } = storeData;
  const subjects = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English'];

  const overallPct = getOverallPercentage(student.id, marks);
  const attPct = getAttendancePercentage(student.id, attendance);
  const ranking = getClassRanking(student.id, students, marks);
  const analysis = getSubjectAnalysis(student.id, marks, subjects);
  const feedback: any[] = []; // Feedback not in store yet
  const feeSummary = getStudentPendingStatus(student, payments, feeSettings, currentMonthIndex, academicYear);
  const busRoute = getStudentBusRoute(student.id, busRoutes);

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between p-4 hover:bg-muted/20 transition-colors text-left">
        <div className="flex items-center gap-3">
          <StudentAvatar
            student={student}
            className="w-10 h-10 rounded-lg flex-shrink-0"
            initialsClassName="text-sm font-bold text-primary-foreground"
          />
          <div>
            <div className="font-medium text-foreground flex items-center gap-1.5">
              <span className="font-bold text-xs opacity-60 flex-shrink-0">[{student.rollNumber || student.id}]</span>
              {student.name === student.id ? `Student ${student.id}` : student.name}
            </div>
            <div className="text-xs text-muted-foreground">
              {getClassName(student.classId, storeClasses)} · Section {student.section}
              {student.name !== student.id && ` · ID: ${student.id}`}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className={`text-sm font-semibold ${overallPct >= 75 ? 'text-success' : overallPct >= 50 ? 'text-warning' : 'text-destructive'}`}>{overallPct}%</span>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border p-5 space-y-5">
          {/* Personal Info */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><User className="w-4 h-4" /> Personal Information</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <InfoItem icon={Calendar} label="DOB" value={student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString() : 'N/A'} />
              <InfoItem icon={Droplets} label="Blood" value={student.bloodGroup || 'N/A'} />
              <InfoItem icon={Phone} label="Parent" value={student.parentContact} />
              <InfoItem icon={MapPin} label="Address" value={student.address || 'N/A'} />
            </div>
          </div>

          {/* Academic Summary */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><BookOpen className="w-4 h-4" /> Academic Summary</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MiniStat label="Overall" value={`${overallPct}%`} color={overallPct >= 75 ? 'text-success' : 'text-warning'} />
              <MiniStat label="Attendance" value={`${attPct}%`} color={attPct >= 85 ? 'text-success' : 'text-warning'} />
              <MiniStat label={`${ranking.scope} Rank`} value={`#${ranking.rank}/${ranking.total}`} color="text-primary" />
              <MiniStat
                label="Fees"
                value={
                  feeSummary.status === 'paid' ? 'Paid'
                    : feeSummary.status === 'partial' ? 'Partial'
                      : 'Unpaid'
                }
                color={
                  feeSummary.status === 'paid'
                    ? 'text-success'
                    : feeSummary.status === 'partial'
                      ? 'text-warning'
                      : 'text-destructive'
                }
              />
            </div>
          </div>

          {/* Subject Breakdown */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Subject Analysis</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {analysis.scores.map(sc => (
                <div key={sc.subject} className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg">
                  <span className="text-sm text-foreground">{sc.subject}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-muted rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full ${sc.average >= 75 ? 'bg-success' : sc.average >= 50 ? 'bg-warning' : 'bg-destructive'}`} style={{ width: `${sc.average}%` }} />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground w-8 text-right">{sc.average}%</span>
                  </div>
                </div>
              ))}
            </div>
            {analysis.strong.length > 0 && (
              <p className="text-xs text-success mt-2 flex items-center gap-1"><Award className="w-3 h-3" /> Strong: {analysis.strong.map(s => s.subject).join(', ')}</p>
            )}
            {analysis.weak.length > 0 && (
              <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Weak: {analysis.weak.map(s => s.subject).join(', ')}
              </p>
            )}
          </div>

          {/* Bus Info */}
          {busRoute && (
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><Bus className="w-4 h-4" /> Transport</h4>
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-sm text-foreground font-medium">{busRoute.routeName} ({busRoute.routeNumber})</p>
                <p className="text-xs text-muted-foreground">{busRoute.vehicleNumber} · Driver: {busRoute.driverName} ({busRoute.driverContact})</p>
              </div>
            </div>
          )}

          {/* Latest Feedback */}
          {feedback.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Latest Feedback</h4>
              <div className="bg-muted/30 rounded-lg p-3">
                <div className="flex justify-between mb-1">
                  <span className="text-xs font-medium text-foreground">{feedback[0].teacherName}</span>
                  <span className="text-xs text-muted-foreground">{new Date(feedback[0].date).toLocaleDateString()}</span>
                </div>
                <p className="text-xs text-muted-foreground">{feedback[0].remark}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const InfoItem = ({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) => (
  <div className="flex items-start gap-2 text-xs">
    <Icon className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
    <div>
      <span className="text-muted-foreground">{label}</span>
      <p className="text-foreground font-medium truncate">{value}</p>
    </div>
  </div>
);

const MiniStat = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <div className="text-center p-2.5 bg-muted/30 rounded-lg">
    <div className={`text-lg font-bold ${color}`}>{value}</div>
    <div className="text-xs text-muted-foreground">{label}</div>
  </div>
);

export default StudentSearch;

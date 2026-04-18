import { useState, useEffect, useMemo } from 'react';
import AppLayout from '@/components/AppLayout';
import StatCard from '@/components/StatCard';
import StudentProfile from '@/components/StudentProfile';
import ProfileErrorBoundary from '@/components/ProfileErrorBoundary';
import PeerComparison from '@/components/PeerComparison';
import DataEntryForms from '@/components/DataEntryForms';
import ClassConsole from '@/components/ClassConsole';
import BusManagement from '@/components/BusManagement';
import StudentSearch from '@/components/StudentSearch';
import FileUpload from '@/components/FileUpload';
import StudentAvatar from '@/components/StudentAvatar';
import ProfilePhotoWidget from '@/components/ProfilePhotoWidget';
import { useAuth } from '@/contexts/AuthContext';
import { useStore } from '@/store/useStore';
import {
  getOverallPercentage,
  getAttendancePercentage,
  getClassAverage,
  searchStudents,
  getAvailableSubjectsForMarks,
  formatClassName,
} from '@/lib/data-utils';
import { AttendanceRecord, Mark, Student } from '@/lib/types';
import { Users, TrendingUp, AlertTriangle, BarChart3, LayoutDashboard, ClipboardList, Bus, Search, Upload, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { filterTabs, canViewTab } from '@/lib/rbac-utils';

type TeacherTab = 'overview' | 'console' | 'compare' | 'forms' | 'search' | 'bus' | 'upload';

interface TeacherOverviewTabProps {
  teacherClass: string;
  classStudents: Student[];
  students: Student[];
  marks: Mark[];
  attendance: AttendanceRecord[];
  subjects: string[];
  studentSearch: string;
  setStudentSearch: (value: string) => void;
  onSelectStudent: (student: Student) => void;
}

const TeacherOverviewTab = ({
  teacherClass,
  classStudents,
  students,
  marks,
  attendance,
  subjects,
  studentSearch,
  setStudentSearch,
  onSelectStudent,
}: TeacherOverviewTabProps) => {
  const avgPerf = useMemo(
    () => (classStudents.length > 0
      ? Math.round(classStudents.reduce((sum, student) => sum + getOverallPercentage(student.id, marks), 0) / classStudents.length)
      : 0),
    [classStudents, marks],
  );

  const weakStudents = useMemo(
    () => classStudents.filter(student => getOverallPercentage(student.id, marks) < 65),
    [classStudents, marks],
  );

  const lowAttendance = useMemo(
    () => classStudents.filter(student => getAttendancePercentage(student.id, attendance) < 80),
    [classStudents, attendance],
  );

  const subjectData = useMemo(
    () => subjects
      .map(subject => ({
        subject: subject.length > 5 ? subject.slice(0, 4) : subject,
        average: getClassAverage(teacherClass, subject, students || [], marks || []),
      }))
      .filter(item => item.average > 0),
    [subjects, teacherClass, students, marks],
  );

  const filteredClassStudents = useMemo(
    () => searchStudents(studentSearch, classStudents),
    [studentSearch, classStudents],
  );

  const rankedStudents = useMemo(
    () => [...filteredClassStudents].sort((left, right) => getOverallPercentage(right.id, marks) - getOverallPercentage(left.id, marks)),
    [filteredClassStudents, marks],
  );

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Class Size" value={classStudents.length} icon={Users} />
        <StatCard label="Class Average" value={`${avgPerf}%`} icon={TrendingUp} variant="success" />
        <StatCard label="Weak Students" value={weakStudents.length} icon={AlertTriangle} variant={weakStudents.length > 0 ? 'warning' : 'success'} />
        <StatCard label="Low Attendance" value={lowAttendance.length} icon={BarChart3} variant={lowAttendance.length > 0 ? 'destructive' : 'success'} />
      </div>

      <div className="bg-card rounded-xl border border-border p-5 mb-6">
        <h3 className="font-display font-semibold text-foreground mb-4">Subject-wise Class Average</h3>
        {subjectData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={subjectData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="subject" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
              <Bar dataKey="average" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[250px] flex items-center justify-center">
            <p className="text-sm text-muted-foreground font-medium">No academic data available yet</p>
          </div>
        )}
      </div>

      {(weakStudents.length > 0 || lowAttendance.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {weakStudents.length > 0 && (
            <div className="bg-warning/5 border border-warning/20 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-warning" />
                <h3 className="font-display font-semibold text-foreground">Below Average</h3>
              </div>
              <div className="space-y-2">
                {weakStudents.map(student => (
                  <button
                    key={student.id}
                    onClick={() => onSelectStudent(student)}
                    className="w-full flex justify-between items-center px-3 py-2 bg-card border border-border rounded-lg text-sm hover:border-warning/40 transition-colors"
                  >
                    <span className="text-foreground">{student.name}</span>
                    <span className="text-warning font-medium">{getOverallPercentage(student.id, marks)}%</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {lowAttendance.length > 0 && (
            <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                <h3 className="font-display font-semibold text-foreground">Low Attendance</h3>
              </div>
              <div className="space-y-2">
                {lowAttendance.map(student => (
                  <button
                    key={student.id}
                    onClick={() => onSelectStudent(student)}
                    className="w-full flex justify-between items-center px-3 py-2 bg-card border border-border rounded-lg text-sm hover:border-destructive/40 transition-colors"
                  >
                    <span className="text-foreground">{student.name}</span>
                    <span className="text-destructive font-medium">{getAttendancePercentage(student.id, attendance)}%</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-foreground">Class Students</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search students..."
              value={studentSearch}
              onChange={event => setStudentSearch(event.target.value)}
              className="pl-9 pr-4 py-2 text-sm bg-muted/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
        <div className="space-y-2">
          {rankedStudents.map((student, index) => {
            const percentage = getOverallPercentage(student.id, marks);
            return (
              <button
                key={student.id}
                onClick={() => onSelectStudent(student)}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors text-left"
              >
                <span className="text-sm font-medium text-muted-foreground w-6">#{index + 1}</span>
                <StudentAvatar
                  student={student}
                  className="w-8 h-8 rounded-lg"
                  initialsClassName="text-xs font-bold text-primary-foreground"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-foreground">{student.name}</div>
                  <div className="text-xs text-muted-foreground">Section {student.section}</div>
                </div>
                <div className="w-24 bg-muted rounded-full h-2 mr-2 hidden sm:block">
                  <div
                    className={`h-2 rounded-full ${percentage >= 75 ? 'bg-success' : percentage >= 50 ? 'bg-warning' : 'bg-destructive'}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className={`text-sm font-semibold ${percentage >= 75 ? 'text-success' : percentage >= 50 ? 'text-warning' : 'text-destructive'}`}>
                  {percentage}%
                </span>
              </button>
            );
          })}
          {rankedStudents.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No students match your search.</p>
          )}
        </div>
      </div>
    </>
  );
};

interface TeacherCompareTabProps {
  classStudents: Student[];
}

const TeacherCompareTab = ({ classStudents }: TeacherCompareTabProps) => {
  const [compareStudent, setCompareStudent] = useState<Student | null>(null);

  useEffect(() => {
    if (classStudents.length === 0) {
      setCompareStudent(null);
      return;
    }

    setCompareStudent((current) => {
      if (current && classStudents.some(student => student.id === current.id)) {
        return current;
      }
      return classStudents[0];
    });
  }, [classStudents]);

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="font-display font-semibold text-foreground mb-3">Select Student to Analyse</h3>
        {classStudents.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {classStudents.map(student => (
              <button
                key={student.id}
                onClick={() => setCompareStudent(student)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${compareStudent?.id === student.id ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}
              >
                {student.name}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No students available for comparison.</p>
        )}
      </div>

      {compareStudent && <PeerComparison student={compareStudent} viewerRole="teacher" />}
    </div>
  );
};

const TeacherUploadTab = () => (
  <div className="space-y-6">
    <FileUpload initialType="marks" />
    <FileUpload initialType="attendance" />
  </div>
);

const TeacherDashboard = () => {
  const { role: userRole, classId: authClassId, user } = useAuth();
  const {
    students,
    marks,
    attendance,
    loading,
    globalFilterSearch: studentSearch,
    setGlobalFilterSearch: setStudentSearch,
    classes,
    subjects: allSubjects,
  } = useStore();

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [activeTab, setActiveTab] = useState<TeacherTab>('overview');

  const sortedClasses = useMemo(
    () => (classes ? [...classes].sort((left, right) => left.order - right.order) : []),
    [classes],
  );

  const teacherClass = useMemo(
    () => authClassId || (sortedClasses.length > 0 ? sortedClasses[0].classId : ''),
    [authClassId, sortedClasses],
  );

  const teacherClassName = useMemo(
    () => sortedClasses.find(classConfig => classConfig.classId === teacherClass)?.name || teacherClass,
    [sortedClasses, teacherClass],
  );

  const classStudents = useMemo(
    () => (students || []).filter(student => student.classId === teacherClass),
    [students, teacherClass],
  );

  const classStudentIds = useMemo(
    () => new Set(classStudents.map(student => student.id)),
    [classStudents],
  );

  const classMarks = useMemo(
    () => (marks || []).filter(mark => classStudentIds.has(mark.studentId)),
    [marks, classStudentIds],
  );

  const subjects = useMemo(() => {
    return getAvailableSubjectsForMarks(classMarks, allSubjects, teacherClass);
  }, [classMarks, allSubjects, teacherClass]);

  useEffect(() => {
    if (userRole && !canViewTab(userRole, activeTab)) {
      setActiveTab('overview');
    }
  }, [userRole, activeTab]);

  useEffect(() => {
    if (selectedStudent && !classStudents.some(student => student.id === selectedStudent.id)) {
      setSelectedStudent(null);
    }
  }, [selectedStudent, classStudents]);

  const teacherTabs: { id: TeacherTab; label: string; icon: React.ReactNode }[] = useMemo(() => {
    const tabs: { id: TeacherTab; label: string; icon: React.ReactNode }[] = [
      { id: 'overview', label: 'Class Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
      { id: 'console', label: 'Class Console', icon: <Users className="w-4 h-4" /> },
      { id: 'forms', label: 'Data Entry', icon: <ClipboardList className="w-4 h-4" /> },
      { id: 'upload', label: 'Upload Sheets', icon: <Upload className="w-4 h-4" /> },
      { id: 'search', label: 'Student Search', icon: <Search className="w-4 h-4" /> },
      { id: 'compare', label: 'Compare & Analyse', icon: <BarChart3 className="w-4 h-4" /> },
      { id: 'bus', label: 'Bus Info', icon: <Bus className="w-4 h-4" /> },
    ];

    return filterTabs(userRole || 'teacher', tabs);
  }, [userRole]);

  const dashboardTitle = teacherClass ? `${formatClassName(teacherClassName || teacherClass)} Dashboard` : 'Teacher Dashboard';

  if (loading.students || loading.marks || loading.subjects) {
    return (
      <AppLayout title={dashboardTitle}>
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="text-muted-foreground font-medium">Synchronizing class data...</p>
        </div>
      </AppLayout>
    );
  }

  if (selectedStudent) {
    return (
      <ProfileErrorBoundary onReset={() => setSelectedStudent(null)}>
        <AppLayout title="Student Profile">
          <StudentProfile student={selectedStudent} onBack={() => setSelectedStudent(null)} />
        </AppLayout>
      </ProfileErrorBoundary>
    );
  }

  return (
    <AppLayout title={dashboardTitle}>
      {/* Teacher profile header */}
      <div className="flex items-center gap-4 mb-6 p-4 bg-card border border-border rounded-2xl">
        <ProfilePhotoWidget
          name={user?.name || 'Teacher'}
          photoURL={user?.photoURL || ''}
          size="w-14 h-14"
          editable
        />
        <div className="flex-1 min-w-0">
          <p className="font-display font-bold text-foreground truncate">{user?.name || 'Teacher'}</p>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            {teacherClassName ? `Class ${teacherClassName}` : 'Teacher'} &bull; {classStudents.length} students
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {teacherTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === tab.id ? 'bg-primary text-primary-foreground shadow-md' : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/30'}`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <TeacherOverviewTab
          teacherClass={teacherClass}
          classStudents={classStudents}
          students={students}
          marks={marks}
          attendance={attendance}
          subjects={subjects}
          studentSearch={studentSearch}
          setStudentSearch={setStudentSearch}
          onSelectStudent={setSelectedStudent}
        />
      )}
      {activeTab === 'console' && <ClassConsole />}
      {activeTab === 'forms' && <DataEntryForms />}
      {activeTab === 'search' && <StudentSearch />}
      {activeTab === 'compare' && <TeacherCompareTab classStudents={classStudents} />}
      {activeTab === 'bus' && <BusManagement />}
      {activeTab === 'upload' && <TeacherUploadTab />}
    </AppLayout>
  );
};

export default TeacherDashboard;

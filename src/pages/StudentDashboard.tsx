import { useState, useMemo } from 'react';
import AppLayout from '@/components/AppLayout';
import StatCard from '@/components/StatCard';
import PeerComparison from '@/components/PeerComparison';
import PerformanceChart from '@/components/PerformanceChart';
import BusManagement from '@/components/BusManagement';
import FeedbackList from '@/components/FeedbackList';
import { useAuth } from '@/contexts/AuthContext';
import { useStore } from '@/store/useStore';
import {
  getOverallPercentage,
  getAttendancePercentage,
  getStudentMarks,
  getClassRanking,
  generateAISummary,
  getSubjectAverage,
} from '@/lib/data-utils';
import useStudentFeedback from '@/hooks/useStudentFeedback';
import { Student } from '@/lib/types';
import { TrendingUp, Calendar, Award, MessageSquare, Sparkles, BarChart3, BookOpen, Bus, Search, Loader2 } from 'lucide-react';

type StudentTab = 'overview' | 'compare' | 'bus';

const StudentDashboard = () => {
  const { schoolId, studentId } = useAuth();
  const { students, marks, attendance, fees, busRoutes, loading, subjects: allSubjects } = useStore();
  const [activeTab, setActiveTab] = useState<StudentTab>('overview');
  const [feedbackSearch, setFeedbackSearch] = useState('');
  const [subjectSearch, setSubjectSearch] = useState('');

  const student = students.find(s => s.id === studentId);
  const subjects = useMemo(() => {
    if (!student || allSubjects.length === 0) return ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English'];
    return allSubjects.filter(sub => !sub.classIds || sub.classIds.length === 0 || sub.classIds.includes(student.classId)).map(s => s.name);
  }, [student, allSubjects]);
  const { feedback } = useStudentFeedback({
    schoolId,
    studentId: student?.id,
    publishedOnly: true,
  });

  if (loading.students || loading.marks) {
    return (
      <AppLayout title="Student Dashboard">
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="text-muted-foreground font-medium">Loading your profile data...</p>
        </div>
      </AppLayout>
    );
  }

  if (!student) {
    return <AppLayout title="Student Dashboard"><p className="text-muted-foreground">No student linked to this account.</p></AppLayout>;
  }

  const studentMarks = getStudentMarks(student.id, marks);
  const overallPct = getOverallPercentage(student.id, marks);
  const attendancePct = getAttendancePercentage(student.id, attendance);
  const ranking = getClassRanking(student.id, students, marks);
  const summaries = generateAISummary(student.id, students, marks, attendance, subjects);

  const filteredFeedback = feedback.filter(f =>
    (f.teacherName || "").toLowerCase().includes(feedbackSearch.toLowerCase()) ||
    (f.feedbackText || f.remark || "").toLowerCase().includes(feedbackSearch.toLowerCase())
  );

  const subjectPerformance = subjects.map(sub => ({
    subject: sub,
    average: getSubjectAverage(student.id, sub, marks),
  })).filter(s =>
    (s.subject || "").toLowerCase().includes(subjectSearch.toLowerCase())
  );

  const tabs: { id: StudentTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'My Overview', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'compare', label: 'Compare & Rank', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'bus', label: 'My Bus', icon: <Bus className="w-4 h-4" /> },
  ];

  return (
    <AppLayout title={`Welcome, ${student.name.split(' ')[0]}`}>
      <div className="flex gap-2 mb-6">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === tab.id ? 'bg-primary text-primary-foreground shadow-md' : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/30'
              }`}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'bus' && <BusManagement studentId={student.id} />}
      {activeTab === 'compare' && <PeerComparison student={student} viewerRole="student" />}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Overall" value={`${overallPct}%`} icon={TrendingUp} variant={overallPct >= 75 ? 'success' : overallPct >= 50 ? 'warning' : 'destructive'} />
            <StatCard label="Attendance" value={`${attendancePct}%`} icon={Calendar} variant={attendancePct >= 85 ? 'success' : 'warning'} />
            <StatCard label={`${ranking.scope} Rank`} value={`#${ranking.rank}`} icon={Award} trend={`of ${ranking.total} (${ranking.scope})`} />
          </div>

          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="font-display font-semibold text-foreground mb-3">Your Rankings</h3>
            <div className="grid grid-cols-1 gap-3">
              <div className="text-center p-3 bg-primary/5 rounded-lg border border-primary/10">
                <div className="text-2xl font-bold text-primary">#{ranking.rank}</div>
                <div className="text-xs text-muted-foreground">{ranking.scope} Standing ({ranking.total} students)</div>
              </div>
            </div>
          </div>

          {/* Subject Performance with Search */}
          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-foreground flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-muted-foreground" /> Subject Performance
              </h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="text" placeholder="Search subjects..." value={subjectSearch} onChange={e => setSubjectSearch(e.target.value)}
                  className="pl-9 pr-4 py-2 text-sm bg-muted/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring w-44" />
              </div>
            </div>
            <div className="space-y-2">
              {subjectPerformance.map(sp => (
                <div key={sp.subject} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <span className="text-sm font-medium text-foreground">{sp.subject}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-32 bg-muted rounded-full h-2 hidden sm:block">
                      <div className={`h-2 rounded-full ${sp.average >= 75 ? 'bg-success' : sp.average >= 50 ? 'bg-warning' : 'bg-destructive'}`} style={{ width: `${sp.average}%` }} />
                    </div>
                    <span className={`text-sm font-semibold w-10 text-right ${sp.average >= 75 ? 'text-success' : sp.average >= 50 ? 'text-warning' : 'text-destructive'}`}>{sp.average}%</span>
                  </div>
                </div>
              ))}
              {subjectPerformance.length === 0 && <p className="text-sm text-muted-foreground text-center py-3">No subjects match your search.</p>}
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-secondary" />
              <h3 className="font-display font-semibold text-foreground">AI Insights</h3>
            </div>
            <div className="space-y-2">
              {summaries.map((s, i) => (
                <p key={i} className="text-sm text-muted-foreground bg-muted/50 rounded-lg px-4 py-2.5">{s}</p>
              ))}
            </div>
          </div>

          <PerformanceChart student={student} marks={studentMarks} />

          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-muted-foreground" />
                <h3 className="font-display font-semibold text-foreground">Teacher Feedback</h3>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="text" placeholder="Search feedback..." value={feedbackSearch} onChange={e => setFeedbackSearch(e.target.value)}
                  className="pl-9 pr-4 py-2 text-sm bg-muted/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring w-44" />
              </div>
            </div>
            <FeedbackList
              feedback={filteredFeedback}
              emptyMessage={feedbackSearch ? 'No feedback matches your search.' : 'No feedback yet.'}
            />
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default StudentDashboard;

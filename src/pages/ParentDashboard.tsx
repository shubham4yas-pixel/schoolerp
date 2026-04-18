import { useState, useMemo } from 'react';
import AppLayout from '@/components/AppLayout';
import StudentProfile from '@/components/StudentProfile';
import ProfileErrorBoundary from '@/components/ProfileErrorBoundary';
import PeerComparison from '@/components/PeerComparison';
import BusManagement from '@/components/BusManagement';
import FeedbackList from '@/components/FeedbackList';
import ProfilePhotoWidget from '@/components/ProfilePhotoWidget';
import { useAuth } from '@/contexts/AuthContext';
import { useStore } from '@/store/useStore';
import {
  getStudentMarks,
  getSubjectAverage,
  getOverallPercentage,
  getAttendancePercentage,
  getClassRanking
} from '@/lib/data-utils';
import useStudentFeedback from '@/hooks/useStudentFeedback';
import { Student } from '@/lib/types';
import { BookOpen, BarChart3, Bus, Search, MessageSquare, TrendingUp, Calendar, Award, Loader2 } from 'lucide-react';

type ParentTab = 'progress' | 'compare' | 'bus' | 'feedback';

const ParentDashboard = () => {
  const { schoolId, parentStudentId, user } = useAuth();

  const { students, marks, attendance, loading, subjects: allSubjects } = useStore();
  const [activeTab, setActiveTab] = useState<ParentTab>('progress');
  const [feedbackSearch, setFeedbackSearch] = useState('');
  const [subjectSearch, setSubjectSearch] = useState('');

  const student = students.find(s => s.id === parentStudentId);
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
      <AppLayout title="Parent Dashboard">
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="text-muted-foreground font-medium">Loading child's progress data...</p>
        </div>
      </AppLayout>
    );
  }

  if (!student) {
    return <AppLayout title="Parent Dashboard"><p className="text-muted-foreground">No student linked to this account.</p></AppLayout>;
  }

  // Parents only see published marks
  const publishedMarks = marks.filter(m => m.isPublished);

  const overallPct = getOverallPercentage(student.id, publishedMarks);
  const attPct = getAttendancePercentage(student.id, attendance);
  const classRank = getClassRanking(student.id, students, publishedMarks);

  const subjectPerformance = subjects.map(sub => ({
    subject: sub,
    average: getSubjectAverage(student.id, sub, publishedMarks),
  })).filter(s => s.subject.toLowerCase().includes(subjectSearch.toLowerCase()));

  const filteredFeedback = feedback.filter(f =>
    (f.teacherName || "").toLowerCase().includes(feedbackSearch.toLowerCase()) ||
    (f.feedbackText || f.remark || "").toLowerCase().includes(feedbackSearch.toLowerCase())
  );

  const tabs: { id: ParentTab; label: string; icon: React.ReactNode }[] = [
    { id: 'progress', label: 'Progress', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'feedback', label: 'Feedback', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'compare', label: 'Compare & Rank', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'bus', label: 'Bus Info', icon: <Bus className="w-4 h-4" /> },
  ];

  return (
    <AppLayout title={`${student.name}'s Progress`}>
      {/* Parent profile header */}
      <div className="flex items-center gap-4 mb-6 p-4 bg-card border border-border rounded-2xl">
        <ProfilePhotoWidget
          name={user?.name || 'Parent'}
          photoURL={user?.photoURL || ''}
          size="w-14 h-14"
          editable
        />
        <div className="flex-1 min-w-0">
          <p className="font-display font-bold text-foreground truncate">{user?.name || 'Parent'}</p>
          <p className="text-xs text-muted-foreground font-medium">
            Viewing progress for <span className="font-semibold text-primary">{student.name}</span>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === tab.id ? 'bg-primary text-primary-foreground shadow-md' : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/30'
              }`}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'progress' && (
        <ProfileErrorBoundary onReset={() => { }}>
          <StudentProfile student={student} onBack={() => { }} simplified onFeedbackClick={() => setActiveTab('feedback')} />
        </ProfileErrorBoundary>
      )}
      {activeTab === 'compare' && <PeerComparison student={student} viewerRole="parent" />}
      {activeTab === 'bus' && <BusManagement studentId={student.id} />}

      {activeTab === 'feedback' && (
        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-card rounded-xl border border-border p-4 text-center">
              <TrendingUp className="w-5 h-5 text-success mx-auto mb-1" />
              <div className={`text-xl font-bold ${overallPct >= 75 ? 'text-success' : 'text-warning'}`}>{overallPct}%</div>
              <div className="text-xs text-muted-foreground">Overall</div>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 text-center">
              <Calendar className="w-5 h-5 text-primary mx-auto mb-1" />
              <div className={`text-xl font-bold ${attPct >= 85 ? 'text-success' : 'text-warning'}`}>{attPct}%</div>
              <div className="text-xs text-muted-foreground">Attendance</div>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 text-center">
              <Award className="w-5 h-5 text-secondary mx-auto mb-1" />
              <div className="text-xl font-bold text-primary">#{classRank.rank}</div>
              <div className="text-[10px] uppercase font-bold text-muted-foreground">{classRank.scope} Rank</div>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 text-center">
              <MessageSquare className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
              <div className="text-xl font-bold text-foreground">{feedback.length}</div>
              <div className="text-xs text-muted-foreground">Feedback</div>
            </div>
          </div>

          {/* Subject Performance with Search */}
          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-foreground flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-muted-foreground" /> Subject-wise Performance
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
            </div>
          </div>

          {/* Feedback with Search */}
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
            <div className="space-y-3">
              <FeedbackList
                feedback={filteredFeedback}
                emptyMessage={feedbackSearch ? 'No feedback matches your search.' : 'No feedback yet.'}
              />
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default ParentDashboard;

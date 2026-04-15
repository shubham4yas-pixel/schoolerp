import React, { useState, useMemo, useEffect } from 'react';
import { Student, Mark, ComparisonScope } from '@/lib/types';
import { useStore } from '@/store/useStore';
import {
  getSubjectAverage,
  getOverallPercentage,
  getEndTermPercentage,
  getClassAverage,
  getAvailableSubjectsForMarks,
} from '@/lib/data-utils';
import { Users, School, Globe, UserCheck, Search, BookOpen, Trophy, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import ComparisonChart from '@/components/ComparisonChart';
import EndTermResults from '@/components/EndTermResults';
import SubjectStrengthCard from '@/components/SubjectStrengthCard';
import StudentAvatar from '@/components/StudentAvatar';



interface PeerComparisonProps {
  student: Student;
  viewerRole?: 'student' | 'parent' | 'teacher' | 'admin';
}

const scopes: { value: ComparisonScope; label: string; icon: React.ReactNode }[] = [
  { value: 'class', label: 'Class average', icon: <School className="w-4 h-4" /> },
  { value: 'one-to-one', label: '1 vs 1 Peer', icon: <UserCheck className="w-4 h-4" /> },
];

const tabs = [
  { id: 'compare' as const, label: 'Compare', icon: <BookOpen className="w-4 h-4" /> },
  { id: 'endterm' as const, label: 'End-Term', icon: <Trophy className="w-4 h-4" /> },
  { id: 'strengths' as const, label: 'Strengths & Weaknesses', icon: <TrendingUp className="w-4 h-4" /> },
];

const PeerComparison = ({ student, viewerRole = 'student' }: PeerComparisonProps) => {
  const { students, marks, loading, subjects: allSubjects } = useStore();
  const [scope, setScope] = useState<ComparisonScope>('class');
  const [compareStudentId, setCompareStudentId] = useState<string>('');
  const [peerSearch, setPeerSearch] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'compare' | 'endterm' | 'strengths'>('compare');

  const sameClassPeers = useMemo(() => {
    if (!students || !student) return [];
    return students.filter(s => s.classId === student.classId && s.id !== student.id);
  }, [students, student?.id, student?.classId]);

  const comparisonStudentIds = useMemo(
    () => new Set([student?.id, ...sameClassPeers.map(peer => peer.id)].filter(Boolean) as string[]),
    [student?.id, sameClassPeers],
  );

  const subjects = useMemo(() => {
    const comparisonMarks = (marks || []).filter(mark => comparisonStudentIds.has(mark.studentId));
    return getAvailableSubjectsForMarks(comparisonMarks, allSubjects, student?.classId);
  }, [marks, comparisonStudentIds, allSubjects, student?.classId]);

  const [isDataTimeout, setIsDataTimeout] = useState(false);

  // Safety timeout for loading state
  useEffect(() => {
    if (loading.students) {
      const timer = setTimeout(() => setIsDataTimeout(true), 5000);
      return () => clearTimeout(timer);
    }
  }, [loading.students]);

  // Only same-class students for 1v1
  const filteredPeers = useMemo(() => {
    if (!peerSearch) return sameClassPeers;
    return sameClassPeers.filter(s =>
      s.name.toLowerCase().includes(peerSearch.toLowerCase())
    );
  }, [sameClassPeers, peerSearch]);

  if (loading.students && !isDataTimeout) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-muted-foreground text-sm font-medium">Initializing comparison data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex gap-2 flex-wrap">
        {(tabs || []).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === tab.id
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/30'
              }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'compare' && (
        <>
          {/* Scope Selector */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="font-display font-semibold text-foreground mb-4">Compare Performance</h3>

            {/* Subject filter */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <span className="text-sm text-muted-foreground font-medium">Subject:</span>
              {['all', ...subjects].map(sub => (
                <button
                  key={sub}
                  onClick={() => setSelectedSubject(sub)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selectedSubject === sub
                    ? 'bg-secondary text-secondary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                    }`}
                >
                  {sub === 'all' ? 'All Subjects' : sub}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {scopes.map(s => (
                <button
                  key={s.value}
                  onClick={() => { setScope(s.value); }}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all duration-200 ${scope === s.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card text-muted-foreground hover:border-primary/30'
                    }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${scope === s.value ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    }`}>
                    {s.icon}
                  </div>
                  <span className="text-xs font-semibold">{s.label}</span>
                </button>
              ))}
            </div>

            {/* Peer selector for 1v1 with search */}
            {scope === 'one-to-one' && (
              <div className="mt-4">
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search student by name..."
                    value={peerSearch}
                    onChange={e => setPeerSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-3 bg-muted/50 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto bg-card border border-border rounded-xl">
                  {filteredPeers.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-muted-foreground">No students found in Class {student.classId}</div>
                  ) : (
                    (filteredPeers || []).map(p => (
                      <button
                        key={p.id}
                        onClick={() => { setCompareStudentId(p.id); setPeerSearch(''); }}
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors flex items-center justify-between ${p.id === compareStudentId ? 'bg-primary/10 text-primary' : 'text-foreground'
                          }`}
                      >
                        <span>{p.name}</span>
                        <span className="text-xs text-muted-foreground">Section {p.section}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Chart */}
          <ComparisonChart
            student={student}
            scope={scope}
            compareStudentId={compareStudentId}
            selectedSubject={selectedSubject}
          />

          {/* Rankings (only for non-1v1) */}
          {scope !== 'one-to-one' && (
            <RankingsTable student={student} scope="class" students={students} marks={marks} />
          )}
        </>
      )}

      {activeTab === 'endterm' && (
        <EndTermResults student={student} />
      )}

      {activeTab === 'strengths' && (
        <SubjectStrengthCard student={student} viewerRole={viewerRole} />
      )}
    </div>
  );
};

// Rankings sub-component
function RankingsTable({ student, scope, students, marks }: { student: Student; scope: 'class'; students: Student[]; marks: Mark[] }) {
  const pool = students.filter(s => s.classId === student.classId);

  const rankings = pool
    .map(s => ({ ...s, pct: getOverallPercentage(s.id, marks) }))
    .sort((a, b) => b.pct - a.pct);

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <h3 className="font-display font-semibold text-foreground mb-4">
        Class {student.classId} Rankings
      </h3>
      <div className="space-y-1.5">
        {(rankings || []).map((s, i) => {
          const isMe = s.id === student?.id;
          return (
            <div
              key={s.id}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isMe ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted/30'
                }`}
            >
              <span className={`text-sm font-bold w-7 ${isMe ? 'text-primary' : 'text-muted-foreground'}`}>#{i + 1}</span>
              <StudentAvatar
                student={s}
                className="w-7 h-7 rounded-lg"
                initialsClassName="text-xs font-bold text-primary-foreground"
              />
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium truncate ${isMe ? 'text-primary' : 'text-foreground'}`}>
                  {s.name} {isMe && <span className="text-xs">(You)</span>}
                </div>
                <div className="text-xs text-muted-foreground">Section {s.section}</div>
              </div>
              <div className="w-20 bg-muted rounded-full h-1.5 hidden sm:block">
                <div className={`h-1.5 rounded-full ${s.pct >= 75 ? 'bg-success' : s.pct >= 50 ? 'bg-warning' : 'bg-destructive'}`} style={{ width: `${s.pct}%` }} />
              </div>
              <span className={`text-sm font-semibold ${isMe ? 'text-primary' : s.pct >= 75 ? 'text-success' : s.pct >= 50 ? 'text-warning' : 'text-destructive'}`}>
                {s.pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Historical comparison sub-component
function HistoricalComparison({ student, students, marks }: { student: Student; students: Student[]; marks: Mark[] }) {
  const historicalSubjects = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English'];
  const history: any[] = []; // Historical data not in store yet
  const currentSubjectAvgs = historicalSubjects.reduce((acc, sub) => {
    acc[sub] = getClassAverage(student.classId, sub, students, marks);
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <h3 className="font-display font-semibold text-foreground mb-4">Historical Batch Comparison — Class {student.classId}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 text-muted-foreground font-medium">Year</th>
              {historicalSubjects.map(sub => (
                <th key={sub} className="text-right py-2 text-muted-foreground font-medium">{sub.slice(0, 4)}</th>
              ))}
              <th className="text-right py-2 text-muted-foreground font-medium">Overall</th>
            </tr>
          </thead>
          <tbody>
            {history.map(batch => (
              <tr key={batch.year} className="border-b border-border/50">
                <td className="py-2.5 text-foreground font-medium">{batch.year}</td>
                {historicalSubjects.map(sub => (
                  <td key={sub} className="py-2.5 text-right text-muted-foreground">{batch.subjectAverages[sub]}%</td>
                ))}
                <td className="py-2.5 text-right font-semibold text-foreground">{batch.overallAverage}%</td>
              </tr>
            ))}
            <tr className="bg-primary/5">
              <td className="py-2.5 text-primary font-semibold">Current</td>
              {historicalSubjects.map(sub => (
                <td key={sub} className="py-2.5 text-right text-primary font-medium">{currentSubjectAvgs[sub]}%</td>
              ))}
              <td className="py-2.5 text-right font-bold text-primary">
                {Math.round(Object.values(currentSubjectAvgs).reduce((a, b) => a + b, 0) / historicalSubjects.length)}%
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default PeerComparison;

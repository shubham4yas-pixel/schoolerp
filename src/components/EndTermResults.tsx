import { useState, useMemo } from 'react';
import { Student } from '@/lib/types';
import { useStore } from '@/store/useStore';
import {
  getSubjectExamScore,
  getEndTermPercentage,
  formatClassName,
} from '@/lib/data-utils';
import StudentAvatar from '@/components/StudentAvatar';
import { Trophy, Medal, Loader2 } from 'lucide-react';

interface Props {
  student: Student;
}

const EndTermResults = ({ student }: Props) => {
  const { students, marks, loading, subjects: allSubjects, exams } = useStore();
  const [rankScope, setRankScope] = useState<'section' | 'class'>('section');
  const subjects = useMemo(() => {
    if (!student || allSubjects.length === 0) return ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English'];
    return allSubjects.filter(sub => !sub.classIds || sub.classIds.length === 0 || sub.classIds.includes(student.classId)).map(s => s.name);
  }, [student, allSubjects]);

  const finalExam = useMemo(() => {
    if (!exams || exams.length === 0) return null;
    return exams.find(e => e.name.toLowerCase().includes('final') || e.name.toLowerCase().includes('annual')) || exams[exams.length - 1];
  }, [exams]);
  const finalExamId = finalExam?.id || 'Final';
  const finalExamName = finalExam?.name || 'Final';

  const endTermPct = useMemo(() => {
    if (!student?.id || !marks) return 0;
    const finals = marks.filter(m => m.studentId === student.id && (m.examType === finalExamName as any || m.examType === 'Final' as any));
    if (finals.length === 0) return 0;
    return Math.round(finals.reduce((sum, m) => sum + (m.marksObtained / m.totalMarks) * 100, 0) / finals.length);
  }, [student?.id, marks, finalExamName]);

  if (loading.marks) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const subjectScores = subjects.map(sub => ({
    subject: sub,
    score: getSubjectExamScore(student.id, sub, finalExamName as any, marks) || getSubjectExamScore(student.id, sub, 'Final' as any, marks),
  }));

  const pool = rankScope === 'section'
    ? students.filter(s => (s.classId || "") === student.classId && (s.section || "") === student.section)
    : students.filter(s => s.classId === student.classId);

  // Re-implementing EndTermRanking logic dynamically
  const rankings = (pool || [])
    .map(s => {
      const finals = (marks || []).filter(m => m.studentId === s.id && (m.examType === finalExamName as any || m.examType === 'Final' as any));
      const pct = finals.length === 0 ? 0 : Math.round(finals.reduce((sum, m) => sum + (m.marksObtained / m.totalMarks) * 100, 0) / finals.length);
      return { ...s, pct };
    })
    .sort((a, b) => b.pct - a.pct);

  const myRank = rankings.findIndex(r => r.id === student.id) + 1;

  return (
    <div className="space-y-6">
      {/* End-Term Score Card */}
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-secondary" />
            <h3 className="font-display font-semibold text-foreground">{finalExamName} Examination Results</h3>
          </div>
          {student.results?.[finalExamId]?.isPublished ? (
            <span className="px-2 py-0.5 bg-success/10 text-success rounded-full text-[10px] font-black uppercase tracking-widest border border-success/20">Published</span>
          ) : (
            <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded-full text-[10px] font-black uppercase tracking-widest border border-border/50">Draft</span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center col-span-2 sm:col-span-1">
            <div className="text-3xl font-bold text-primary">{endTermPct}%</div>
            <div className="text-xs text-muted-foreground mt-1">Overall End-Term</div>
          </div>
          <div className="bg-muted/30 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-foreground">#{myRank}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {rankScope === 'section' ? `Section ${student.section}` : `${formatClassName(student.classId)}`} Rank
            </div>
          </div>
          <div className="bg-muted/30 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-foreground">{rankings.length}</div>
            <div className="text-xs text-muted-foreground mt-1">Total Students</div>
          </div>
        </div>

        {/* Subject-wise scores */}
        <div className="space-y-2">
          {subjectScores.map(s => (
            <div key={s.subject} className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground w-24">{s.subject}</span>
              <div className="flex-1 bg-muted rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${s.score >= 75 ? 'bg-success' : s.score >= 50 ? 'bg-warning' : 'bg-destructive'
                    }`}
                  style={{ width: `${s.score}%` }}
                />
              </div>
              <span className={`text-sm font-semibold w-12 text-right ${s.score >= 75 ? 'text-success' : s.score >= 50 ? 'text-warning' : 'text-destructive'
                }`}>{s.score}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* End-Term Rankings */}
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Medal className="w-5 h-5 text-muted-foreground" />
            <h3 className="font-display font-semibold text-foreground">{finalExamName} Rankings</h3>
          </div>
          <div className="flex gap-1">
            {(['section', 'class'] as const).map(s => (
              <button
                key={s}
                onClick={() => setRankScope(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${rankScope === s
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
              >
                {s === 'section' ? `Section ${student.section}` : `${formatClassName(student.classId)}`}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          {rankings.map((s, i) => {
            const isMe = s.id === student.id;
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
                </div>
                <span className={`text-sm font-semibold ${isMe ? 'text-primary' : s.pct >= 75 ? 'text-success' : s.pct >= 50 ? 'text-warning' : 'text-destructive'}`}>
                  {s.pct}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default EndTermResults;

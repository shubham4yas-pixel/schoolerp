import React, { useMemo } from 'react';
import { Student } from '@/lib/types';
import { useStore } from '@/store/useStore';
import { getSubjectAnalysis } from '@/lib/data-utils';
import { TrendingUp, TrendingDown, Sparkles, Target, AlertTriangle, Loader2 } from 'lucide-react';

interface Props {
  student: Student;
  viewerRole: 'student' | 'parent' | 'teacher' | 'admin';
}

const SubjectStrengthCard = ({ student, viewerRole }: Props) => {
  const { students, marks, loading, subjects: allSubjects } = useStore();
  const subjects = React.useMemo(() => {
    if (!student || !allSubjects) return ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English'];
    return allSubjects.filter(sub => !sub.classIds || sub.classIds.length === 0 || sub.classIds.includes(student.classId)).map(s => s.name);
  }, [student, allSubjects]);

  if (loading.marks) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const analysis = student?.id ? getSubjectAnalysis(student.id, marks || [], subjects) : { strong: [], weak: [], improving: [], declining: [], scores: [] };
  const recommendations: string[] = []; // Recommendations not yet in store/utils

  const cardClasses = "rounded-2xl p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-hover";

  return (
    <div className="space-y-6">
      {/* Strength / Weakness overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Strong subjects */}
        <div className={`bg-success/5 border border-success/20 ${cardClasses}`}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-success/20 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-success" />
            </div>
            <h3 className="font-display font-bold text-foreground tracking-tight">Strong Subjects</h3>
          </div>
          {analysis.strong.length > 0 ? (
            <div className="space-y-3">
              {(analysis?.strong || []).map(s => (
                <div key={s.subject} className="flex items-center justify-between bg-card rounded-xl px-4 py-3 border border-border/50">
                  <span className="text-sm text-foreground font-semibold">{s.subject}</span>
                  <span className="text-sm font-bold text-success">{s.average}%</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm font-medium text-muted-foreground">No subjects above 75% threshold yet.</p>
          )}
        </div>

        {/* Weak subjects */}
        <div className={`bg-destructive/5 border border-destructive/20 ${cardClasses}`}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-destructive/20 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-destructive" />
            </div>
            <h3 className="font-display font-bold text-foreground tracking-tight">Needs Improvement</h3>
          </div>
          {analysis.weak.length > 0 ? (
            <div className="space-y-3">
              {(analysis?.weak || []).map(s => (
                <div key={s.subject} className="flex items-center justify-between bg-card rounded-xl px-4 py-3 border border-border/50">
                  <span className="text-sm text-foreground font-semibold">{s.subject}</span>
                  <span className="text-sm font-bold text-destructive">{s.average}%</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm font-medium text-muted-foreground">No weak areas detected — well done!</p>
          )}
        </div>
      </div>

      {/* Trends */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {analysis.improving.length > 0 && (
          <div className={`bg-card border border-border ${cardClasses}`}>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-5 h-5 text-success" />
              <h3 className="font-display font-bold text-foreground tracking-tight">Improving</h3>
            </div>
            <div className="space-y-2">
              {(analysis?.improving || []).map(s => (
                <div key={s.subject} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{s.subject}</span>
                  <span className="text-xs font-bold text-success">{s.periodic}% → {s.endTerm}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {analysis.declining.length > 0 && (
          <div className={`bg-card border border-border ${cardClasses}`}>
            <div className="flex items-center gap-2 mb-3">
              <TrendingDown className="w-5 h-5 text-destructive" />
              <h3 className="font-display font-bold text-foreground tracking-tight">Declining</h3>
            </div>
            <div className="space-y-2">
              {(analysis?.declining || []).map(s => (
                <div key={s.subject} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{s.subject}</span>
                  <span className="text-xs font-bold text-destructive">{s.periodic}% → {s.endTerm}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Subject detail table */}
      <div className={`bg-card border border-border ${cardClasses}`}>
        <div className="flex items-center gap-2 mb-5">
          <Target className="w-5 h-5 text-primary" />
          <h3 className="font-display font-bold text-foreground tracking-tight">Detailed Subject Analysis</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 text-muted-foreground font-semibold">Subject</th>
                <th className="text-right py-3 text-muted-foreground font-semibold">Periodic</th>
                <th className="text-right py-3 text-muted-foreground font-semibold">Midterm</th>
                <th className="text-right py-3 text-muted-foreground font-semibold">Final</th>
                <th className="text-right py-3 text-muted-foreground font-semibold">Average</th>
              </tr>
            </thead>
            <tbody>
              {(analysis?.scores || []).map(s => (
                <tr key={s.subject} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="py-3 text-foreground font-semibold">{s.subject}</td>
                  <td className="py-3 text-right font-medium text-muted-foreground">{s.periodic}%</td>
                  <td className="py-3 text-right font-medium text-muted-foreground">{s.midterm}%</td>
                  <td className="py-3 text-right font-medium text-muted-foreground">{s.endTerm}%</td>
                  <td className={`py-3 text-right font-bold ${s.average >= 75 ? 'text-success' : s.average >= 50 ? 'text-warning' : 'text-destructive'
                    }`}>{s.average}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Recommendations */}
      <div className={`bg-card border border-border ${cardClasses}`}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <h3 className="font-display font-bold text-foreground tracking-tight">
            AI Recommendations {viewerRole !== 'student' && `(for ${viewerRole}s)`}
          </h3>
        </div>
        <div className="space-y-3">
          {recommendations.map((r, i) => (
            <p key={i} className="text-sm font-medium text-muted-foreground bg-secondary/50 rounded-xl px-5 py-3 border border-border/50">{r}</p>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SubjectStrengthCard;
import { Student, ComparisonScope } from '@/lib/types';
import { useStore } from '@/store/useStore';
import { getSubjectAverage, getClassAverage, getAvailableSubjectsForMarks } from '@/lib/data-utils';
import { ComposedChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList, Line, Legend } from 'recharts';

interface Props {
  student: Student;
  scope: ComparisonScope;
  compareStudentId: string;
  selectedSubject: string;
}

// Premium high-contrast palette
const STUDENT_PRIMARY = '#1a3366'; // Professional Navy — student
const COMPARISON_NEUTRAL = '#f6a823'; // Amber — comparison avg
const PEER_COLOR = '#f6a823';      // Amber — peer 1v1
const labelStyle = { fontSize: 10, fontWeight: 700, fill: 'hsl(var(--muted-foreground))' };

const ComparisonChart = ({ student, scope, compareStudentId, selectedSubject }: Props) => {
  const { students, marks, subjects: allSubjects, loading } = useStore();
  const isOneToOne = scope === 'one-to-one';
  const classStudentIds = new Set((students || []).filter(classStudent => classStudent.classId === student?.classId).map(classStudent => classStudent.id));
  const relevantMarks = (marks || []).filter(mark => classStudentIds.has(mark.studentId));
  const availableSubjects = getAvailableSubjectsForMarks(relevantMarks, allSubjects, student?.classId);
  const subjectList = selectedSubject === 'all'
    ? availableSubjects
    : availableSubjects.filter(subject => subject === selectedSubject);

  const getComparisonData = () => {
    return subjectList.map(sub => {
      const you = student?.id ? getSubjectAverage(student.id, sub, marks || []) : 0;

      // Calculate Section Avg
      const sectionPool = (students || []).filter(s => (s.classId || "") === student?.classId && (s.section || "") === student?.section);
      const sectionAvgs = sectionPool.map(s => getSubjectAverage(s.id, sub, marks || [])).filter(a => a > 0);
      const sectionAvg = sectionAvgs.length > 0 ? Math.round(sectionAvgs.reduce((s, a) => s + a, 0) / sectionAvgs.length) : 0;

      // Calculate Class Avg
      const classAvg = student?.classId ? getClassAverage(student.classId, sub, students || [], marks || []) : 0;

      // (Optional) Peer mapping
      let peer = 0;
      let peerName = 'Peer';
      if (isOneToOne && compareStudentId) {
        const pObj = students.find(s => s.id === compareStudentId);
        peer = getSubjectAverage(compareStudentId, sub, marks);
        peerName = pObj?.name?.split(' ')[0] || 'Peer';
      }

      return {
        subject: sub.length > 5 ? sub.slice(0, 4) : sub,
        fullSubject: sub,
        you,
        peer,
        peerName,
        sectionAvg,
        classAvg
      };
    });
  };

  if (isOneToOne && !compareStudentId) {
    return (
      <div className="bg-card rounded-xl border border-border p-8 text-center">
        <p className="text-muted-foreground">Select a student above to compare</p>
      </div>
    );
  }

  if (scope === 'school') return null;

  if (loading.students || loading.marks || loading.subjects) {
    return (
      <div className="bg-card rounded-xl border border-border p-12 text-center">
        <p className="text-muted-foreground font-medium">Loading...</p>
      </div>
    );
  }

  const data = getComparisonData();
  const hasData = data.some(d => d.you > 0 || d.peer > 0 || d.sectionAvg > 0 || d.classAvg > 0);

  if (!hasData) {
    return (
      <div className="bg-card rounded-xl border border-border p-12 text-center">
        <p className="text-muted-foreground font-medium italic">No performance data available for this selection</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <h3 className="font-display font-semibold text-foreground">
          Real-time Benchmarking ( {scope.toUpperCase()} )
        </h3>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] font-bold uppercase tracking-wider">
          <div className="flex items-center gap-1.5 min-w-[70px]">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STUDENT_PRIMARY }} />
            <span className="text-foreground">{(student?.name || 'Student').split(' ')[0]}</span>
          </div>

          {scope === 'class' && (
            <div className="flex items-center gap-1.5 min-w-[70px]">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COMPARISON_NEUTRAL }} />
              <span className="text-foreground">Class Average</span>
            </div>
          )}

          {isOneToOne && (
            <>
              <div className="flex items-center gap-1.5 min-w-[70px]">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PEER_COLOR }} />
                <span className="text-foreground">{data[0]?.peerName || 'Competitor'}</span>
              </div>
              <div className="flex items-center gap-1.5 min-w-[70px]">
                <div className="w-4 h-0.5 rounded-full" style={{ backgroundColor: '#ff4d4d' }} />
                <span className="text-foreground">Class Benchmark</span>
              </div>
            </>
          )}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} barGap={8} barCategoryGap="25%">
          <CartesianGrid strokeDasharray="4 4" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="subject" tick={{ fontSize: 11, fontWeight: 600 }} stroke="hsl(var(--muted-foreground))" axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" unit="%" axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: 600,
              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
            }}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.fullSubject || ''}
            formatter={(value: any, name: string) => [`${value}%`, name]}
          />

          <Bar dataKey="you" name={(student?.name || 'Student').split(' ')[0]} fill={STUDENT_PRIMARY} radius={[4, 4, 0, 0]} barSize={24}>
            <LabelList dataKey="you" position="top" style={labelStyle} formatter={(v: number) => v > 0 ? `${v}%` : ''} />
          </Bar>

          {scope === 'class' && (
            <Bar dataKey="classAvg" name="Class Average" fill={COMPARISON_NEUTRAL} radius={[4, 4, 0, 0]} barSize={24}>
              <LabelList dataKey="classAvg" position="top" style={labelStyle} formatter={(v: number) => v > 0 ? `${v}%` : ''} />
            </Bar>
          )}

          {isOneToOne && compareStudentId && (
            <>
              <Bar dataKey="peer" name={data[0]?.peerName || 'Peer'} fill={PEER_COLOR} radius={[4, 4, 0, 0]} barSize={24}>
                <LabelList dataKey="peer" position="top" style={labelStyle} formatter={(v: number) => v > 0 ? `${v}%` : ''} />
              </Bar>
              <Line type="monotone" dataKey="classAvg" stroke="#ff4d4d" strokeWidth={3} dot={{ r: 4, fill: '#ff4d4d' }} name="Class Benchmark" />
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ComparisonChart;

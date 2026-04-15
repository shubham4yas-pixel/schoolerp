import React from 'react';
import { Student, Mark } from '@/lib/types';
import { useStore } from '@/store/useStore';
import { getSubjectAverage, getClassAverage, getAvailableSubjectsForMarks, getAvailableExamTypesForMarks } from '@/lib/data-utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, LineChart, Line } from 'recharts';

interface PerformanceChartProps {
  student: Student;
  marks: Mark[];
}

const PerformanceChart = ({ student, marks: studentMarks }: PerformanceChartProps) => {
  const { students, marks: allMarks, loading, subjects: allSubjects, exams } = useStore();

  const classStudentIds = React.useMemo(
    () => new Set((students || []).filter(classStudent => classStudent.classId === student.classId).map(classStudent => classStudent.id)),
    [students, student.classId],
  );

  const availableSubjects = React.useMemo(
    () => getAvailableSubjectsForMarks(studentMarks, allSubjects, student.classId),
    [studentMarks, allSubjects, student.classId],
  );

  const availableExamTypes = React.useMemo(
    () => getAvailableExamTypesForMarks(studentMarks, exams),
    [studentMarks, exams],
  );

  const subjectData = React.useMemo(
    () => availableSubjects
      .map(subject => ({
        subject: subject.length > 5 ? subject.slice(0, 4) : subject,
        fullSubject: subject,
        student: getSubjectAverage(student.id, subject, studentMarks),
        classAvg: getClassAverage(student.classId, subject, students, allMarks),
      }))
      .filter(row => row.student > 0 || row.classAvg > 0),
    [availableSubjects, student.id, student.classId, studentMarks, students, allMarks],
  );

  const trendData = React.useMemo(
    () => availableExamTypes
      .map(exam => {
        const examMarks = studentMarks.filter(mark => mark.examType === exam);
        if (examMarks.length === 0) {
          return null;
        }

        const avg = Math.round(examMarks.reduce((sum, mark) => sum + (mark.marksObtained / mark.totalMarks) * 100, 0) / examMarks.length);
        return {
          exam: exam,
          fullExam: exam,
          average: avg,
        };
      })
      .filter((row): row is { exam: string; fullExam: string; average: number } => Boolean(row)),
    [availableExamTypes, studentMarks],
  );

  if (loading.students || loading.marks || loading.subjects || loading.exams) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border border-border p-5 min-h-[322px] flex items-center justify-center">
          <p className="text-sm text-muted-foreground font-medium">Loading...</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-5 min-h-[322px] flex items-center justify-center">
          <p className="text-sm text-muted-foreground font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="font-display font-semibold text-foreground mb-4">Subject Performance vs Class Average</h3>
        {subjectData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={subjectData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="subject" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.fullSubject || ''}
              />
              <Legend />
              <Bar dataKey="student" name="Student" fill="#1a3366" radius={[4, 4, 0, 0]} />
              <Bar dataKey="classAvg" name="Class Avg" fill="#f6a823" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[250px] flex items-center justify-center">
            <p className="text-sm text-muted-foreground font-medium">No academic data available yet</p>
          </div>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="font-display font-semibold text-foreground mb-4">Performance Trend</h3>
        {trendData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="exam" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.fullExam || ''}
              />
              <Line type="monotone" dataKey="average" stroke="#39ac85" strokeWidth={3} dot={{ r: 6, fill: "#39ac85" }} name="Avg Score" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[250px] flex items-center justify-center">
            <p className="text-sm text-muted-foreground font-medium">No academic data available yet</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PerformanceChart;

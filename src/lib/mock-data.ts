import { Student, Mark, AttendanceRecord, Feedback, Fee, BusRoute, LoginCredential } from './types';

const colors = ['#1e3a5f', '#d4950a', '#2e8b6e', '#7c3aed', '#dc4545', '#0891b2', '#9333ea'];

export let students: Student[] = [
  { id: 'S001', name: 'Aarav Sharma', classId: '10', className: 'Class 10', section: 'A', schoolId: 'school_001', parentName: 'Rajesh Sharma', parentContact: '+91 98765 43210', enrollmentDate: '2023-04-01', avatarColor: colors[0], address: '12 MG Road, Delhi', dateOfBirth: '2008-05-15', bloodGroup: 'B+', busRouteId: 'BR001' },
  { id: 'S002', name: 'Priya Patel', classId: '10', className: 'Class 10', section: 'A', schoolId: 'school_001', parentName: 'Suresh Patel', parentContact: '+91 98765 43211', enrollmentDate: '2023-04-01', avatarColor: colors[1], address: '45 Nehru Nagar, Delhi', dateOfBirth: '2008-08-22', bloodGroup: 'A+', busRouteId: 'BR001' },
  { id: 'S003', name: 'Rohan Gupta', classId: '10', className: 'Class 10', section: 'A', schoolId: 'school_001', parentName: 'Amit Gupta', parentContact: '+91 98765 43212', enrollmentDate: '2023-04-01', avatarColor: colors[2], address: '78 Lajpat Nagar, Delhi', dateOfBirth: '2008-03-10', bloodGroup: 'O+', busRouteId: 'BR002' },
  { id: 'S004', name: 'Ananya Singh', classId: '10', className: 'Class 10', section: 'B', schoolId: 'school_001', parentName: 'Vikram Singh', parentContact: '+91 98765 43213', enrollmentDate: '2023-04-01', avatarColor: colors[3], address: '23 Saket, Delhi', dateOfBirth: '2008-11-05', bloodGroup: 'AB+', busRouteId: 'BR002' },
  { id: 'S005', name: 'Karthik Reddy', classId: '10', className: 'Class 10', section: 'B', schoolId: 'school_001', parentName: 'Srinivas Reddy', parentContact: '+91 98765 43214', enrollmentDate: '2023-04-01', avatarColor: colors[4], address: '56 Dwarka, Delhi', dateOfBirth: '2008-07-18', bloodGroup: 'B-' },
  { id: 'S006', name: 'Meera Nair', classId: '9', className: 'Class 9', section: 'A', schoolId: 'school_001', parentName: 'Gopal Nair', parentContact: '+91 98765 43215', enrollmentDate: '2023-04-01', avatarColor: colors[5], address: '89 Vasant Kunj, Delhi', dateOfBirth: '2009-01-25', bloodGroup: 'A-', busRouteId: 'BR001' },
  { id: 'S007', name: 'Arjun Kumar', classId: '9', className: 'Class 9', section: 'A', schoolId: 'school_001', parentName: 'Sunil Kumar', parentContact: '+91 98765 43216', enrollmentDate: '2024-04-01', avatarColor: colors[6], address: '34 Janakpuri, Delhi', dateOfBirth: '2009-09-12', bloodGroup: 'O-', busRouteId: 'BR003' },
  { id: 'S008', name: 'Ishita Das', classId: '9', className: 'Class 9', section: 'B', schoolId: 'school_001', parentName: 'Pranab Das', parentContact: '+91 98765 43217', enrollmentDate: '2024-04-01', avatarColor: colors[0], address: '67 Rohini, Delhi', dateOfBirth: '2009-04-30', bloodGroup: 'AB-', busRouteId: 'BR003' },
];

export const subjects = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English'];
const examTypes: Mark['examType'][] = ['Periodic Test', 'Midterm', 'Final'];

export let marks: Mark[] = [];
let markId = 1;
students.forEach(s => {
  subjects.forEach(sub => {
    examTypes.forEach((exam, ei) => {
      const base = sub === 'Mathematics' && s.id === 'S001' ? 55 : sub === 'Biology' && s.id === 'S001' ? 88 : 60 + Math.floor(Math.random() * 30);
      const trend = ei * 3;
      marks.push({
        id: `M${String(markId++).padStart(3, '0')}`,
        studentId: s.id,
        subject: sub,
        examType: exam,
        marksObtained: Math.min(100, base + trend + Math.floor(Math.random() * 8) - 4),
        totalMarks: 100,
        date: `2024-${String(4 + ei * 3).padStart(2, '0')}-15`,
      });
    });
  });
});

export interface HistoricalBatch {
  year: string;
  class: string;
  subjectAverages: Record<string, number>;
  overallAverage: number;
  topperPercentage: number;
  totalStudents: number;
}

export const historicalBatches: HistoricalBatch[] = [
  { year: '2021-22', class: '10', subjectAverages: { Mathematics: 68, Physics: 72, Chemistry: 70, Biology: 74, English: 76 }, overallAverage: 72, topperPercentage: 96, totalStudents: 45 },
  { year: '2022-23', class: '10', subjectAverages: { Mathematics: 71, Physics: 69, Chemistry: 73, Biology: 76, English: 78 }, overallAverage: 73, topperPercentage: 94, totalStudents: 48 },
  { year: '2023-24', class: '10', subjectAverages: { Mathematics: 65, Physics: 70, Chemistry: 68, Biology: 72, English: 75 }, overallAverage: 70, topperPercentage: 92, totalStudents: 50 },
  { year: '2021-22', class: '9', subjectAverages: { Mathematics: 70, Physics: 68, Chemistry: 66, Biology: 71, English: 73 }, overallAverage: 70, topperPercentage: 93, totalStudents: 42 },
  { year: '2022-23', class: '9', subjectAverages: { Mathematics: 72, Physics: 71, Chemistry: 69, Biology: 73, English: 75 }, overallAverage: 72, topperPercentage: 95, totalStudents: 44 },
  { year: '2023-24', class: '9', subjectAverages: { Mathematics: 67, Physics: 65, Chemistry: 64, Biology: 70, English: 72 }, overallAverage: 68, topperPercentage: 91, totalStudents: 46 },
];

export let attendance: AttendanceRecord[] = [];
let attId = 1;
students.forEach(s => {
  for (let m = 1; m <= 6; m++) {
    for (let d = 1; d <= 22; d++) {
      const rand = Math.random();
      const status: AttendanceRecord['status'] = s.id === 'S001' && m >= 5 ? (rand < 0.75 ? 'Present' : rand < 0.9 ? 'Absent' : 'Leave') : (rand < 0.88 ? 'Present' : rand < 0.95 ? 'Absent' : 'Leave');
      attendance.push({
        id: `A${String(attId++).padStart(4, '0')}`,
        studentId: s.id,
        date: `2024-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        status,
      });
    }
  }
});

export let feedbacks: Feedback[] = [
  { id: 'F001', studentId: 'S001', teacherName: 'Mrs. Deepa Iyer', category: 'Academic', remark: 'Aarav shows good effort in Biology but needs to focus more on Mathematics. Regular practice will help.', date: '2024-09-20' },
  { id: 'F002', studentId: 'S001', teacherName: 'Mr. Rajan Verma', category: 'Attendance', remark: 'Attendance has been inconsistent recently. Please ensure regularity.', date: '2024-10-05' },
  { id: 'F003', studentId: 'S002', teacherName: 'Mrs. Deepa Iyer', category: 'Academic', remark: 'Priya is an excellent student with consistent performance across all subjects. Keep it up!', date: '2024-09-22' },
  { id: 'F004', studentId: 'S003', teacherName: 'Mr. Rajan Verma', category: 'Academic', remark: 'Rohan participates well in class but needs to improve homework submissions.', date: '2024-09-25' },
  { id: 'F005', studentId: 'S004', teacherName: 'Mrs. Deepa Iyer', category: 'Academic', remark: 'Ananya has shown remarkable improvement in Chemistry this term.', date: '2024-10-01' },
  { id: 'F006', studentId: 'S005', teacherName: 'Mr. Rajan Verma', category: 'Behavior', remark: 'Karthik needs to work on time management during exams.', date: '2024-09-28' },
];

export let fees: Fee[] = [
  { studentId: 'S001', feeStatus: 'Paid', lastPaymentDate: '2024-07-10', amount: 25000, dueDate: '2024-07-15' },
  { studentId: 'S002', feeStatus: 'Paid', lastPaymentDate: '2024-07-05', amount: 25000, dueDate: '2024-07-15' },
  { studentId: 'S003', feeStatus: 'Pending', lastPaymentDate: '2024-04-10', amount: 25000, dueDate: '2024-07-15' },
  { studentId: 'S004', feeStatus: 'Paid', lastPaymentDate: '2024-07-12', amount: 25000, dueDate: '2024-07-15' },
  { studentId: 'S005', feeStatus: 'Pending', lastPaymentDate: '2024-04-15', amount: 25000, dueDate: '2024-07-15' },
  { studentId: 'S006', feeStatus: 'Paid', lastPaymentDate: '2024-07-08', amount: 22000, dueDate: '2024-07-15' },
  { studentId: 'S007', feeStatus: 'Paid', lastPaymentDate: '2024-07-01', amount: 22000, dueDate: '2024-07-15' },
  { studentId: 'S008', feeStatus: 'Pending', lastPaymentDate: '2024-03-20', amount: 22000, dueDate: '2024-07-15' },
];

// Bus Routes
export let busRoutes: BusRoute[] = [
  {
    id: 'BR001', routeName: 'North Delhi Express', routeNumber: 'R-01', driverName: 'Ramesh Yadav', driverContact: '+91 98111 22334',
    vehicleNumber: 'DL-01-AB-1234', capacity: 40, assignedStudents: ['S001', 'S002', 'S006'],
    stops: [
      { name: 'MG Road', time: '07:15', order: 1 },
      { name: 'Nehru Nagar', time: '07:25', order: 2 },
      { name: 'Vasant Kunj', time: '07:40', order: 3 },
      { name: 'School Gate', time: '08:00', order: 4 },
    ],
    status: 'Active',
  },
  {
    id: 'BR002', routeName: 'South Delhi Shuttle', routeNumber: 'R-02', driverName: 'Suresh Tiwari', driverContact: '+91 98111 55667',
    vehicleNumber: 'DL-02-CD-5678', capacity: 35, assignedStudents: ['S003', 'S004'],
    stops: [
      { name: 'Lajpat Nagar', time: '07:10', order: 1 },
      { name: 'Saket', time: '07:25', order: 2 },
      { name: 'Hauz Khas', time: '07:40', order: 3 },
      { name: 'School Gate', time: '08:00', order: 4 },
    ],
    status: 'Active',
  },
  {
    id: 'BR003', routeName: 'West Delhi Connect', routeNumber: 'R-03', driverName: 'Mohan Lal', driverContact: '+91 98111 88990',
    vehicleNumber: 'DL-03-EF-9012', capacity: 45, assignedStudents: ['S007', 'S008'],
    stops: [
      { name: 'Janakpuri', time: '07:00', order: 1 },
      { name: 'Dwarka', time: '07:15', order: 2 },
      { name: 'Rohini', time: '07:35', order: 3 },
      { name: 'School Gate', time: '08:00', order: 4 },
    ],
    status: 'Active',
  },
];

// Login credentials managed by admin
export let loginCredentials: LoginCredential[] = [
  { id: 'L001', username: 'admin', role: 'admin', name: 'Principal Singh', active: true },
  { id: 'L002', username: 'teacher1', role: 'teacher', name: 'Mrs. Deepa Iyer', active: true },
  { id: 'L003', username: 'teacher2', role: 'teacher', name: 'Mr. Rajan Verma', active: true },
  { id: 'L004', username: 'parent_aarav', role: 'parent', linkedStudentId: 'S001', name: 'Rajesh Sharma', active: true },
  { id: 'L005', username: 'parent_priya', role: 'parent', linkedStudentId: 'S002', name: 'Suresh Patel', active: true },
  { id: 'L006', username: 'student_aarav', role: 'student', linkedStudentId: 'S001', name: 'Aarav Sharma', active: true },
  { id: 'L007', username: 'student_priya', role: 'student', linkedStudentId: 'S002', name: 'Priya Patel', active: true },
];

// Mutators for forms
export function addStudent(student: Student) {
  students = [...students, student];
}

export function addMark(mark: Mark) {
  marks = [...marks, mark];
}

export function addAttendanceRecords(records: AttendanceRecord[]) {
  attendance = [...attendance, ...records];
}

export function addFeedback(fb: Feedback) {
  feedbacks = [...feedbacks, fb];
}

export function updateFee(studentId: string, fee: Partial<Fee>) {
  fees = fees.map(f => f.studentId === studentId ? { ...f, ...fee } : f);
}

export function addBusRoute(route: BusRoute) {
  busRoutes = [...busRoutes, route];
}

export function updateBusRoute(id: string, updates: Partial<BusRoute>) {
  busRoutes = busRoutes.map(r => r.id === id ? { ...r, ...updates } : r);
}

export function addLoginCredential(cred: LoginCredential) {
  loginCredentials = [...loginCredentials, cred];
}

export function updateLoginCredential(id: string, updates: Partial<LoginCredential>) {
  loginCredentials = loginCredentials.map(c => c.id === id ? { ...c, ...updates } : c);
}

export function deleteLoginCredential(id: string) {
  loginCredentials = loginCredentials.filter(c => c.id !== id);
}

// Helper functions
export function getStudentMarks(studentId: string) {
  return marks.filter(m => m.studentId === studentId);
}

export function getStudentAttendance(studentId: string) {
  return attendance.filter(a => a.studentId === studentId);
}

export function getAttendancePercentage(studentId: string) {
  const records = getStudentAttendance(studentId);
  if (records.length === 0) return 0;
  const present = records.filter(r => r.status === 'Present').length;
  return Math.round((present / records.length) * 100);
}

export function getStudentFeedback(studentId: string) {
  return feedbacks.filter(f => f.studentId === studentId);
}

export function getSubjectAverage(studentId: string, subject: string) {
  const subjectMarks = marks.filter(m => m.studentId === studentId && m.subject === subject);
  if (subjectMarks.length === 0) return 0;
  return Math.round(subjectMarks.reduce((sum, m) => sum + (m.marksObtained / m.totalMarks) * 100, 0) / subjectMarks.length);
}

export function getSubjectExamScore(studentId: string, subject: string, examType: Mark['examType']) {
  const m = marks.find(mk => mk.studentId === studentId && mk.subject === subject && mk.examType === examType);
  return m ? Math.round((m.marksObtained / m.totalMarks) * 100) : 0;
}

export function getEndTermResults(studentId: string) {
  return marks.filter(m => m.studentId === studentId && m.examType === 'Final');
}

export function getEndTermPercentage(studentId: string) {
  const finals = getEndTermResults(studentId);
  if (finals.length === 0) return 0;
  return Math.round(finals.reduce((sum, m) => sum + (m.marksObtained / m.totalMarks) * 100, 0) / finals.length);
}

export function getClassAverage(className: string, subject: string) {
  const classStudents = students.filter(s => s.classId === className);
  const avgs = classStudents.map(s => getSubjectAverage(s.id, subject)).filter(a => a > 0);
  if (avgs.length === 0) return 0;
  return Math.round(avgs.reduce((s, a) => s + a, 0) / avgs.length);
}

export function getOverallPercentage(studentId: string) {
  const studentMarks = getStudentMarks(studentId);
  if (studentMarks.length === 0) return 0;
  const total = studentMarks.reduce((sum, m) => sum + (m.marksObtained / m.totalMarks) * 100, 0);
  return Math.round(total / studentMarks.length);
}

export function getClassRanking(studentId: string) {
  const student = students.find(s => s.id === studentId);
  if (!student) return { rank: 0, total: 0 };
  const classStudents = students.filter(s => s.classId === student.classId);
  const percentages = classStudents.map(s => ({ id: s.id, pct: getOverallPercentage(s.id) }));
  percentages.sort((a, b) => b.pct - a.pct);
  const rank = percentages.findIndex(p => p.id === studentId) + 1;
  return { rank, total: classStudents.length };
}

export function getSectionAverage(className: string, section: string, subject: string) {
  const sectionStudents = students.filter(s => (s.classId || "") === className && (s.section || "") === section);
  const avgs = sectionStudents.map(s => getSubjectAverage(s.id, subject)).filter(a => a > 0);
  if (avgs.length === 0) return 0;
  return Math.round(avgs.reduce((s, a) => s + a, 0) / avgs.length);
}

export function getSchoolAverage(subject: string) {
  const avgs = students.map(s => getSubjectAverage(s.id, subject)).filter(a => a > 0);
  if (avgs.length === 0) return 0;
  return Math.round(avgs.reduce((s, a) => s + a, 0) / avgs.length);
}

export function getSectionRanking(studentId: string) {
  const student = students.find(s => s.id === studentId);
  if (!student) return { rank: 0, total: 0 };
  const sectionStudents = students.filter(s => (s.classId || "") === student.classId && (s.section || "") === student.section);
  const percentages = sectionStudents.map(s => ({ id: s.id, pct: getOverallPercentage(s.id) }));
  percentages.sort((a, b) => b.pct - a.pct);
  const rank = percentages.findIndex(p => p.id === studentId) + 1;
  return { rank, total: sectionStudents.length };
}

export function getSchoolRanking(studentId: string) {
  const percentages = students.map(s => ({ id: s.id, pct: getOverallPercentage(s.id) }));
  percentages.sort((a, b) => b.pct - a.pct);
  const rank = percentages.findIndex(p => p.id === studentId) + 1;
  return { rank, total: students.length };
}

export function getSectionStudents(className: string, section: string) {
  return students.filter(s => (s.classId || "") === className && (s.section || "") === section);
}

export function getClassStudents(className: string) {
  return students.filter(s => s.classId === className);
}

export function getSameClassStudents(studentId: string) {
  const student = students.find(s => s.id === studentId);
  if (!student) return [];
  return students.filter(s => s.classId === student.classId && s.id !== studentId);
}

export function getHistoricalData(className: string) {
  return historicalBatches.filter(b => b.class === className);
}

export function getSubjectAnalysis(studentId: string) {
  const scores = subjects.map(sub => ({
    subject: sub,
    average: getSubjectAverage(studentId, sub),
    endTerm: getSubjectExamScore(studentId, sub, 'Final'),
    periodic: getSubjectExamScore(studentId, sub, 'Periodic Test'),
    midterm: getSubjectExamScore(studentId, sub, 'Midterm'),
  }));
  scores.sort((a, b) => b.average - a.average);
  const strong = scores.filter(s => s.average >= 75);
  const weak = scores.filter(s => s.average < 65);
  const improving = scores.filter(s => s.endTerm > s.periodic + 5);
  const declining = scores.filter(s => s.endTerm < s.periodic - 5);
  return { scores, strong, weak, improving, declining };
}

export function getEndTermRanking(className: string, section?: string) {
  const pool = section
    ? students.filter(s => (s.classId || "") === className && (s.section || "") === section)
    : students.filter(s => s.classId === className);
  return pool
    .map(s => ({ ...s, pct: getEndTermPercentage(s.id) }))
    .sort((a, b) => b.pct - a.pct);
}

export function generateRoleRecommendations(studentId: string, role: 'student' | 'parent' | 'teacher' | 'admin'): string[] {
  const analysis = getSubjectAnalysis(studentId);
  const attPct = getAttendancePercentage(studentId);
  const student = students.find(s => s.id === studentId);
  const recommendations: string[] = [];

  if (role === 'student') {
    if (analysis.weak.length > 0) recommendations.push(`Academic support needed in ${analysis.weak.map(w => w.subject).join(', ')}. Supplemental practice recommended.`);
    if (analysis.strong.length > 0) recommendations.push(`Excelling in ${analysis.strong.map(s => s.subject).join(', ')}. Advanced coursework or peer mentoring recommended.`);
    if (analysis.improving.length > 0) recommendations.push(`Improving trend in ${analysis.improving.map(s => s.subject).join(', ')}. Maintain current effort.`);
    if (analysis.declining.length > 0) recommendations.push(`Academic decline noted in ${analysis.declining.map(s => s.subject).join(', ')}. Review fundamentals and consult subject teacher.`);
    if (attPct < 80) recommendations.push(`Attendance is below 80%. Consistent presence is critical for academic success.`);
  }

  if (role === 'parent') {
    if (analysis.weak.length > 0) recommendations.push(`Your child needs extra support in ${analysis.weak.map(w => w.subject).join(', ')}. Consider arranging additional coaching.`);
    if (analysis.strong.length > 0) recommendations.push(`Encourage your child's strength in ${analysis.strong.map(s => s.subject).join(', ')} — nurturing these can boost confidence.`);
    if (attPct < 80) recommendations.push(`Attendance is ${attPct}%. Please ensure regular school attendance for better learning outcomes.`);
    if (analysis.declining.length > 0) recommendations.push(`Performance declining in ${analysis.declining.map(s => s.subject).join(', ')}. A parent-teacher discussion may help.`);
  }

  if (role === 'teacher') {
    if (analysis.weak.length > 0) recommendations.push(`${student?.name} is weak in ${analysis.weak.map(w => `${w.subject} (${w.average}%)`).join(', ')}. Assign targeted worksheets.`);
    if (analysis.declining.length > 0) recommendations.push(`Declining trend in ${analysis.declining.map(s => s.subject).join(', ')} for ${student?.name}. One-on-one mentoring recommended.`);
    if (analysis.improving.length > 0) recommendations.push(`${student?.name} is improving in ${analysis.improving.map(s => s.subject).join(', ')}. Acknowledge progress to keep motivation high.`);
    if (attPct < 80) recommendations.push(`${student?.name} attendance is ${attPct}%. Follow up with parents.`);
  }

  if (role === 'admin') {
    if (analysis.weak.length > 0) recommendations.push(`${student?.name} (Class ${student?.classId}-${student?.section}): Below threshold in ${analysis.weak.map(w => w.subject).join(', ')}.`);
    const endTermPct = getEndTermPercentage(studentId);
    if (endTermPct < 50) recommendations.push(`${student?.name} scored ${endTermPct}% in End-Term. Remedial action required.`);
    if (attPct < 75) recommendations.push(`${student?.name} attendance critically low at ${attPct}%. Parental notification recommended.`);
  }

  if (recommendations.length === 0) recommendations.push('Performance is steady. Keep maintaining consistency across all subjects.');
  return recommendations;
}

export function generateAISummary(studentId: string): string[] {
  const summaries: string[] = [];
  const subjectScores = subjects.map(s => ({ subject: s, avg: getSubjectAverage(studentId, s) }));
  subjectScores.sort((a, b) => b.avg - a.avg);
  const best = subjectScores[0];
  const worst = subjectScores[subjectScores.length - 1];
  if (best.avg > 0) summaries.push(`Strong performance in ${best.subject} with an average of ${best.avg}%.`);
  if (worst.avg > 0 && worst.avg < 70) summaries.push(`Needs improvement in ${worst.subject} (${worst.avg}% average).`);
  const attPct = getAttendancePercentage(studentId);
  if (attPct < 80) summaries.push(`Attendance is below expectations at ${attPct}%. Regular attendance is important.`);
  else if (attPct >= 90) summaries.push(`Excellent attendance record at ${attPct}%.`);
  const studentMarks = getStudentMarks(studentId);
  const finalMarks = studentMarks.filter(m => m.examType === 'Final');
  const periodicMarks = studentMarks.filter(m => m.examType === 'Periodic Test');
  if (finalMarks.length > 0 && periodicMarks.length > 0) {
    const finalAvg = finalMarks.reduce((s, m) => s + m.marksObtained, 0) / finalMarks.length;
    const periodicAvg = periodicMarks.reduce((s, m) => s + m.marksObtained, 0) / periodicMarks.length;
    if (finalAvg > periodicAvg + 5) summaries.push('Performance is showing an improving trend across exams.');
    else if (finalAvg < periodicAvg - 5) summaries.push('Performance has declined compared to earlier assessments. Review recommended.');
  }
  if (summaries.length === 0) summaries.push('Performance is steady across all subjects.');
  return summaries;
}

// Search students by name and/or class
export function searchStudents(query: string, classFilter?: string): Student[] {
  let result = students;
  if (classFilter) result = result.filter(s => s.classId === classFilter);
  if (query) result = result.filter(s => 
      (s.name || "").toLowerCase().includes(query.toLowerCase()) || 
      (s.id || "").toLowerCase().includes(query.toLowerCase())
  );
  return result;
}

// Get student's bus route info
export function getStudentBusRoute(studentId: string): BusRoute | undefined {
  return busRoutes.find(r => r.assignedStudents.includes(studentId));
}

export type UserRole = 'admin' | 'teacher' | 'accountant' | 'parent' | 'student';

export type ComparisonScope = 'section' | 'class' | 'school' | 'one-to-one';

export interface FeeRecord {
  id: string;
  month: string;
  monthIndex?: number;
  monthKey?: string;
  paid: number;
  date: string;
  receiptNumber?: string;
  paymentMode?: string;
  status: string;
  recordedAt?: string;
  baseFee?: number;
  totalFee?: number;
  dueAmount?: number;
  academicYear?: string;
}

export const ACADEMIC_MONTHS = [
  { name: "April", index: 0 },
  { name: "May", index: 1 },
  { name: "June", index: 2 },
  { name: "July", index: 3 },
  { name: "August", index: 4 },
  { name: "September", index: 5 },
  { name: "October", index: 6 },
  { name: "November", index: 7 },
  { name: "December", index: 8 },
  { name: "January", index: 9 },
  { name: "February", index: 10 },
  { name: "March", index: 11 }
];

export interface Payment {
  id: string;
  studentId: string;
  studentName: string;
  classId: string;
  section: string;
  month: string;      // Display name
  monthIndex: number; // Academic order (April = 0 ... March = 11)
  monthKey: string;   // Unique key: "2026_1"
  year: string;
  academicYear: string;
  amount: number;
  totalPaid?: number; // Accumulated total for the month
  amount_total?: number; // ✅ ADD THIS
  status: 'paid' | 'partial';
  date: string;
  timestamp: string;
  paidAt: string;
  method?: string;
  updatedAt?: string;
  history?: any[];
}

export interface StudentFees {
  total: number;
  paid: number;
  dueAmount: number;
  pending: number;
  status: 'paid' | 'unpaid' | 'partial';
  monthlyFee?: number;
  busFee?: number;
  records?: FeeRecord[];
  lastPaymentDate?: string;
  totalExpected?: number;
}

export interface Student {
  id: string;
  rollNumber: string;   // REQUIRED UNIQUE IDENTIFIER
  name: string;
  class: string;        // Mandatory identifier
  classId: string;      // Internal logic ID
  className: string;    // Display name
  section: string;      // Mandatory identifier
  schoolId: string;    // "school_001"
  totalFees: number;    // REQUIRED
  paidAmount: number;   // REQUIRED
  parentName: string;
  parentContact: string;
  motherName?: string;
  enrollmentDate: string;
  avatarColor: string;
  photoURL?: string;
  profileImage?: string;
  address?: string;
  dateOfBirth?: string;
  bloodGroup?: string;
  isActive?: boolean;
  transport_enabled?: boolean;
  fees?: StudentFees;   // Temporary compatibility
  bus?: {
    opted: boolean;
    enabled?: boolean;
    pickup?: string;
    drop?: string;
    routeId?: string;
    stopName?: string;
    route?: string;
    fee?: number;
    fare?: number;
  };
  results?: Record<string, {
    subjects: Record<string, {
      marks: number;
      updatedAt: string;
      source?: string;
      history?: Array<{
        marks: number;
        updatedAt: string;
        source?: string;
      }>;
    }>;
    isPublished?: boolean;
  }>;
}

export interface UploadMetadata {
  id: string;
  examId: string;
  classId: string;
  uploadedAt: string;
  updatedBy: string;
  totalRecords: number;
  successCount: number;
  errorCount: number;
  fileHash: string;
}

export interface Mark {
  id: string;
  studentId: string;
  subject: string;
  examType: 'Periodic Test' | 'Midterm' | 'Final';
  marksObtained: number;
  totalMarks: number;
  date: string;
  isPublished?: boolean;
  subjectId?: string;
  examId?: string;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  date: string;
  status: 'present' | 'absent' | 'leave' | 'Present' | 'Absent' | 'Leave' | 'Late' | 'Excused';
  reason?: string | null;
  updatedAt?: string;
}

export interface Feedback {
  id: string;
  studentId: string;
  class?: string;
  classId?: string;
  section?: string;
  teacherId?: string;
  teacherName?: string;
  examType?: string;
  feedbackText?: string;
  status?: 'draft' | 'published';
  createdAt?: string;
  updatedAt?: string;
  category?: 'Academic' | 'Behavior' | 'Attendance' | 'Health' | 'Other';
  remark?: string;
  date?: string;
}

export interface Fee {
  studentId: string;
  feeStatus: 'Paid' | 'Pending';
  lastPaymentDate: string;
  amount?: number;
  dueDate?: string;
}

export interface BusRoute {
  id: string;
  routeName: string;
  routeNumber: string;
  driverName: string;
  driverContact: string;
  vehicleNumber: string;
  capacity: number;
  assignedStudents: string[];
  stops: BusStop[];
  status: 'Active' | 'Inactive' | 'Maintenance';
}

export interface BusStop {
  name: string;
  time: string;
  order: number;
}

export interface LoginCredential {
  id: string;
  uid?: string;
  username: string;
  role: UserRole;
  linkedStudentId?: string;
  classId?: string;
  name: string;
  active: boolean;
}

export interface AppUser {
  uid: string;
  email: string;
  role: UserRole;
  name: string;
  emailSent?: boolean;
  classId?: string;
  section?: string;
  rollNumber?: string;
  linkedStudentId?: string;
  linkedChildrenIds?: string[];
  schoolId: string;
  createdAt: string;
  photoURL?: string;
}

export interface FeeConfig {
  classId: string;
  totalFee: number;
  transportFee?: number;
  optionalCharges?: {
    transport?: number;
    hostel?: number;
    other?: number;
  };
}

export interface ExamConfig {
  id: string;
  examId: string;
  name: string;
  order: number;
  examDate?: string;
  resultDate?: string;
  isPublished: boolean;
}

export interface SubjectConfig {
  id: string;
  subjectId: string;
  name: string;
  classIds: string[]; // List of classIds where this subject is applicable
}

export interface ClassConfig {
  id: string;
  classId: string;
  name: string;
  order: number;
  sections?: string[];
}

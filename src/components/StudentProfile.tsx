import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Student, ACADEMIC_MONTHS } from '@/lib/types';
import { useStore } from '@/store/useStore';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getOverallPercentage,
  getAttendancePercentage,
  getStudentMarks,
  getClassRanking,
  generateAISummary,
  getFeeSummary,
  getStudentPendingStatus,
  getClassName,
  getAcademicContext,
  getStudentPaymentTransactions
} from '@/lib/data-utils';
import PerformanceChart from './PerformanceChart';
import { Calendar, Award, MessageSquare, TrendingUp, Sparkles, ArrowLeft, IndianRupee, Loader2, Bus, Save, Printer, FileText, X, Camera } from 'lucide-react';
import { toast } from 'sonner';
import StatCard from './StatCard';
import FeedbackList from './FeedbackList';
import useStudentFeedback from '@/hooks/useStudentFeedback';
import StudentAvatar from './StudentAvatar';
import { uploadProfileImage } from '@/lib/profileImageUpload';


interface StudentProfileProps {
  student: Student;
  onBack: () => void;
  simplified?: boolean;
  onFeedbackClick?: () => void;
}

const StudentProfile = ({ student: initialStudent, onBack, simplified = false, onFeedbackClick }: StudentProfileProps) => {
  
  const { schoolId, role } = useAuth();
  const { students, marks: allMarks, attendance, feeSettings, loading, subjects: allSubjects, exams, classes: storeClasses, busRoutes, payments, fetchStudents } = useStore();
  const [savingBus, setSavingBus] = React.useState(false);
  const [uploadingPhoto, setUploadingPhoto] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [photoPreviewURL, setPhotoPreviewURL] = React.useState(initialStudent?.photoURL || '');
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [uploadStarted, setUploadStarted] = React.useState(false);
  const [showReceipt, setShowReceipt] = React.useState(false);
  const [receiptMonth, setReceiptMonth] = React.useState(() => getAcademicContext().currentMonth);
  const [receiptPaymentId, setReceiptPaymentId] = React.useState('');
  // ─── Local bus draft state (only committed on Save button click) ───
  const [draftBusEnabled, setDraftBusEnabled] = React.useState(initialStudent?.transport_enabled === true);
  const [draftRouteId, setDraftRouteId] = React.useState(initialStudent?.bus?.routeId || initialStudent?.bus?.route || '');
  const [draftStopName, setDraftStopName] = React.useState(initialStudent?.bus?.stopName || '');
  const [draftBusFee, setDraftBusFee] = React.useState(0);
  const photoInputRef = React.useRef<HTMLInputElement | null>(null);
  const previewObjectUrlRef = React.useRef<string | null>(null);

  // Fetch student safely from store using current data
  const student = students.find(s => s.id === initialStudent?.id) || initialStudent;
  const studentId = student?.id || initialStudent?.id || '';



  const { feedback } = useStudentFeedback({
    schoolId,
    studentId,
    publishedOnly: role === 'parent' || role === 'student',
  });

  const studentClassId = student?.classId || student?.class || student?.className || '';
  const busEnabled = student?.transport_enabled === true;
  const busFee = Number(feeSettings[studentClassId]?.transportFee || 0);
  const busRouteId = student?.bus?.routeId || student?.bus?.route || '';
  const stopName = student?.bus?.stopName || '';

  const clearPreviewObjectUrl = React.useCallback(() => {
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }
  }, []);

  // Sync draft bus state whenever the student record changes from the store
  React.useEffect(() => {
    if (student) {
      setDraftBusEnabled(student.transport_enabled === true);
      setDraftRouteId(student.bus?.routeId || student.bus?.route || '');
      setDraftStopName(student.bus?.stopName || '');
    }
  }, [student?.id, student?.transport_enabled, student?.bus?.routeId, student?.bus?.stopName]);

  React.useEffect(() => {
    setDraftBusFee(Number(feeSettings[studentClassId]?.transportFee || 0));
  }, [studentClassId, feeSettings]);

  React.useEffect(() => {
    setPhotoPreviewURL(student?.photoURL || '');
  }, [student?.photoURL]);

  React.useEffect(() => () => clearPreviewObjectUrl(), [clearPreviewObjectUrl]);

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !student || !schoolId || role !== 'admin' || uploadingPhoto) {
      return;
    }

    if (file.size === 0) {
      toast.error('Selected file is empty');
      console.error('Profile image upload aborted: empty file');
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    const previousPhotoURL = student.photoURL || photoPreviewURL || '';
    clearPreviewObjectUrl();
    const previewUrl = URL.createObjectURL(file);
    previewObjectUrlRef.current = previewUrl;
    setPhotoPreviewURL(previewUrl);
    setUploadError(null);
    setUploadingPhoto(true);
    setUploadStarted(true);
    setUploadProgress(0);

    try {
      const downloadURL = await uploadProfileImage(
        file,
        student.id,
        schoolId,
        (progress) => setUploadProgress(progress)
      );

      clearPreviewObjectUrl();
      setUploadProgress(100);
      setPhotoPreviewURL(downloadURL);
      setUploadError(null);
      void fetchStudents(schoolId).catch((refreshError) => {
        console.error('Failed to refresh students after photo upload:', refreshError);
      });
      toast.success('Profile picture updated');
    } catch (error) {
      console.error('UPLOAD FAILED:', error);
      clearPreviewObjectUrl();
      setPhotoPreviewURL(previousPhotoURL);
      const message = error instanceof Error ? error.message : 'Upload failed. Please retry.';
      setUploadError(message);
      toast.error(message);
    } finally {
      setUploadStarted(false);
      setUploadingPhoto(false);
    }
  };

  const handleSaveBus = async () => {
    if (!schoolId || !student) return;
    setSavingBus(true);
    try {
      const nextRouteId = draftBusEnabled ? draftRouteId : '';
      const nextStopName = draftBusEnabled ? draftStopName : '';

      // 1. Save transport enabled / route / stop to the student record
      const { updateStudentTransport, saveFeeConfig, feeConfigs } = useStore.getState();
      await updateStudentTransport(schoolId, student.id, {
        transport_enabled: draftBusEnabled,
        bus_route_id: nextRouteId || undefined,
        bus_stop: nextStopName || undefined,
      });

      // 2. Persist the bus fee to fee_configs for this student's class
      //    so it survives a page refresh
      if (studentClassId) {
        const existingConfig = feeConfigs.find(c => c.classId === studentClassId);
        await saveFeeConfig(schoolId, {
          classId: studentClassId,
          totalFee: existingConfig?.totalFee ?? 0,
          transportFee: draftBusFee,
          optionalCharges: {
            ...(existingConfig?.optionalCharges || {}),
            transport: draftBusFee,
          },
        });
      }

      toast.success('Transport settings updated successfully');
    } catch (err) {
      console.error('Transport Save Error:', err);
      toast.error('Failed to update transport settings');
    } finally {
      setSavingBus(false);
    }
  };



  const subjects = React.useMemo(() => {
    if (!student || !allSubjects) return ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English'];
    return allSubjects.filter(sub => !sub.classIds || sub.classIds.length === 0 || sub.classIds.includes(student.classId)).map(s => s.name);
  }, [student, allSubjects]);

  const unpublishedExams = React.useMemo(() => {
    if (!student || !student.results || !exams) return [];
    return exams.filter(e => {
      const studentExamData = student.results?.[e.id];
      return studentExamData && !studentExamData.isPublished;
    });
  }, [student, exams]);

  const { currentMonth: CURRENT_MONTH, currentMonthIndex, academicYear: ACADEMIC_YEAR } = React.useMemo(() => getAcademicContext(), []);
  const pendingStatus = React.useMemo(
    () => student ? getStudentPendingStatus(student as any, payments, feeSettings, currentMonthIndex, ACADEMIC_YEAR) : {
      baseFee: 0,
      busFee: 0,
      monthlyFee: 0,
      expectedFee: 0,
      paid: 0,
      due: 0,
      isPending: false,
      status: 'unpaid' as const,
      currentMonthIndex,
      academicYear: ACADEMIC_YEAR,
      transactions: [],
    },
    [student, payments, feeSettings, currentMonthIndex, ACADEMIC_YEAR]
  );

  const studentPayments = React.useMemo(
    () => getStudentPaymentTransactions(studentId, ACADEMIC_YEAR),
    [studentId, ACADEMIC_YEAR, payments]
  );
  const currentMonthPayments = React.useMemo(
    () => getStudentPaymentTransactions(studentId, ACADEMIC_YEAR, CURRENT_MONTH),
    [studentId, ACADEMIC_YEAR, CURRENT_MONTH, payments]
  );
  const receiptTransactions = React.useMemo(
    () => getStudentPaymentTransactions(studentId, ACADEMIC_YEAR, receiptMonth),
    [studentId, ACADEMIC_YEAR, receiptMonth, payments]
  );
  const feedbackPreview = React.useMemo(
    () => (simplified ? feedback.slice(0, 3) : feedback),
    [feedback, simplified]
  );

  // Guard: if no student data at all, show fallback
  if (!student) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-muted-foreground text-sm font-medium">Loading student profile...</p>
      </div>
    );
  }

  if (loading.marks || loading.students) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-muted-foreground text-sm font-medium">Loading profile details...</p>
      </div>
    );
  }

  // Students and parents only see published marks; admin/teacher see everything
  const visibleMarks = (role === 'student' || role === 'parent')
    ? allMarks.filter(m => m.isPublished)
    : allMarks;

  const marks = getStudentMarks(studentId, visibleMarks);
  const overallPct = getOverallPercentage(studentId, visibleMarks);
  const attendancePct = getAttendancePercentage(studentId, attendance);
  const ranking = getClassRanking(studentId, students, visibleMarks);
  const summaries = generateAISummary(studentId, students, visibleMarks, attendance, subjects);
  const selectedReceiptTransaction = receiptTransactions.find(payment => payment.id === receiptPaymentId) || receiptTransactions[receiptTransactions.length - 1] || null;
  const receiptSummary = getFeeSummary(student as any, receiptMonth, ACADEMIC_YEAR);

  const displayTotalFee = Number(pendingStatus?.monthlyFee || 0);
  const displayPaidAmount = Number(pendingStatus?.paid || 0);
  const displayPending = Number(pendingStatus?.due || 0);
  const displayStatus = pendingStatus?.status || 'unpaid';
  
  const formatPaymentMonth = (monthName: string) => {
    const academicMonthIndex = ACADEMIC_MONTHS.findIndex(entry => entry.name === monthName);
    const academicStartYear = Number(ACADEMIC_YEAR.split('-')[0] || new Date().getFullYear());

    if (academicMonthIndex === -1 || Number.isNaN(academicStartYear)) {
      return monthName;
    }

    const displayYear = academicMonthIndex <= 8 ? academicStartYear : academicStartYear + 1;
    return `${monthName} ${displayYear}`;
  };

  const formatPaymentTimestamp = (value?: string) =>
    new Date(value || Date.now()).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  const profileAvatarStudent = { ...student, photoURL: photoPreviewURL || student?.photoURL };

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center gap-4">
          <div className="relative group">
            <StudentAvatar
              student={profileAvatarStudent}
              className="w-14 h-14 rounded-xl"
              initialsClassName="text-xl font-bold text-primary-foreground"
            />
            {role === 'admin' && !simplified && (
              <>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-background border border-border shadow-sm flex items-center justify-center text-primary hover:bg-muted transition-colors disabled:opacity-60"
                  title={uploadingPhoto ? `Uploading ${Math.round(uploadProgress)}%` : 'Upload profile picture'}
                >
                  {uploadingPhoto ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                </button>
              </>
            )}
          </div>
          <div>
            <h2 className="text-xl font-display font-bold text-foreground">{student?.name || "Unknown Student"}</h2>
            <p className="text-muted-foreground text-sm">{getClassName(student?.classId || "", storeClasses)}-{student?.section || "N/A"} · ID: {student?.id || "N/A"}</p>
            {uploadStarted && uploadingPhoto && (
              <div className="mt-2 space-y-1">
                <p className="text-xs font-medium text-primary">
                  Uploading {Math.round(uploadProgress)}%
                </p>
                <div className="w-40 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-200"
                    style={{ width: `${Math.max(6, uploadProgress)}%` }}
                  />
                </div>
              </div>
            )}
            {uploadError && !uploadingPhoto && (
              <div className="mt-2 flex items-center gap-3">
                <p className="text-xs font-medium text-destructive">
                  {uploadError}
                </p>
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        </div>
      </div>


      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Overall" value={`${overallPct}%`} icon={TrendingUp} variant={overallPct >= 75 ? 'success' : overallPct >= 50 ? 'warning' : 'destructive'} />
        <StatCard label="Attendance" value={`${attendancePct}%`} icon={Calendar} variant={attendancePct >= 85 ? 'success' : 'warning'} />
        <StatCard label={`${ranking.scope} Rank`} value={`#${ranking.rank}`} icon={Award} trend={`of ${ranking.total} (${ranking.scope})`} />
        <StatCard
          label="Feedback"
          value={feedback.length}
          icon={MessageSquare}
          onClick={onFeedbackClick}
        />
      </div>

      {/* Financial Overview */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="font-display font-semibold text-foreground mb-4">Financial Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard label="Monthly Fee (Total)" value={`₹${displayTotalFee}`} icon={IndianRupee} trend={student?.transport_enabled ? `Includes ₹${busFee} Bus` : ''} />
          <StatCard label="Paid Amount" value={`₹${displayPaidAmount}`} icon={IndianRupee} variant="success" />
          <div className="relative group">
            <StatCard label="Pending Due" value={`₹${displayPending}`} icon={IndianRupee} variant={displayStatus === 'paid' ? 'success' : 'destructive'} />
            <button
              onClick={() => {
                setReceiptMonth(CURRENT_MONTH);
                setReceiptPaymentId(currentMonthPayments[currentMonthPayments.length - 1]?.id || '');
                setShowReceipt(true);
              }}
              className="absolute top-3 right-3 p-1.5 bg-background border border-border rounded-lg text-primary opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted"
              title="Generate Receipt"
            >
              <FileText className="w-4 h-4" />
            </button>
          </div>
        </div>
        {displayPaidAmount > 0 && (
          <div className="mt-4 flex items-center justify-between p-3 bg-muted/30 border border-border rounded-xl">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">
                {studentPayments.length > 0 
                  ? `Last payment: ${[...studentPayments].sort((a,b) => new Date(b.paidAt || b.timestamp || b.updatedAt || b.date).getTime() - new Date(a.paidAt || a.timestamp || a.updatedAt || a.date).getTime())[0].month}`
                  : `No payments recorded for ${ACADEMIC_YEAR}`}
              </span>
            </div>
            <button
              onClick={() => {
                setReceiptMonth(CURRENT_MONTH);
                setReceiptPaymentId(currentMonthPayments[currentMonthPayments.length - 1]?.id || '');
                setShowReceipt(true);
              }}
              className="px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-bold hover:bg-primary/20 transition-all flex items-center gap-2"
            >
              <Printer className="w-3.5 h-3.5" /> Generate Receipt
            </button>
          </div>
        )}
      </div>

      {/* Transport Management */}
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <Bus className="w-5 h-5 text-primary" />
          <h3 className="font-display font-semibold text-foreground">Transport / Bus Service</h3>
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div
                onClick={() => {
                  if (!simplified) setDraftBusEnabled(prev => !prev);
                }}
                className={`w-12 h-6 rounded-full transition-all flex items-center p-1 ${draftBusEnabled ? 'bg-primary' : 'bg-muted'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-all transform ${draftBusEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
              </div>
              <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">Avails Bus Service</span>
            </label>

            {draftBusEnabled && (
              <div className="flex-1 animate-in fade-in slide-in-from-left-2 duration-200">
                <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1 ml-1">Monthly Bus Fee (₹)</label>
                <input
                  type="number"
                  value={draftBusFee}
                  onChange={(e) => setDraftBusFee(Number(e.target.value))}
                  disabled={simplified}
                  className="w-full max-w-[200px] px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-bold"
                  placeholder="e.g. 1500"
                  min={0}
                />
              </div>
            )}

            {!simplified && (
              <button
                onClick={() => handleSaveBus()}
                disabled={savingBus}
                className="md:ml-auto flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-50"
              >
                {savingBus ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {savingBus ? 'Saving...' : 'Save Transport Settings'}
              </button>
            )}
          </div>

          {draftBusEnabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-muted/20 rounded-2xl border border-border/50">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-muted-foreground mb-1.5 ml-1">Select Route</label>
                  <select
                    value={draftRouteId}
                    disabled={simplified}
                    onChange={(e) => {
                      setDraftRouteId(e.target.value);
                      setDraftStopName(''); // reset stop when route changes
                    }}
                    className="w-full px-3 py-2.5 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Choose a route...</option>
                    {busRoutes.map(r => <option key={r.id} value={r.id}>{r.routeName} ({r.routeNumber})</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-muted-foreground mb-1.5 ml-1">Select Stop</label>
                  <select
                    value={draftStopName}
                    disabled={simplified || !draftRouteId}
                    onChange={(e) => setDraftStopName(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Choose a stop...</option>
                    {busRoutes.find(r => r.id === draftRouteId)?.stops.sort((a, b) => a.order - b.order).map(s => <option key={s.name} value={s.name}>{s.name} ({s.time})</option>)}
                  </select>
                </div>
              </div>

              {draftRouteId && draftStopName && (
                <div className="bg-primary/5 rounded-2xl p-5 border border-primary/10">
                  <h4 className="text-[10px] font-black uppercase text-primary mb-3 flex items-center gap-1.5">
                    <Bus className="w-3 h-3" /> Scheduled Details
                  </h4>
                  {(() => {
                    const r = busRoutes.find(x => x.id === draftRouteId);
                    const s = r?.stops.find(x => x.name === draftStopName);
                    return (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center text-sm border-b border-primary/5 pb-2">
                          <span className="text-muted-foreground">Vehicle Number</span>
                          <span className="font-bold text-foreground">{r?.vehicleNumber || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm border-b border-primary/5 pb-2">
                          <span className="text-muted-foreground">Pickup Time</span>
                          <span className="font-bold text-primary">{s?.time || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm border-b border-primary/5 pb-2">
                          <span className="text-muted-foreground">Driver</span>
                          <span className="font-bold text-foreground">{r?.driverName || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Contact</span>
                          <span className="font-bold text-foreground">{r?.driverContact || 'N/A'}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* AI Summary */}
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

      <PerformanceChart student={student} marks={marks} />

      {/* Recent Feedback */}
      {(simplified || feedback.length > 0) && (
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-foreground">{simplified ? 'Latest Feedback' : 'Teacher Feedback'}</h3>
            {simplified && onFeedbackClick && (
              <button
                type="button"
                onClick={onFeedbackClick}
                className="text-xs font-bold text-primary hover:text-primary/80 transition-colors"
              >
                View All
              </button>
            )}
          </div>
          <FeedbackList
            feedback={feedbackPreview}
            emptyMessage="No feedback yet."
          />
        </div>
      )}

      {/* Payment History */}
      {studentPayments.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-display font-semibold text-foreground mb-4">Payment History ({ACADEMIC_YEAR})</h3>
          <div className="space-y-3">
            {[...studentPayments]
              .sort((a, b) => {
                const monthDelta = ACADEMIC_MONTHS.findIndex(entry => entry.name === a.month) - ACADEMIC_MONTHS.findIndex(entry => entry.name === b.month);
                if (monthDelta !== 0) return monthDelta;
                return new Date(b.paidAt || b.timestamp || b.date).getTime() - new Date(a.paidAt || a.timestamp || a.date).getTime();
              })
              .map(record => {
                const totalPaid = Number(record.amount || record.totalPaid || 0);
                if (totalPaid <= 0) return null;
                
                return (
                  <div
                    key={record.id}
                    className="bg-muted/30 rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => {
                      setReceiptMonth(record.month);
                      setReceiptPaymentId(record.id);
                      setShowReceipt(true);
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">{formatPaymentMonth(record.month)}</span>
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${record.status === 'paid' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                            {record.status}
                          </span>
                          <span className="text-sm font-bold text-foreground">₹{totalPaid.toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{formatPaymentTimestamp(record.paidAt || record.timestamp || record.updatedAt || record.date)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {!simplified && (
        <div className="bg-card rounded-xl border border-border p-5 overflow-x-auto">
          <h3 className="font-display font-semibold text-foreground mb-4">Marks Detail</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 text-muted-foreground font-medium">Subject</th>
                <th className="text-left py-2 text-muted-foreground font-medium">Exam</th>
                <th className="text-right py-2 text-muted-foreground font-medium">Marks</th>
                <th className="text-right py-2 text-muted-foreground font-medium">%</th>
              </tr>
            </thead>
            <tbody>
              {marks.map(m => {
                const pct = Math.round((m.marksObtained / m.totalMarks) * 100);
                return (
                  <tr key={m.id} className="border-b border-border/50">
                    <td className="py-2 text-foreground">{m.subject}</td>
                    <td className="py-2 text-muted-foreground">{m.examType}</td>
                    <td className="py-2 text-right text-foreground">{m.marksObtained}/{m.totalMarks}</td>
                    <td className={`py-2 text-right font-medium ${pct >= 75 ? 'text-success' : pct >= 50 ? 'text-warning' : 'text-destructive'}`}>{pct}%</td>
                  </tr>
                );
              })}
              {unpublishedExams.map(e => (
                <tr key={e.id} className="border-b border-border/50 opacity-60">
                  <td className="py-2 text-muted-foreground">All Subjects</td>
                  <td className="py-2 text-muted-foreground">{e.name}</td>
                  <td colSpan={2} className="py-2 text-right italic text-muted-foreground">Results not published</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Receipt Modal Overlay */}
      {showReceipt && createPortal(
        <AnimatePresence>
          {showReceipt && (
          <>
            <style dangerouslySetInnerHTML={{ __html: `
              @media print {
                @page {
                  size: A4 portrait;
                  margin: 8mm 10mm;
                }
                * {
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                  color-adjust: exact !important;
                }
                body {
                  margin: 0 !important;
                  padding: 0 !important;
                  background: white !important;
                }
                body > *:not(#receipt-overlay-root) {
                  display: none !important;
                }
                #receipt-overlay-root {
                  display: block !important;
                  width: 100% !important;
                  height: auto !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  position: static !important;
                }
                #receipt-overlay {
                  position: static !important;
                  background: white !important;
                  backdrop-filter: none !important;
                  display: block !important;
                  padding: 0 !important;
                }
                #receipt-content-to-print {
                  display: block !important;
                  width: 100% !important;
                  max-width: 100% !important;
                  border: none !important;
                  box-shadow: none !important;
                  margin: 0 !important;
                  border-radius: 0 !important;
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                }
                .no-print { display: none !important; }
                .bg-slate-900 {
                  background-color: #0f172a !important;
                  -webkit-print-color-adjust: exact !important;
                }
              }
            `}} />
            <div id="receipt-overlay-root">
              <motion.div
                id="receipt-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-md flex items-center justify-center p-4 print:p-0 print:bg-white print:static print:block"
              >
                <motion.div
                  id="receipt-content-to-print"
                  initial={{ scale: 0.95, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  className="bg-white w-full max-w-[680px] border border-border rounded-3xl shadow-2xl overflow-hidden print:rounded-none print:max-w-none print:shadow-none"
                >
                  {/* Toolbar — hidden on print */}
                  <div className="p-3 bg-muted/30 border-b border-border flex items-center justify-between print:hidden no-print">
                    <div className="flex items-center gap-2">
                       <FileText className="w-4 h-4 text-primary" />
                       <h3 className="font-display font-bold text-foreground text-xs uppercase tracking-widest">Fee Receipt Preview</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => window.print()}
                            className="h-8 px-3 bg-primary text-white text-xs font-black uppercase rounded-xl hover:opacity-90 transition-all flex items-center gap-2 shadow-lg shadow-primary/20"
                        >
                            <Printer className="w-3.5 h-3.5" /> Print Receipt
                        </button>
                        <button onClick={() => setShowReceipt(false)} className="h-8 w-8 flex items-center justify-center hover:bg-muted rounded-xl transition-colors">
                            <X className="w-4 h-4 text-muted-foreground" />
                        </button>
                    </div>
                  </div>

                  {/* Receipt Body */}
                  <div className="p-8 print:p-6 font-sans text-slate-900 bg-white">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-6 pb-5 border-b-2 border-slate-100">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                            <div className="w-9 h-9 bg-[#1a2744] rounded-xl flex items-center justify-center">
                                <img src="/Favicon.png" alt="SchoolPulse" className="w-5 h-5 object-contain" onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }} />
                            </div>
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight">SchoolPulse</h1>
                        </div>
                        <p className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.3em] ml-1">Official Payment Voucher</p>
                      </div>
                      <div className="text-right">
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 inline-block">
                            <p className="text-[9px] font-black text-slate-400 uppercase mb-0.5">Transaction ID</p>
                            <p className="text-xs font-mono font-bold text-slate-800">{selectedReceiptTransaction?.id || 'TRX-PENDING'}</p>
                            <p className="text-[8px] font-bold text-slate-400 mt-0.5 uppercase italic">Generated via SchoolPulse ERP</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-12 gap-6">
                      {/* Left Column */}
                      <div className="col-span-12 md:col-span-7 space-y-5">
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Recipient Details</p>
                          <div className="space-y-1">
                            <p className="text-2xl font-black text-slate-900 leading-tight">{student.name}</p>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg uppercase">
                                    {getClassName(student.classId, storeClasses)} · {student.section}
                                </span>
                                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Roll: {student.rollNumber || student.id}</span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6 py-5 border-y-2 border-slate-50">
                          <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Billing Period</p>
                            <p className="text-base font-black text-slate-800">{receiptMonth} {ACADEMIC_YEAR.split('-')[0]}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Payment Status</p>
                            <div className="flex items-center gap-1.5">
                                <div className={`w-2 h-2 rounded-full ${receiptSummary.status === 'paid' ? 'bg-green-500' : 'bg-amber-500'}`} />
                                <p className={`text-base font-black uppercase tracking-tight ${receiptSummary.status === 'paid' ? 'text-green-600' : 'text-amber-600'}`}>
                                    {receiptSummary.status === 'paid' ? 'Fully Settled' : 'Partial Payment'}
                                </p>
                            </div>
                          </div>
                        </div>

                        <div className="pt-1">
                          <p className="text-[10px] font-bold text-slate-500 italic max-w-xs">
                            "Education is the most powerful weapon which you can use to change the world."
                          </p>
                          <div className="mt-6 flex gap-4">
                             <div className="flex-1">
                                <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-5">Parent Signature</p>
                                <div className="border-b border-slate-200 w-28" />
                             </div>
                             <div className="flex-1">
                                <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-5">Accountant Seal</p>
                                <div className="border-b border-slate-200 w-28" />
                             </div>
                          </div>
                        </div>
                      </div>

                      {/* Right Column — Dark financial card */}
                      <div className="col-span-12 md:col-span-5">
                        <div className="bg-slate-900 text-white rounded-[1.5rem] p-5 shadow-2xl relative overflow-hidden h-full flex flex-col justify-between">
                          <div className="relative z-10 space-y-5">
                            <div>
                                <h4 className="text-[10px] font-black uppercase text-indigo-400 tracking-[0.15em] mb-3">Financial Summary</h4>
                                <div className="space-y-2.5">
                                    <div className="flex justify-between items-center opacity-60">
                                        <span className="text-[11px] font-bold uppercase tracking-wider">Base Tuition</span>
                                        <span className="text-xs font-black italic tracking-tight">₹{receiptSummary.baseFee.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center opacity-60">
                                        <span className="text-[11px] font-bold uppercase tracking-wider">Transport Fee</span>
                                        <span className="text-xs font-black italic tracking-tight">₹{receiptSummary.busFee.toLocaleString()}</span>
                                    </div>
                                    <div className="h-px bg-white/10 my-2" />
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Total Monthly Fee</span>
                                        <span className="text-lg font-black italic tracking-tighter text-indigo-100">₹{receiptSummary.totalFee.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <div className="bg-white/10 rounded-xl p-4 border border-white/5 backdrop-blur-sm">
                                    <p className="text-[9px] font-black uppercase text-indigo-300 tracking-[0.15em] mb-1">Amount Paid Now</p>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-xs font-bold text-white/60 italic">₹</span>
                                        <span className="text-3xl font-black tracking-tighter text-white">{receiptSummary.paid.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <p className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.15em]">Transaction History</p>
                                <div className="space-y-1.5">
                                    {receiptTransactions.length > 0 ? receiptTransactions.map((payment, idx) => (
                                      <div key={payment.id} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-1.5 text-[10px] border border-white/5">
                                        <div>
                                          <p className="font-black text-white italic">₹{Number(payment.amount || 0).toLocaleString()}</p>
                                          <p className="text-[8px] font-bold text-white/40">
                                            {formatPaymentTimestamp(payment.paidAt || payment.timestamp || payment.date)}
                                          </p>
                                        </div>
                                        <div className="text-right">
                                            <span className="px-1.5 py-0.5 bg-white/10 rounded-full font-black text-[7px] uppercase">{payment.month} ({idx + 1})</span>
                                        </div>
                                      </div>
                                    )) : (
                                      <p className="text-[9px] italic text-white/30 text-center py-3">No payments found.</p>
                                    )}
                                </div>
                            </div>
                          </div>

                          <div className="absolute top-0 right-0 w-36 h-36 bg-indigo-500/10 rounded-full -mr-18 -mt-18 pointer-events-none" />
                          <div className="absolute bottom-0 left-0 w-24 h-24 bg-indigo-500/10 rounded-full -ml-12 -mb-12 pointer-events-none" />
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-8 pt-5 border-t border-slate-100 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-[#1a2744] rounded-xl flex items-center justify-center">
                                <img src="/Favicon.png" alt="SchoolPulse" className="w-5 h-5 object-contain" onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }} />
                            </div>
                            <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Date of Issue</p>
                                <p className="text-xs font-black text-slate-800 uppercase italic">
                                    {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-[8px] font-bold text-slate-300 mb-1 italic">Scan for authenticity</p>
                            <div className="w-8 h-8 border border-slate-100 rounded bg-slate-50 mx-auto opacity-40 ml-auto" />
                        </div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            </div>
          </>
          )}

        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};

export default StudentProfile;


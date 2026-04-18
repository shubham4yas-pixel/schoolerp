import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import AppLayout from '@/components/AppLayout';
import { motion, AnimatePresence } from 'framer-motion';
import StatCard from '@/components/StatCard';
import StudentProfile from '@/components/StudentProfile';
import PeerComparison from '@/components/PeerComparison';
import DataEntryForms from '@/components/DataEntryForms';
import ClassConsole from '@/components/ClassConsole';
import ClassSectionFilter from '@/components/ClassSectionFilter';
import StudentSearch from '@/components/StudentSearch';
import BusManagement from '@/components/BusManagement';
import CredentialManager from '@/components/CredentialManager';
import FileUpload from '@/components/FileUpload';
import FeeSettings from '@/components/FeeSettings';
import AcademicSettings from '@/components/AcademicSettings';
import ProfileErrorBoundary from '@/components/ProfileErrorBoundary';
import StudentAvatar from '@/components/StudentAvatar';
import { useAuth } from '@/contexts/AuthContext';
import { useStore } from '@/store/useStore';
import {
  getOverallPercentage,
  getAttendancePercentage,
  getStudentPendingStatus,
  getStudentsByClassSection,
  getSystemAlerts,
  getUniqueClasses,
  searchStudents,
  getClassName,
  getAcademicContext
} from '@/lib/data-utils';
import { Student } from '@/lib/types';
import { Users, TrendingUp, Calendar, IndianRupee, AlertTriangle, BarChart3, LayoutDashboard, ClipboardList, Search, Bus, Key, Upload, Loader2, Filter, Settings, BookOpen, Send, Copy, Download, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { filterTabs, canViewTab } from '@/lib/rbac-utils';

type AdminTab = 'overview' | 'console' | 'compare' | 'forms' | 'search' | 'bus' | 'credentials' | 'upload' | 'settings' | 'academic_settings';

type QuickFilter = 'all' | 'lowattendance' | 'feespending' | 'topperformers' | 'bususers' | 'feepaid' | 'feepartial' | 'feeunpaid' | string;


const AdminDashboard = () => {
  const {
    students, marks, attendance, feeConfigs, subjects, payments, feeSettings, loading,
    globalFilterSearch: search, setGlobalFilterSearch: setSearch,
    globalFilterClass: compareClass, setGlobalFilterClass: setCompareClass,
    globalFilterSection: compareSection, setGlobalFilterSection: setCompareSection,
    classes: storeClasses
  } = useStore();
  const { role: userRole, setRole: setUserRole, schoolId } = useAuth();
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  // Compare tab state
  const [compareMetric, setCompareMetric] = useState<'marks' | 'attendance' | 'fees'>('marks');
  const [selectedCompareIds, setSelectedCompareIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [reminderStudents, setReminderStudents] = useState<Student[]>([]);
  const [copied, setCopied] = useState(false);
  const ITEMS_PER_PAGE = 25;

  // Set initial compare selection when data loads
  useEffect(() => {
    if (students.length > 0 && selectedCompareIds.length === 0) {
      setSelectedCompareIds([students[0].id]);
    }
  }, [students]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, quickFilter]);

  // RBAC Guard: If role changes or tab becomes restricted, fallback to overview
  useEffect(() => {
    if (userRole && !canViewTab(userRole, activeTab)) {
      setActiveTab('overview');
    }
  }, [userRole, activeTab]);

  const [isDataTimeout, setIsDataTimeout] = useState(false);

  // Safety timeout for loading state
  useEffect(() => {
    if (loading.students || loading.marks) {
      const timer = setTimeout(() => setIsDataTimeout(true), 5000);
      return () => clearTimeout(timer);
    }
  }, [loading.students, loading.marks]);

  const totalStudents = students.length;
  const avgPerformance = useMemo(() => {
    if (!students || students.length === 0) return 0;
    return Math.round(students.reduce((s, st) => s + getOverallPercentage(st.id, marks), 0) / (totalStudents || 1));
  }, [students, marks, totalStudents]);

  const avgAttendance = useMemo(() => {
    if (!students || students.length === 0 || !attendance) return 0;
    return Math.round(students.reduce((s, st) => s + getAttendancePercentage(st.id, attendance), 0) / (totalStudents || 1));
  }, [students, attendance, totalStudents]);

  const { currentMonthIndex, academicYear: ACADEMIC_YEAR } = useMemo(() => getAcademicContext(), []);

  const systemAlerts = useMemo(() => {
    if (!students || students.length === 0) return [];
    return getSystemAlerts(students, marks, attendance, payments, feeSettings, currentMonthIndex, ACADEMIC_YEAR);
  }, [students, marks, attendance, payments, feeSettings, currentMonthIndex, ACADEMIC_YEAR]);

  // Centralized Financial Calculations - Derived strictly from 'payments' collection
  const financialStats = useMemo(() => {
    let paidCount = 0;
    let partialCount = 0;
    let unpaidCount = 0;
    let totalExpected = 0;
    let totalPaid = 0;

    const statusMap: Record<string, { status: 'paid' | 'partial' | 'unpaid'; paid: number; total: number; due: number; monthlyFee: number; isPending: boolean }> = {};

    if (!students) return { totalExpected: 0, totalPaid: 0, pendingAmount: 0, countPaid: 0, countPartial: 0, countUnpaid: 0, statusMap };

    students.forEach(s => {
      const pendingStatus = getStudentPendingStatus(s, payments, feeSettings, currentMonthIndex, ACADEMIC_YEAR);
      const studentTotalFee = Number(pendingStatus.expectedFee || 0);
      const studentTotalPaid = Number(pendingStatus.paid || 0);
      const outstanding = Number(pendingStatus.due || 0);
      const status = pendingStatus.status;

      // STEP 5 — COUNT CORRECTLY
      if (status === "paid") paidCount++;
      if (status === "partial") partialCount++;
      if (status === "unpaid") unpaidCount++;

      totalExpected += studentTotalFee;
      totalPaid += studentTotalPaid;

      statusMap[s.id] = {
        status,
        paid: studentTotalPaid,
        total: studentTotalFee,
        due: outstanding,
        monthlyFee: Number(pendingStatus.monthlyFee || 0),
        isPending: pendingStatus.isPending,
      };
    });

    const pendingAmount = Math.max(0, totalExpected - totalPaid);

    // STEP 6 — FIX ₹NaN IN DASHBOARD
    return { 
      totalExpected: isNaN(totalExpected) ? 0 : totalExpected, 
      totalPaid: isNaN(totalPaid) ? 0 : totalPaid, 
      pendingAmount: isNaN(pendingAmount) ? 0 : pendingAmount, 
      countPaid: paidCount, 
      countPartial: partialCount, 
      countUnpaid: unpaidCount, 
      statusMap 
    };
  }, [students, payments, feeSettings, currentMonthIndex, ACADEMIC_YEAR]);

  const paidCount = financialStats.countPaid;
  const partialCount = financialStats.countPartial;
  const unpaidCount = financialStats.countUnpaid;

  const weakStudents = useMemo(() => {
    if (!students) return [];
    return students.filter(s => {
      const pct = getOverallPercentage(s.id, marks);
      return pct > 0 && pct < 60;
    });
  }, [students, marks]);

  const classData = useMemo(() => {
    if (!students) return [];
    return Array.from(new Set((students || []).map(s => s.classId))).sort().map(c => {
      const cls = (students || []).filter(s => s.classId === c);
      const avg = cls.length > 0 ? Math.round(cls.reduce((s, st) => s + getOverallPercentage(st.id, marks), 0) / cls.length) : 0;
      return { class: getClassName(c, storeClasses), average: avg };
    });
  }, [students, marks, storeClasses]);

  const feeData = useMemo(() => [
    { name: 'Paid', value: paidCount },
    { name: 'Partial', value: partialCount },
    { name: 'Unpaid', value: unpaidCount },
  ].filter(d => d.value > 0), [paidCount, partialCount, unpaidCount]);

  const hasFeeData = feeData.some(d => d.value > 0);
  const pieColors = ['hsl(160, 50%, 45%)', 'hsl(38, 92%, 50%)', 'hsl(0, 72%, 55%)'];

  // Quick filter applies on top of text search
  const uniqueClasses = useMemo(() => getUniqueClasses(students), [students]);
  const quickFiltered = useMemo(() => {
    if (!students) return [];
    let filtered = searchStudents(search, students);

    if (quickFilter !== 'all') {
      if (quickFilter === 'lowattendance') {
        filtered = filtered.filter(s => getAttendancePercentage(s.id, attendance) < 75);
      } else if (quickFilter === 'feespending') {
        filtered = filtered.filter(s => financialStats.statusMap[s.id]?.status !== 'paid');
      } else if (quickFilter === 'topperformers') {
        filtered = filtered.filter(s => getOverallPercentage(s.id, marks) >= 80);
      } else if (quickFilter === 'feepaid') {
        filtered = filtered.filter(s => financialStats.statusMap[s.id]?.status === 'paid');
      } else if (quickFilter === 'feepartial') {
        filtered = filtered.filter(s => financialStats.statusMap[s.id]?.status === 'partial');
      } else if (quickFilter === 'feeunpaid') {
        filtered = filtered.filter(s => financialStats.statusMap[s.id]?.status === 'unpaid');
      } else if (quickFilter === 'bususers') {
        filtered = filtered.filter(s => s?.bus?.opted === true || s?.bus?.enabled === true);
      } else {
        filtered = filtered.filter(s => s.classId === quickFilter);
      }
    }
    return filtered;
  }, [search, students, marks, attendance, feeConfigs, quickFilter, financialStats]);

  const totalPages = Math.ceil(quickFiltered.length / ITEMS_PER_PAGE);
  const paginatedStudents = useMemo(() => {
    if (!quickFiltered) return [];
    return quickFiltered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  }, [quickFiltered, currentPage]);

  // Compare tab
  const compareStudents = useMemo(() => {
    if (!students) return [];
    let pool = compareClass ? getStudentsByClassSection(students, compareClass, compareSection || undefined) : students;
    return pool.sort((a, b) => {
      if (compareMetric === 'marks') return getOverallPercentage(b.id, marks) - getOverallPercentage(a.id, marks);
      if (compareMetric === 'attendance') return getAttendancePercentage(b.id, attendance) - getAttendancePercentage(a.id, attendance);
      return (financialStats.statusMap[b.id]?.due || 0) - (financialStats.statusMap[a.id]?.due || 0);
    });
  }, [students, marks, attendance, compareClass, compareSection, compareMetric, financialStats]);

  const adminTabs: { id: AdminTab; label: string; icon: React.ReactNode }[] = useMemo(() => {
    const tabs: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
      { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
      { id: 'console', label: 'Class Console', icon: <Users className="w-4 h-4" /> },
      { id: 'forms', label: 'Data Entry', icon: <ClipboardList className="w-4 h-4" /> },
      { id: 'upload', label: 'Upload Sheets', icon: <Upload className="w-4 h-4" /> },
      { id: 'search', label: 'Student Search', icon: <Search className="w-4 h-4" /> },
      { id: 'compare', label: 'Compare & Analyse', icon: <BarChart3 className="w-4 h-4" /> },
      { id: 'bus', label: 'Bus Transport', icon: <Bus className="w-4 h-4" /> },
      { id: 'academic_settings', label: 'Academic Settings', icon: <BookOpen className="w-4 h-4" /> },
      { id: 'settings', label: 'Fee Settings', icon: <Settings className="w-4 h-4" /> },
      { id: 'credentials', label: 'Credentials', icon: <Key className="w-4 h-4" /> },
    ];

    return filterTabs(userRole || 'admin', tabs);
  }, [userRole]);

  // Handle early returns AFTER all hooks
  if ((loading.students || loading.marks) && !isDataTimeout) {
    return (
      <AppLayout title="School Overview">
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="text-muted-foreground font-medium">Loading real-time school data...</p>
        </div>
      </AppLayout>
    );
  }

  if (selectedStudent) {
    return (
      <ProfileErrorBoundary onReset={() => setSelectedStudent(null)}>
        <AppLayout title="Student Profile">
          <StudentProfile student={selectedStudent} onBack={() => setSelectedStudent(null)} />
        </AppLayout>
      </ProfileErrorBoundary>
    );
  }
  const toggleCompare = (id: string) => {
    setSelectedCompareIds(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : prev.length < 4 ? [...prev, id] : prev
    );
  };

  return (
    <AppLayout title="School Overview">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8 mt-2">
        <div>
          <h1 className="text-4xl font-display font-bold text-foreground tracking-tighter">
            School<span className="text-primary italic">Pulse</span> ERP
          </h1>
          <p className="text-muted-foreground mt-1 font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            Live Educational Intelligence Dashboard
          </p>
        </div>

      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        {adminTabs.map(tab => (
          <button key={tab.id} onClick={() => {
            if (tab.id === 'forms') {
              localStorage.setItem('active_data_form', 'student');
            }
            setActiveTab(tab.id);
          }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${activeTab === tab.id
              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30 -translate-y-0.5'
              : 'bg-card border border-border text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'console' && <ClassConsole onStudentClick={(s) => setSelectedStudent(s)} />}
      {activeTab === 'forms' && <DataEntryForms />}
      {activeTab === 'search' && <StudentSearch />}
      {activeTab === 'bus' && <BusManagement />}
      {activeTab === 'academic_settings' && <AcademicSettings schoolId={schoolId} />}
      {activeTab === 'settings' && <FeeSettings schoolId={schoolId} />}
      {activeTab === 'credentials' && <CredentialManager />}

      {activeTab === 'upload' && (
        <div className="bg-card rounded-2xl border border-border p-8 shadow-soft">
          <FileUpload />
        </div>
      )}

      {activeTab === 'compare' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex flex-wrap gap-4 items-end">
              <ClassSectionFilter
                students={students}
                useGlobal
                compact
              />
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Sort by</label>
                <select value={compareMetric} onChange={e => setCompareMetric(e.target.value as any)}
                  className="px-3 py-2 text-sm bg-muted/50 border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="marks">Marks</option>
                  <option value="attendance">Attendance</option>
                  <option value="fees">Outstanding Fees</option>
                </select>
              </div>
              <p className="text-xs text-muted-foreground ml-auto self-center font-medium">Select up to 4 students</p>
            </div>

            {/* Student list to select */}
            <div className="flex flex-wrap gap-2 mt-4">
              {compareStudents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No students match this filter.</p>
              ) : (compareStudents || []).map(s => {
                const pct = getOverallPercentage(s.id, marks);
                const isSelected = (selectedCompareIds || []).includes(s.id);
                return (
                  <button key={s.id} onClick={() => toggleCompare(s.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${isSelected
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                      }`}>
                    {s.name}
                    <span className={`text-xs ${isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>({pct}%)</span>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedCompareIds.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">Select a student above to start analysis.</div>
          ) : (
            <div className="space-y-4">
              {selectedCompareIds.map(id => {
                const s = students.find(st => st.id === id);
                return s ? <PeerComparison key={id} student={s} viewerRole="admin" /> : null;
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'overview' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div onClick={() => setActiveTab('search')} className="cursor-pointer transition-transform hover:-translate-y-0.5">
              <StatCard label={compareClass ? 'Class Students' : 'Total Students'} value={totalStudents} icon={Users} />
            </div>
            <div onClick={() => setActiveTab('compare')} className="cursor-pointer transition-transform hover:-translate-y-0.5">
              <StatCard label="Avg Performance" value={`${avgPerformance}%`} icon={TrendingUp} variant="success" />
            </div>
            <div onClick={() => setActiveTab('console')} className="cursor-pointer transition-transform hover:-translate-y-0.5">
              <StatCard label="Avg Attendance" value={`${avgAttendance}%`} icon={Calendar} variant={avgAttendance >= 85 ? 'success' : 'warning'} />
            </div>
            <div onClick={() => { localStorage.setItem('active_data_form', 'fees'); setActiveTab('forms'); }} className="cursor-pointer transition-transform hover:-translate-y-0.5">
              <StatCard label="Outstanding Fees" value={`₹${financialStats.pendingAmount.toLocaleString()}`} trend={`${financialStats.countPartial + financialStats.countUnpaid} students pending`} icon={IndianRupee} variant={financialStats.pendingAmount > 0 ? 'destructive' : 'success'} />
            </div>
          </div>

          {/* System Alerts Section */}
          {systemAlerts.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
              {(systemAlerts || []).map(alert => (
                <div key={alert.id} className={`flex items-center gap-3 p-3 rounded-xl border ${alert.severity === 'destructive' ? 'bg-destructive/5 border-destructive/20 text-destructive' : 'bg-warning/5 border-warning/20 text-warning'
                  }`}>
                  <div className={`p-2 rounded-lg ${alert.severity === 'destructive' ? 'bg-destructive/10' : 'bg-warning/10'}`}>
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold uppercase tracking-tight opacity-70">{alert.type}</p>
                    <p className="text-sm font-semibold truncate">{alert.message}</p>
                  </div>
                  <button
                    onClick={() => setActiveTab('search')}
                    className="text-[10px] font-bold underline px-2 py-1 hover:opacity-70 transition-opacity">
                    VIEW
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Fee Status Filter Strip */}
          <div className="flex flex-wrap gap-3 mb-6">
            {[
              { key: 'feepaid', label: 'Paid', count: paidCount, color: 'success' },
              { key: 'feepartial', label: 'Partial', count: partialCount, color: 'warning' },
              { key: 'feeunpaid', label: 'Unpaid', count: unpaidCount, color: 'destructive' },
            ].map(({ key, label, count, color }) => {
              const isActive = quickFilter === key;
              const colorMap: Record<string, string> = {
                success: isActive ? 'bg-success text-white border-success' : 'bg-success/10 text-success border-success/30 hover:bg-success/20',
                warning: isActive ? 'bg-warning text-white border-warning' : 'bg-warning/10 text-warning border-warning/30 hover:bg-warning/20',
                destructive: isActive ? 'bg-destructive text-white border-destructive' : 'bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20',
              };
              return (
                <button
                  key={key}
                  onClick={() => setQuickFilter(isActive ? 'all' : key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-semibold text-sm transition-all duration-200 ${colorMap[color]}`}
                >
                  <span>{label}</span>
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${isActive ? 'bg-white/20' : 'bg-black/10'}`}>{count}</span>
                </button>
              );
            })}
            {['feepaid', 'feepartial', 'feeunpaid'].includes(quickFilter) && (
              <button
                onClick={() => setQuickFilter('all')}
                className="px-3 py-2 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-xl transition-colors"
              >
                Clear filter
              </button>
            )}

            <button
              onClick={() => {
                const list = students.filter(s => {
                  return financialStats.statusMap[s.id]?.isPending;
                });
                setReminderStudents(list);
                console.log("Reminder Students:", list);
                toast.success(`${list.length} reminder candidates identified.`);
              }}
              className="ml-auto flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-indigo-100 transition-all shadow-sm"
            >
              <Send className="w-3.5 h-3.5" /> Generate Reminders
            </button>
          </div>

          <AnimatePresence>
            {reminderStudents.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-8"
              >
                <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <h3 className="font-bold text-foreground">Reminder List ({reminderStudents.length})</h3>
                      <button
                        onClick={() => {
                          const text = reminderStudents.map(s => {
                            const summary = financialStats.statusMap[s.id];
                            const cls = getClassName(s.classId, storeClasses);
                            return `Dear Parent, ₹${summary?.due || 0} fee for ${s.name} (${cls}) is pending. Kindly clear it.`;
                          }).join('\n\n');
                          navigator.clipboard.writeText(text);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold hover:bg-primary/90 transition-all"
                      >
                        <Copy className="w-3.5 h-3.5" /> Copy All Messages
                      </button>
                      {copied && <span className="text-[10px] font-bold text-success animate-in fade-in slide-in-from-left-2">Copied to clipboard</span>}
                    </div>
                    <button onClick={() => setReminderStudents([])} className="text-xs font-bold text-muted-foreground hover:text-foreground">Close</button>
                  </div>
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {reminderStudents.map(s => {
                      const summary = financialStats.statusMap[s.id];
                      const cls = getClassName(s.classId, storeClasses);
                      const msg = `Dear Parent, ₹${summary?.due || 0} fee for ${s.name} (${cls}) is pending. Kindly clear it.`;
                      return (
                        <div key={s.id} className="p-3 bg-muted/20 border border-border rounded-lg space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-bold text-sm">{s.name}</p>
                              <p className="text-[10px] text-muted-foreground uppercase font-semibold">{cls} • ID: {s.id}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] uppercase font-black text-muted-foreground opacity-60">Amount Pending</p>
                              <p className="text-sm font-black text-destructive">₹{summary?.due || 0}</p>
                            </div>
                          </div>
                          <div className="px-3 py-2 bg-background border border-indigo-100 rounded-lg text-[11px] text-indigo-900 font-medium italic select-all">
                            {msg}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Quick filter bar */}
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mr-1">
              <Filter className="w-3.5 h-3.5" /> Filter:
            </div>
            {[
              { key: 'all', label: 'All Students' },
              ...(storeClasses || []).map(c => ({ key: String(c.classId), label: c.name })),
              { key: 'topperformers', label: 'Top Performers' },
              { key: 'lowattendance', label: 'Attendance Risk' },
              { key: 'feespending', label: 'Outstanding Fees' },
              { key: 'bususers', label: 'Bus Users' },
            ].map(f => (
              <button key={f.key} onClick={() => setQuickFilter(f.key)}
                className={`px-3 py-1.5 text-xs rounded-full font-medium transition-all ${quickFilter === f.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}>
                {f.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="font-display font-semibold text-foreground mb-4">Class-wise Performance</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={classData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="class" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                  <Bar dataKey="average" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-card rounded-xl border border-border p-5 overflow-visible">
              <h3 className="font-display font-semibold text-foreground mb-4">Fee Status</h3>
              <div className="flex items-center justify-center w-full">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart margin={{ top: 15, right: 15, bottom: 15, left: 15 }}>
                    <Pie
                      data={feeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                      labelLine={{ strokeWidth: 1, strokeOpacity: 0.5 }}
                    >
                      {feeData.map((_, i) => <Cell key={i} fill={pieColors[i]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {weakStudents.length > 0 && (
            <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-5 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                <h3 className="font-display font-semibold text-foreground">Students Needing Attention</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {(weakStudents || []).map(s => (
                  <button key={s.id} onClick={() => setSelectedStudent(s)} className="px-3 py-1.5 bg-card border border-border rounded-lg text-sm text-foreground hover:border-destructive/40 transition-colors">
                    {s.name} ({getOverallPercentage(s.id, marks)}%)
                  </button>
                ))}
              </div>
            </div>
          )}

          <div id="students-table-section" className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h3 className="font-display font-semibold text-foreground">All Students</h3>
                <span className="text-xs font-medium px-2 py-0.5 bg-muted rounded-full text-muted-foreground">{quickFiltered.length}</span>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="text" placeholder="Search students..." value={search} onChange={e => setSearch(e.target.value)}
                  className="pl-9 pr-4 py-2 text-sm bg-muted/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 text-muted-foreground font-medium">Student</th>
                    <th className="text-left py-2 text-muted-foreground font-medium hidden sm:table-cell">Class</th>
                    <th className="text-right py-2 text-muted-foreground font-medium">Performance</th>
                    <th className="text-right py-2 text-muted-foreground font-medium hidden sm:table-cell">Attendance</th>
                    <th className="text-right py-2 text-muted-foreground font-medium hidden md:table-cell">Fees</th>
                  </tr>
                </thead>
                <tbody>
                  {(paginatedStudents || []).map(s => {
                    const pct = getOverallPercentage(s.id, marks);
                    const att = getAttendancePercentage(s.id, attendance);
                    const feeStatus = financialStats.statusMap[s.id] || { status: 'unpaid', paid: 0, total: 0 };
                    const feeLabel = feeStatus.status === 'paid' ? 'Paid' : feeStatus.status === 'partial' ? 'Partial' : 'Unpaid';
                    const feeBadgeClass = feeStatus.status === 'paid'
                      ? 'bg-success/10 text-success'
                      : feeStatus.status === 'partial'
                        ? 'bg-warning/10 text-warning'
                        : 'bg-destructive/10 text-destructive';
                    return (
                      <tr key={s.id} onClick={() => setSelectedStudent(s)} className="border-b border-border/50 cursor-pointer hover:bg-muted/30 transition-colors">
                        <td className="py-3">
                          <div className="flex items-center gap-3">
                            <StudentAvatar
                              student={s}
                              className="w-8 h-8 rounded-lg"
                              initialsClassName="text-xs font-bold text-primary-foreground"
                            />
                            <div>
                              <div className="font-medium text-foreground">{s.name || "Unknown"}</div>
                              <div className="text-xs text-muted-foreground sm:hidden">{getClassName(s.classId, storeClasses)}-{s.section || "N/A"}</div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 text-muted-foreground hidden sm:table-cell">{getClassName(s.classId, storeClasses)}-{s.section}</td>
                        <td className={`py-3 text-right font-medium ${pct >= 75 ? 'text-success' : pct >= 50 ? 'text-warning' : 'text-destructive'}`}>{pct}%</td>
                        <td className={`py-3 text-right hidden sm:table-cell ${att >= 85 ? 'text-success' : 'text-warning'}`}>{att}%</td>
                        <td className="py-3 text-right hidden md:table-cell">
                          <div className="flex flex-col items-end gap-0.5">
                            <span className={`px-2 py-1 rounded-md text-xs font-medium ${feeBadgeClass}`}>{feeLabel}</span>
                            {feeStatus.total > 0 && (
                              <span className="text-xs text-muted-foreground">₹{feeStatus.paid}/{feeStatus.total}</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {(!quickFiltered || quickFiltered.length === 0) && (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-muted-foreground font-medium">No students match this filter.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
                <p className="text-xs text-muted-foreground">
                  Showing <span className="font-medium text-foreground">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="font-medium text-foreground">{Math.min(currentPage * ITEMS_PER_PAGE, quickFiltered.length)}</span> of {quickFiltered.length} students
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                    className="p-1 px-3 text-[11px] font-bold bg-muted text-muted-foreground rounded-lg hover:bg-muted-foreground/10 disabled:opacity-50 transition-colors uppercase tracking-wider">
                    Prev
                  </button>
                  <div className="flex items-center gap-1.5 px-3">
                    <span className="text-xs font-bold text-foreground">{currentPage}</span>
                    <span className="text-xs text-muted-foreground">/</span>
                    <span className="text-xs text-muted-foreground">{totalPages}</span>
                  </div>
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                    className="p-1 px-3 text-[11px] font-bold bg-muted text-muted-foreground rounded-lg hover:bg-muted-foreground/10 disabled:opacity-50 transition-colors uppercase tracking-wider">
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </AppLayout>
  );
};

export default AdminDashboard;

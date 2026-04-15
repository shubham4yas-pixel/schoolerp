import { useEffect, useMemo, useRef, useState } from 'react';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { createUserWithEmailAndPassword, getAuth, sendPasswordResetEmail, signOut as firebaseSignOut } from 'firebase/auth';
import { collection, doc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { AlertCircle, Check, Key, Loader2, Plus, Save, Search, Send, Shield, Trash2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { auth, db, firebaseConfig } from '@/lib/firebase';
import { sanitize } from '@/lib/data-utils';
import { AppUser, LoginCredential, Student, UserRole, ClassConfig } from '@/lib/types';
import { useStore } from '@/store/useStore';

const BULK_CREDENTIALS_APP = 'schoolpulse-credentials-bulk';

interface StagedCredentialRow {
  id: string;
  name: string;
  email: string;
  role: string;
  className: string;
  classId: string;
  section: string;
  studentId: string;
  parentEmail: string;
  phone?: string;
  transport?: string;
  address?: string;
  linkedStudentId?: string;
  rollNumber?: string;
  errors: string[];
  saved: boolean;
  uid?: string;
}

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'accountant', label: 'Accountant' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'student', label: 'Student' },
  { value: 'parent', label: 'Parent' },
];

const REQUIRED_TEMPLATE_COLUMNS = [
  'Name',
  'Email',
  'Role',
  'Class',
  'Section',
  'StudentId',
  'ParentEmail',
] as const;

const OPTIONAL_TEMPLATE_COLUMNS = [
  'Phone',
  'Transport',
  'Address',
] as const;

const ALL_TEMPLATE_COLUMNS = [
  ...REQUIRED_TEMPLATE_COLUMNS,
  ...OPTIONAL_TEMPLATE_COLUMNS,
];

const TEMPLATE_SAMPLE_ROW = [
  'Ravi Kumar',
  'ravi@email.com',
  'student',
  'Class 6',
  'A',
  'STU001',
  'parent@email.com',
  '',
  '',
  '',
];

const normalizeText = (value: unknown) => String(value ?? '').trim();
const normalizeEmail = (value: unknown) => normalizeText(value).toLowerCase();

const isUserRole = (value: string): value is UserRole =>
  value === 'admin' ||
  value === 'accountant' ||
  value === 'teacher' ||
  value === 'student' ||
  value === 'parent';

const getSecondaryAuth = () => {
  const secondaryApp = getApps().some(app => app.name === BULK_CREDENTIALS_APP)
    ? getApp(BULK_CREDENTIALS_APP)
    : initializeApp(firebaseConfig, BULK_CREDENTIALS_APP);
  return getAuth(secondaryApp);
};

const generateInitialPassword = () =>
  `Temp${Math.random().toString(36).slice(-8)}A1!`;

const findMatchingClass = (
  rawClass: string,
  classes: ClassConfig[],
) => {
  const value = normalizeText(rawClass).toLowerCase();
  if (!value) return null;
  return classes.find(cls =>
    normalizeText(cls.classId).toLowerCase() === value ||
    normalizeText(cls.name).toLowerCase() === value
  ) || null;
};

const findMatchingStudent = (rawStudentId: string, students: Student[]) => {
  const value = normalizeText(rawStudentId).toLowerCase();
  if (!value) return null;
  return students.find(student =>
    normalizeText(student.id).toLowerCase() === value ||
    normalizeText(student.rollNumber).toLowerCase() === value
  ) || null;
};

const mapUploadRow = (record: Record<string, unknown>, index: number): StagedCredentialRow => ({
  id: `staged_${Date.now()}_${index}`,
  name: normalizeText(record.Name || record.name),
  email: normalizeEmail(record.Email || record.email),
  role: normalizeText(record.Role || record.role).toLowerCase(),
  className: normalizeText(record.Class || record.class),
  classId: '',
  section: normalizeText(record.Section || record.section).toUpperCase(),
  studentId: normalizeText(record.StudentId || record.studentId || record['Student ID']),
  parentEmail: normalizeEmail(record.ParentEmail || record.parentEmail || record['Parent Email']),
  phone: normalizeText(record.Phone || record.phone),
  transport: normalizeText(record.Transport || record.transport),
  address: normalizeText(record.Address || record.address),
  errors: [],
  saved: false,
});

const validateStagedRows = (
  rows: StagedCredentialRow[],
  students: Student[],
  classes: ClassConfig[],
  users: AppUser[],
) => {
  const uploadEmailCount = new Map<string, number>();
  rows.forEach(row => {
    const email = normalizeEmail(row.email);
    if (email) uploadEmailCount.set(email, (uploadEmailCount.get(email) || 0) + 1);
  });

  const existingEmails = new Set(users.map(user => normalizeEmail(user.email)));

  return rows.map(row => {
    const errors: string[] = [];
    const name = normalizeText(row.name);
    const email = normalizeEmail(row.email);
    const role = normalizeText(row.role).toLowerCase();
    const rawClass = normalizeText(row.className);
    const rawSection = normalizeText(row.section).toUpperCase();
    const rawStudentId = normalizeText(row.studentId);
    const matchedClass = findMatchingClass(rawClass, classes);
    const matchedStudent = findMatchingStudent(rawStudentId, students);

    let classId = matchedClass?.classId || '';
    let className = matchedClass?.name || rawClass;
    let section = rawSection;
    let linkedStudentId = row.linkedStudentId;
    let rollNumber = row.rollNumber;

    if (!name) errors.push('Name is required');
    if (!email || !email.includes('@')) errors.push('Valid email is required');
    if (!isUserRole(role)) errors.push('Valid role is required');
    if (row.parentEmail && !row.parentEmail.includes('@')) errors.push('ParentEmail must be valid');
    if (email && !row.saved && existingEmails.has(email)) errors.push('Email already exists');
    if (email && (uploadEmailCount.get(email) || 0) > 1) errors.push('Duplicate email in upload');
    if (rawClass && !matchedClass) errors.push('Class not found');
    if (matchedClass?.sections?.length && rawSection && !matchedClass.sections.includes(rawSection)) {
      errors.push('Section not found in selected class');
    }

    if (role === 'teacher' && !classId) {
      errors.push('Teacher must be linked to a class');
    }

    if (role === 'student' || role === 'parent') {
      if (!rawStudentId) errors.push('Student ID is required');
      if (!matchedStudent) {
        errors.push('Student not found');
      } else {
        linkedStudentId = matchedStudent.id;
        rollNumber = matchedStudent.rollNumber || rawStudentId;
        classId = matchedStudent.classId || classId;
        className = matchedStudent.class || matchedClass?.name || className;
        section = matchedStudent.section || section;
      }
    } else {
      linkedStudentId = undefined;
      rollNumber = undefined;
    }

    return {
      ...row,
      name,
      email,
      role,
      classId,
      className,
      section,
      linkedStudentId,
      rollNumber,
      errors,
    };
  });
};

const createUserProfile = ({
  uid,
  schoolId,
  row,
  emailSent,
}: {
  uid: string;
  schoolId: string;
  row: StagedCredentialRow;
  emailSent: boolean;
}): AppUser => {
  const userProfile: AppUser = {
    uid,
    email: row.email,
    name: row.name,
    role: row.role as UserRole,
    schoolId,
    createdAt: new Date().toISOString(),
    emailSent,
  };

  if (row.classId) userProfile.classId = row.classId;
  if (row.section) userProfile.section = row.section;
  if (row.rollNumber) userProfile.rollNumber = row.rollNumber;

  if (row.role === 'student' || row.role === 'parent') {
    if (row.linkedStudentId) userProfile.linkedStudentId = row.linkedStudentId;
    if (row.role === 'parent' && row.linkedStudentId) {
      userProfile.linkedChildrenIds = [row.linkedStudentId];
    }
  }

  return userProfile;
};

const createLoginCredential = (uid: string, row: StagedCredentialRow): LoginCredential => ({
  id: `CRED_${Date.now()}_${uid}`,
  uid,
  username: row.email,
  role: row.role as UserRole,
  linkedStudentId: row.linkedStudentId || undefined,
  classId: row.classId || undefined,
  name: row.name,
  active: true,
});

const CredentialManager = () => {
  const { schoolId } = useAuth();
  const { students, classes, loginCredentials, loading: storeLoading, addLoginCredential, deleteLoginCredential } = useStore();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [stagedRows, setStagedRows] = useState<StagedCredentialRow[]>([]);
  const [uploadFileName, setUploadFileName] = useState('');
  const [savingBulk, setSavingBulk] = useState(false);
  const [sendingAll, setSendingAll] = useState(false);
  const [importIssues, setImportIssues] = useState<string[]>([]);
  const [showImportErrors, setShowImportErrors] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      if (!db) return;
      try {
        setLoading(true);
        const snapshot = await getDocs(collection(db, 'users'));
        const fetchedUsers = snapshot.docs.map(userDoc => ({
          uid: userDoc.id,
          ...userDoc.data(),
        })) as AppUser[];
        setUsers(fetchedUsers);
      } catch (err) {
        console.error('Failed to fetch users:', err);
        toast.error('Failed to load user list');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  useEffect(() => {
    setStagedRows(prev => validateStagedRows(prev, students, classes, users));
  }, [students, classes, users]);

  const availableSections = useMemo(() => {
    return Array.from(
      new Set(
        users
          .filter(user => !classFilter || user.classId === classFilter)
          .map(user => normalizeText(user.section))
          .filter(Boolean)
      )
    ).sort();
  }, [classFilter, users]);

  useEffect(() => {
    if (sectionFilter && !availableSections.includes(sectionFilter)) {
      setSectionFilter('');
    }
  }, [availableSections, sectionFilter]);

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return users.filter(user => {
      const linkedStudent = students.find(student => student.id === user.linkedStudentId);
      const matchesSearch = !query ||
        normalizeText(user.name).toLowerCase().includes(query) ||
        normalizeText(user.rollNumber || linkedStudent?.rollNumber || user.linkedStudentId).toLowerCase().includes(query);
      const matchesClass = !classFilter || user.classId === classFilter;
      const matchesSection = !sectionFilter || normalizeText(user.section) === sectionFilter;
      return matchesSearch && matchesClass && matchesSection;
    });
  }, [classFilter, searchQuery, sectionFilter, students, users]);

  const grouped = useMemo(() => ({
    admin: filteredUsers.filter(user => user.role === 'admin'),
    teacher: filteredUsers.filter(user => user.role === 'teacher'),
    accountant: filteredUsers.filter(user => user.role === 'accountant'),
    parent: filteredUsers.filter(user => user.role === 'parent'),
    student: filteredUsers.filter(user => user.role === 'student'),
  }), [filteredUsers]);

  const stagedSummary = useMemo(() => ({
    total: stagedRows.length,
    ready: stagedRows.filter(row => !row.saved && row.errors.length === 0).length,
    errors: stagedRows.filter(row => row.errors.length > 0).length,
    saved: stagedRows.filter(row => row.saved).length,
  }), [stagedRows]);

  const totalImportErrors = useMemo(
    () => importIssues.length + stagedRows.reduce((sum, row) => sum + row.errors.length, 0),
    [importIssues, stagedRows],
  );

  const pendingEmailUsers = useMemo(
    () => users.filter(user => user.email && user.emailSent !== true),
    [users]
  );

  if (loading || storeLoading.students || storeLoading.classes) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const refreshStagedRows = (rows: StagedCredentialRow[]) =>
    setStagedRows(validateStagedRows(rows, students, classes, users));

  const handleDelete = async (id: string) => {
    const credentialId = loginCredentials.find(credential => credential.uid === id || credential.id === id)?.id;
    if (credentialId) {
      await deleteLoginCredential(schoolId, credentialId);
    }
    toast.success('Credential deleted');
    setUsers(prev => prev.filter(user => user.uid !== id));
  };

  const markEmailSent = async (uid: string) => {
    await setDoc(doc(db, 'users', uid), { emailSent: true }, { merge: true });
    await setDoc(doc(db, 'schools', schoolId, 'users', uid), { emailSent: true }, { merge: true });
    setUsers(prev => prev.map(user => user.uid === uid ? { ...user, emailSent: true } : user));
  };

  const handleSendResetEmail = async (user: AppUser) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      await markEmailSent(user.uid);
      toast.success(`Reset link sent to ${user.email}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to send reset email');
    }
  };

  const handleSendAllEmails = async () => {
    if (!pendingEmailUsers.length) {
      toast.info('No pending emails to send');
      return;
    }

    setSendingAll(true);
    let successCount = 0;
    let failedCount = 0;

    for (const user of pendingEmailUsers) {
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        await markEmailSent(user.uid);
        successCount += 1;
      } catch (error) {
        console.error('Failed to send reset email:', user.email, error);
        failedCount += 1;
      }
    }

    setSendingAll(false);

    if (successCount) {
      toast.success(`Sent ${successCount} credential email${successCount === 1 ? '' : 's'}`);
    }
    if (failedCount) {
      toast.error(`${failedCount} email${failedCount === 1 ? '' : 's'} failed to send`);
    }
  };

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([ALL_TEMPLATE_COLUMNS, TEMPLATE_SAMPLE_ROW]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Credentials Template');
    XLSX.writeFile(wb, 'credentials_template.xlsx');
    toast.success('Template downloaded!');
  };

  const resetImportState = () => {
    setStagedRows([]);
    setUploadFileName('');
    setImportIssues([]);
    setShowImportErrors(false);
  };

  const handleFileSelect = async (file: File) => {
    if (!file.name.match(/\.(csv|xlsx|xls)$/i)) {
      toast.error('Please upload a valid CSV or Excel file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = event => {
      try {
        const bstr = event.target?.result as string;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' }) as string[][];
        const headers = (rawRows[0] || []).map(cell => normalizeText(cell));
        const missingColumns = REQUIRED_TEMPLATE_COLUMNS.filter(column => !headers.includes(column));

        if (missingColumns.length > 0) {
          resetImportState();
          setImportIssues([`Missing required columns: ${missingColumns.join(', ')}`]);
          setShowImportErrors(true);
          toast.error(`${missingColumns.length} column error${missingColumns.length === 1 ? '' : 's'} found`);
          return;
        }

        const records = XLSX.utils.sheet_to_json(firstSheet, { defval: '' }) as Record<string, unknown>[];
        if (!records.length) {
          resetImportState();
          setImportIssues(['The uploaded sheet is empty.']);
          setShowImportErrors(true);
          toast.error('The uploaded sheet is empty.');
          return;
        }

        const nextRows = validateStagedRows(
          records.map(mapUploadRow),
          students,
          classes,
          users,
        );

        setUploadFileName(file.name);
        setImportIssues([]);
        setShowImportErrors(false);
        setStagedRows(nextRows);

        const errorCount = nextRows.reduce((sum, row) => sum + row.errors.length, 0);
        if (errorCount > 0) {
          setShowImportErrors(true);
          toast.error(`${errorCount} errors found (click to view)`);
        } else {
          toast.success(`Loaded ${records.length} row${records.length === 1 ? '' : 's'} for review`);
        }
      } catch (error) {
        console.error('Failed to parse credentials file:', error);
        resetImportState();
        setImportIssues(['Import failed. Check the Excel format and header names.']);
        setShowImportErrors(true);
        toast.error('Import failed. Check file format.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleStagedRowChange = (
    rowId: string,
    field: keyof Pick<StagedCredentialRow, 'name' | 'email' | 'role' | 'className' | 'section' | 'studentId' | 'parentEmail'>,
    value: string,
  ) => {
    const nextRows = stagedRows.map(row =>
      row.id === rowId
        ? {
          ...row,
          [field]: field === 'email' || field === 'parentEmail'
            ? normalizeEmail(value)
            : field === 'section'
              ? value.toUpperCase()
              : value,
        }
        : row
    );
    refreshStagedRows(nextRows);
  };

  const handleSaveBulkCredentials = async () => {
    if (!schoolId || !db) return;

    const rowsToSave = stagedRows.filter(row => !row.saved && row.errors.length === 0);
    if (!rowsToSave.length) {
      toast.info('No valid staged credentials to save');
      return;
    }

    setSavingBulk(true);
    const secondaryAuth = getSecondaryAuth();
    const savedUsers: AppUser[] = [];
    let savedCount = 0;
    let failedCount = 0;

    try {
      for (const row of rowsToSave) {
        try {
          const userCredential = await createUserWithEmailAndPassword(
            secondaryAuth,
            row.email,
            generateInitialPassword(),
          );
          const uid = userCredential.user.uid;
          const userProfile = createUserProfile({
            uid,
            schoolId,
            row,
            emailSent: false,
          });
          const loginCredential = createLoginCredential(uid, row);

          await setDoc(doc(db, 'users', uid), sanitize(userProfile));
          await setDoc(doc(db, 'schools', schoolId, 'users', uid), sanitize(userProfile));
          await addLoginCredential(schoolId, loginCredential);
          await firebaseSignOut(secondaryAuth);

          savedUsers.push(userProfile);
          savedCount += 1;

          setStagedRows(prev => prev.map(existingRow =>
            existingRow.id === row.id
              ? { ...existingRow, saved: true, uid, errors: [] }
              : existingRow
          ));
        } catch (error: any) {
          console.error('Failed to save credential row:', row.email, error);
          failedCount += 1;
          setStagedRows(prev => prev.map(existingRow =>
            existingRow.id === row.id
              ? {
                ...existingRow,
                errors: [
                  error?.code === 'auth/email-already-in-use'
                    ? 'Email already exists'
                    : error?.message || 'Failed to save credential',
                ],
              }
              : existingRow
          ));
        }
      }
    } finally {
      setSavingBulk(false);
      await firebaseSignOut(secondaryAuth).catch(() => undefined);
    }

    if (savedUsers.length) {
      setUsers(prev => [...savedUsers, ...prev]);
    }

    if (savedCount) {
      toast.success(`Saved ${savedCount} credential${savedCount === 1 ? '' : 's'}`);
    }
    if (failedCount) {
      toast.error(`${failedCount} credential${failedCount === 1 ? '' : 's'} could not be saved`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <h3 className="font-display font-semibold text-foreground text-lg flex items-center gap-2">
          <Key className="w-5 h-5" /> Login Credentials
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2 px-3 py-2 bg-muted text-foreground rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors"
          >
            Template
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-2 bg-muted text-foreground rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Upload Excel
          </button>
          <button
            onClick={resetImportState}
            className="flex items-center gap-2 px-3 py-2 bg-muted text-foreground rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors"
          >
            Reset
          </button>
          <button
            onClick={handleSaveBulkCredentials}
            disabled={savingBulk || stagedSummary.ready === 0}
            className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {savingBulk ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save All
          </button>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Add Credential
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={event => {
          const file = event.target.files?.[0];
          if (file) void handleFileSelect(file);
          event.target.value = '';
        }}
      />

      <div className="bg-card rounded-xl border border-border p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              placeholder="Search by name or student ID"
              className="w-full pl-9 pr-3 py-2 text-sm bg-muted/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <select
            value={classFilter}
            onChange={event => {
              setClassFilter(event.target.value);
              setSectionFilter('');
            }}
            className="w-full px-3 py-2 text-sm bg-muted/50 border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All Classes</option>
            {classes.map(cls => (
              <option key={cls.classId} value={cls.classId}>
                {cls.name}
              </option>
            ))}
          </select>
          <select
            value={sectionFilter}
            onChange={event => setSectionFilter(event.target.value)}
            className="w-full px-3 py-2 text-sm bg-muted/50 border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All Sections</option>
            {availableSections.map(section => (
              <option key={section} value={section}>
                {section}
              </option>
            ))}
          </select>
        </div>
      </div>

      {showAdd && (
        <AddCredentialForm
          schoolId={schoolId}
          addLoginCredential={addLoginCredential}
          students={students}
          classes={classes}
          onClose={() => setShowAdd(false)}
          onCreated={user => setUsers(prev => [user, ...prev])}
        />
      )}

      <div className="bg-card rounded-xl border border-border p-5 space-y-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h4 className="font-display font-semibold text-foreground">Bulk Credential Upload</h4>
            <p className="text-sm text-muted-foreground">
              Template: Name | Email | Role | Class | Section | StudentId | ParentEmail
            </p>
          </div>
          {uploadFileName && (
            <span className="text-xs text-muted-foreground">
              Loaded file: <span className="font-medium text-foreground">{uploadFileName}</span>
            </span>
          )}
        </div>

        {totalImportErrors > 0 && (
          <div className="space-y-3">
            <button
              onClick={() => setShowImportErrors(prev => !prev)}
              className="text-sm font-medium text-destructive hover:underline"
            >
              {totalImportErrors} errors found (click to {showImportErrors ? 'hide' : 'view'})
            </button>
            {showImportErrors && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 space-y-2">
                {importIssues.map(issue => (
                  <div key={issue} className="text-xs text-destructive flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>{issue}</span>
                  </div>
                ))}
                {stagedRows.filter(row => row.errors.length > 0).map(row => (
                  <div key={`${row.id}_summary`} className="text-xs text-destructive flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>{row.name || row.email || 'Unnamed row'}: {row.errors.join(', ')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {stagedRows.length > 0 ? (
          <>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>Total: <span className="font-semibold text-foreground">{stagedSummary.total}</span></span>
              <span>Ready: <span className="font-semibold text-foreground">{stagedSummary.ready}</span></span>
              <span>Saved: <span className="font-semibold text-foreground">{stagedSummary.saved}</span></span>
              <span>Need Review: <span className="font-semibold text-foreground">{stagedSummary.errors}</span></span>
            </div>
            <div className="overflow-x-auto border border-border rounded-xl">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-left">
                  <tr>
                    <th className="px-3 py-2 font-semibold text-foreground">Name</th>
                    <th className="px-3 py-2 font-semibold text-foreground">Email</th>
                    <th className="px-3 py-2 font-semibold text-foreground">Role</th>
                    <th className="px-3 py-2 font-semibold text-foreground">Class</th>
                    <th className="px-3 py-2 font-semibold text-foreground">Section</th>
                    <th className="px-3 py-2 font-semibold text-foreground">Student ID</th>
                    <th className="px-3 py-2 font-semibold text-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stagedRows.map(row => (
                    <tr key={row.id} className={`border-t border-border align-top ${row.errors.length > 0 ? 'bg-destructive/5' : ''}`}>
                      <td className="px-3 py-3 min-w-[180px]">
                        <input
                          value={row.name}
                          disabled={row.saved}
                          onChange={event => handleStagedRowChange(row.id, 'name', event.target.value)}
                          className="w-full px-2 py-1.5 rounded-md border border-border bg-background disabled:bg-muted/40"
                        />
                      </td>
                      <td className="px-3 py-3 min-w-[220px]">
                        <input
                          value={row.email}
                          disabled={row.saved}
                          onChange={event => handleStagedRowChange(row.id, 'email', event.target.value)}
                          className="w-full px-2 py-1.5 rounded-md border border-border bg-background disabled:bg-muted/40"
                        />
                      </td>
                      <td className="px-3 py-3 min-w-[150px]">
                        <select
                          value={row.role}
                          disabled={row.saved}
                          onChange={event => handleStagedRowChange(row.id, 'role', event.target.value)}
                          className="w-full px-2 py-1.5 rounded-md border border-border bg-background disabled:bg-muted/40"
                        >
                          <option value="">Select role</option>
                          {ROLE_OPTIONS.map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3 min-w-[150px]">
                        <input
                          value={row.className}
                          disabled={row.saved}
                          onChange={event => handleStagedRowChange(row.id, 'className', event.target.value)}
                          className="w-full px-2 py-1.5 rounded-md border border-border bg-background disabled:bg-muted/40"
                        />
                      </td>
                      <td className="px-3 py-3 min-w-[100px]">
                        <input
                          value={row.section}
                          disabled={row.saved}
                          onChange={event => handleStagedRowChange(row.id, 'section', event.target.value)}
                          className="w-full px-2 py-1.5 rounded-md border border-border bg-background disabled:bg-muted/40"
                        />
                      </td>
                      <td className="px-3 py-3 min-w-[140px]">
                        <input
                          value={row.studentId}
                          disabled={row.saved}
                          onChange={event => handleStagedRowChange(row.id, 'studentId', event.target.value)}
                          className="w-full px-2 py-1.5 rounded-md border border-border bg-background disabled:bg-muted/40"
                        />
                      </td>
                      <td className="px-3 py-3 min-w-[260px]">
                        {row.saved ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-success/10 text-success text-xs font-semibold">
                            <Check className="w-3 h-3" />
                            Saved
                          </span>
                        ) : row.errors.length > 0 ? (
                          <div className="space-y-1">
                            {row.errors.map(error => (
                              <div key={error} className="text-xs text-destructive flex items-start gap-1">
                                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                <span>{error}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-semibold">
                            Ready to save
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="text-sm text-muted-foreground border border-dashed border-border rounded-xl p-4">
            Upload a CSV or Excel sheet to review credentials before saving.
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSendAllEmails}
          disabled={sendingAll || pendingEmailUsers.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-muted text-foreground rounded-lg text-sm font-medium hover:bg-muted/80 disabled:opacity-50"
        >
          {sendingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Send Credentials Email to All
        </button>
      </div>

      {(Object.entries(grouped) as [UserRole, AppUser[]][]).map(([role, credentials]) => (
        credentials.length > 0 && (
          <div key={role} className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-5 py-3 bg-muted/30 border-b border-border">
              <h4 className="text-sm font-semibold text-foreground capitalize flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                {role}s ({credentials.length})
              </h4>
            </div>
            <div className="divide-y divide-border">
              {credentials.map(user => {
                const linkedStudent = students.find(student => student.id === user.linkedStudentId);
                const className = classes.find(cls => cls.classId === user.classId)?.name || user.classId;
                return (
                  <div key={user.uid} className="px-5 py-3 flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-bold text-foreground">{user.name}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${user.emailSent ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                          {user.emailSent ? 'Email Sent' : 'Pending Email'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="text-xs text-muted-foreground">
                          Email: <span className="font-mono text-foreground">{user.email}</span>
                        </span>
                        {user.linkedStudentId && (
                          <span className="text-xs text-muted-foreground">
                            Student: {linkedStudent?.name || user.linkedStudentId}
                          </span>
                        )}
                        {(user.rollNumber || linkedStudent?.rollNumber) && (
                          <span className="text-xs text-muted-foreground">
                            Student ID: {user.rollNumber || linkedStudent?.rollNumber}
                          </span>
                        )}
                        {user.classId && (
                          <span className="text-xs text-muted-foreground">
                            Class: {className || user.classId}
                          </span>
                        )}
                        {user.section && (
                          <span className="text-xs text-muted-foreground">
                            Section: {user.section}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-3 pt-2 border-t border-border/50">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                          Security
                        </span>
                        <button
                          onClick={() => handleSendResetEmail(user)}
                          className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold bg-primary/5 text-primary border border-primary/20 rounded-md hover:bg-primary hover:text-primary-foreground transition-all"
                        >
                          <Send className="w-3 h-3" />
                          Send Password Reset Link
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleDelete(user.uid)}
                        className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                        title="Delete Credential"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )
      ))}
    </div>
  );
};

const AddCredentialForm = ({
  schoolId,
  addLoginCredential,
  students,
  classes,
  onClose,
  onCreated,
}: {
  schoolId: string;
  addLoginCredential: (schoolId: string, credential: LoginCredential) => Promise<void>;
  students: Student[];
  classes: Array<{ classId: string; name: string }>;
  onClose: () => void;
  onCreated: (user: AppUser) => void;
}) => {
  const [form, setForm] = useState({
    email: '',
    role: 'student' as UserRole,
    name: '',
    linkedStudentId: '',
    classId: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.name) {
      toast.error('Fill required fields');
      return;
    }
    if (!form.email.includes('@')) {
      toast.error('Enter a valid email address');
      return;
    }

    setSubmitting(true);

    try {
      const secondaryAuth = getSecondaryAuth();
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        normalizeEmail(form.email),
        generateInitialPassword(),
      );
      const uid = userCredential.user.uid;

      await sendPasswordResetEmail(auth, normalizeEmail(form.email));

      const linkedStudent = students.find(student => student.id === form.linkedStudentId);
      const stagedRow: StagedCredentialRow = {
        id: `manual_${uid}`,
        name: normalizeText(form.name),
        email: normalizeEmail(form.email),
        role: form.role,
        className: classes.find(cls => cls.classId === form.classId)?.name || '',
        classId: form.classId,
        section: '',
        studentId: linkedStudent?.rollNumber || form.linkedStudentId,
        parentEmail: '',
        linkedStudentId: form.linkedStudentId || undefined,
        rollNumber: linkedStudent?.rollNumber,
        errors: [],
        saved: true,
        uid,
      };

      if (linkedStudent) {
        stagedRow.classId = linkedStudent.classId || stagedRow.classId;
        stagedRow.className = linkedStudent.class || stagedRow.className;
        stagedRow.section = linkedStudent.section || '';
      }

      const newCredential = createLoginCredential(uid, stagedRow);
      await addLoginCredential(schoolId, newCredential);

      const userProfile = createUserProfile({
        uid,
        schoolId,
        row: stagedRow,
        emailSent: true,
      });

      if (form.role === 'student' || form.role === 'parent') {
        const student = students.find(s => s.id === form.linkedStudentId);
        if (student) {
          await updateDoc(doc(db, 'schools', schoolId, 'students', student.id), {
            uid,
          });
        }
      }

      await setDoc(doc(db, 'users', uid), sanitize(userProfile));
      await setDoc(doc(db, 'schools', schoolId, 'users', uid), sanitize(userProfile));
      await firebaseSignOut(secondaryAuth);

      onCreated(userProfile);
      toast.success(`Credential created. Reset link sent to ${form.email}`);
      onClose();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') toast.error('Email already exists');
      else if (err.code === 'auth/invalid-email') toast.error('Invalid email format');
      else toast.error(err.message || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-display font-semibold text-foreground">New Credential</h4>
        <button onClick={onClose} className="p-1 hover:bg-muted rounded-md">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Name *</label>
          <input
            value={form.name}
            onChange={event => setForm({ ...form, name: event.target.value })}
            className="w-full px-3 py-2 text-sm bg-muted/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Role</label>
          <select
            value={form.role}
            onChange={event => setForm({ ...form, role: event.target.value as UserRole })}
            className="w-full px-3 py-2 text-sm bg-muted/50 border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {ROLE_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Email *</label>
          <input
            value={form.email}
            onChange={event => setForm({ ...form, email: event.target.value })}
            type="email"
            placeholder="email@school.com"
            className="w-full px-3 py-2 text-sm bg-muted/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="md:col-span-2">
          <p className="text-[10px] text-muted-foreground bg-muted/30 p-2 rounded border border-border/50">
            <strong>Security Notice:</strong> A reset link will be sent after creation, while keeping the current admin session active.
          </p>
        </div>
        {(form.role === 'student' || form.role === 'parent') && (
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-foreground mb-1.5">Link to Student</label>
            <select
              value={form.linkedStudentId}
              onChange={event => setForm({ ...form, linkedStudentId: event.target.value })}
              className="w-full px-3 py-2 text-sm bg-muted/50 border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select student...</option>
              {students.map(student => (
                <option key={student.id} value={student.id}>
                  {student.name} ({student.rollNumber || student.id})
                </option>
              ))}
            </select>
          </div>
        )}
        {form.role === 'teacher' && (
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-foreground mb-1.5">Link to Class</label>
            <select
              value={form.classId}
              onChange={event => setForm({ ...form, classId: event.target.value })}
              className="w-full px-3 py-2 text-sm bg-muted/50 border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select class...</option>
              {classes.map(cls => (
                <option key={cls.classId} value={cls.classId}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Create Credential & Send Reset Link
          </button>
        </div>
      </form>
    </div>
  );
};

export default CredentialManager;

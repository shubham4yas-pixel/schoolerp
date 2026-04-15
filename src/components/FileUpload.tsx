import { useState, useRef, useMemo, useEffect } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { useAuth } from '@/contexts/AuthContext';
import { calculateFeeStatus } from '@/lib/data-utils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import { db } from '@/lib/firebase';
import { doc, setDoc, collection, arrayUnion, addDoc } from 'firebase/firestore';
import { supabase } from '@/lib/supabase';
import { sanitize } from '@/lib/data-utils';
import { hasSubAccess } from '@/lib/rbac-utils';

type UploadType = 'marks' | 'attendance' | 'fees' | 'students';
type StudentTemplate = 'Basic' | 'Full' | 'With Transport' | 'Custom';

interface FileUploadProps {
  initialType?: UploadType;
}

const FileUpload = ({ initialType }: FileUploadProps) => {
  const { schoolId, role } = useAuth();
  const [selectedType, setSelectedType] = useState<UploadType>(initialType || 'marks');
  const [studentTemplate, setStudentTemplate] = useState<StudentTemplate>('Basic');
  const [templateMode, setTemplateMode] = useState<'universal' | 'class' | 'section'>('universal');
  const [contextClass, setContextClass] = useState('');
  const [contextSection, setContextSection] = useState('');
  const { students, exams, subjects: storeSubjects, classes: storeClasses } = useStore();

  // Convert UploadType to sub-feature key for RBAC
  const typeToFeature = (type: UploadType): string => {
    switch (type) {
      case 'students': return 'student';
      default: return type;
    }
  };

  const availableTypes = useMemo(() => {
    const allTypes: { value: UploadType; label: string }[] = [
      { value: 'marks', label: 'Marks Upload' },
      { value: 'attendance', label: 'Attendance Upload' },
      { value: 'fees', label: 'Fee Payments Upload' },
      { value: 'students', label: 'Students Registration' },
    ];
    return allTypes.filter(t => hasSubAccess(role || 'admin', typeToFeature(t.value)));
  }, [role]);

  // Ensure selectedType is valid for the role
  useEffect(() => {
    const feat = typeToFeature(selectedType);
    if (role && !hasSubAccess(role, feat)) {
      if (availableTypes.length > 0) setSelectedType(availableTypes[0].value);
    }
  }, [role, selectedType, availableTypes]);

  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<any[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const expectedColumns = useMemo(() => {
    let cols = [];
    if (templateMode === 'universal') cols.push('Class', 'Section');
    else if (templateMode === 'class') cols.push('Section');

    if (selectedType === 'marks') cols.push('Exam Type', 'Subject', 'Student ID', 'Marks', 'Out Of', 'Date');
    else if (selectedType === 'attendance') cols.push('Student ID', 'Date', 'Status', 'Reason');
    else if (selectedType === 'fees') cols.push('Student ID', 'Month', 'Status', 'Paid Amount', 'Date');
    else if (selectedType === 'students') {
      cols.push('Name', 'Student ID (Optional)', 'Gender (M/F)', 'Parent Name', 'Contact');
      if (studentTemplate === 'With Transport' || studentTemplate === 'Full') cols.push('Bus Service (Yes/No)', 'Bus Fee');
      if (studentTemplate === 'Full') cols.push('DOB (YYYY-MM-DD)', 'Address');
    }

    return cols.join(' | ');
  }, [selectedType, templateMode]);

  const downloadTemplate = () => {
    let headers: string[] = [];
    let example: any[] = [];

    // Base Columns based on Mode
    if (templateMode === 'universal') headers.push('Class', 'Section');
    else if (templateMode === 'class') headers.push('Section');

    // Type Specific Columns
    if (selectedType === 'marks') {
      headers.push('Exam Type', 'Subject', 'Student ID', 'Marks', 'Out Of', 'Date');
      const baseRow = [exams[0]?.name || 'Midterm', storeSubjects[0]?.name || 'Mathematics', 'ID_123', '85', '100', new Date().toISOString().split('T')[0]];
      if (templateMode === 'universal') example = ['Class 10', 'A', ...baseRow];
      else if (templateMode === 'class') example = ['A', ...baseRow];
      else example = baseRow;
    } else if (selectedType === 'attendance') {
      headers.push('Student ID', 'Date', 'Status (Present/Absent/Leave)', 'Reason');
      const baseRow = ['ID_123', new Date().toISOString().split('T')[0], 'Present', ''];
      if (templateMode === 'universal') example = ['Class 10', 'A', ...baseRow];
      else if (templateMode === 'class') example = ['A', ...baseRow];
      else example = baseRow;
    } else if (selectedType === 'fees') {
      headers.push('Student ID', 'Month', 'Status (Paid/Partial/Unpaid)', 'Paid Amount', 'Date');
      const baseRow = ['ID_123', 'Apr 2026', 'Paid', '5000', new Date().toISOString().split('T')[0]];
      if (templateMode === 'universal') example = ['Class 10', 'A', ...baseRow];
      else if (templateMode === 'class') example = ['A', ...baseRow];
      else example = baseRow;
    } else if (selectedType === 'students') {
      headers.push('Name', 'Student ID', 'Gender', 'Parent Name', 'Contact Number');
      let baseRow = ['John Doe', '', 'Male', 'Richard Doe', '9876543210'];

      if (studentTemplate === 'With Transport' || studentTemplate === 'Full' || studentTemplate === 'Custom') {
        headers.push('Bus Service (Yes/No)', 'Bus Fee');
        baseRow.push('Yes', '1500');
      }
      if (studentTemplate === 'Full' || studentTemplate === 'Custom') {
        headers.push('DOB', 'Address');
        baseRow.push('2010-05-15', '123 School Lane');
      }

      if (templateMode === 'universal') {
        headers.unshift('Class', 'Section');
        example = ['Class 10', 'A', ...baseRow];
      } else if (templateMode === 'class') {
        headers.unshift('Section');
        example = ['A', ...baseRow];
      } else {
        example = baseRow;
      }
    }

    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, `${selectedType}_${templateMode}_template.xlsx`);
    toast.info(`Downloading ${templateMode} ${selectedType} template...`);
  };

  const parseFile = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

      // STEP 1 — VERIFY PARSING (Using Objects for better mapping)
      const jsonData = XLSX.utils.sheet_to_json(firstSheet) as any[];
      console.log("PARSED DATA:", jsonData);

      return jsonData;
    } catch (err) {
      toast.error('Failed to parse the file. Ensure it is a valid CSV or Excel document.');
      return null;
    }
  };

  const handleFile = async (file: File) => {
    if (!file.name.match(/\.(csv|xlsx|xls)$/i)) {
      toast.error('Please upload a valid CSV or Excel file.');
      return;
    }
    setFileName(file.name);
    const jsonData = await parseFile(file);
    if (!jsonData || jsonData.length === 0) {
      toast.error('File appears empty or has no data rows.');
      return;
    }
    setPreview(jsonData);
  };

  const handleSaveAll = async () => {
    if (!preview || preview.length === 0 || !schoolId || !db) return;
    setImporting(true);
    let success = 0;
    let errors = 0;

    const dataRows = preview;
    const { classes: storeClasses } = useStore.getState();

    try {
      for (const record of dataRows) {
        if (selectedType === 'students') {
            // STEP 2 — WRITE TO FIRESTORE (Mandated Schema)
            const studentsRef = collection(db, "schools", "school_001", "students");
            
            for (const row of dataRows) {
              const rawClassValue = (row.Class || row.class || contextClass || "").toString().trim();
              const matchedClass = storeClasses.find(c => c.classId === rawClassValue || c.name === rawClassValue);
              const classId = matchedClass?.classId || contextClass || "";
              const className = matchedClass?.name || rawClassValue;

              const { error } = await supabase
                .from('students')
                .insert([
                  {
                    school_id: schoolId,
                    name: row.Name || row.name || "",
                    class_id: classId,
                    class: className,
                    section: (row.Section || row.section || contextSection || "A").toString().toUpperCase(),
                    roll_number: (row['Roll No'] || row.rollNumber || row.RollNo || "").toString().trim(),
                    total_fees: Number(row.Fees || row.fees || row.totalFees || 0),
                    paid_amount: Number(row.Paid || row.paid || row.paidAmount || 0),
                    created_at: new Date().toISOString(),
                  }
                ]);

              if (error) {
                console.error("Insert failed:", error);
                errors++;
                continue;
              }
              success++;
            }
            break; // Finished student upload
        }
      }

      await useStore.getState().logUploadRecord(schoolId, {
        id: `UL_${Date.now()}`,
        type: selectedType,
        uploadedAt: new Date().toISOString(),
        totalRecords: dataRows.length,
        successCount: success,
        errorCount: errors,
        updatedBy: 'Admin'
      });

      toast.success(`Processed ${dataRows.length} records. Success: ${success}, Errors: ${errors}`);
      clearPreview();
    } catch (err) {
      toast.error("Failed to sync records");
      console.error(err);
    }
    setImporting(false);
  };

  const clearPreview = () => {
    setPreview(null);
    setFileName('');
    setImporting(false);
    setProgress(0);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shadow-sm border border-primary/20">
            <FileSpreadsheet className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="font-display font-bold text-foreground tracking-tight text-xl">
              Bulk Data Import
            </h3>
            <p className="text-sm font-medium text-muted-foreground">Upload Excel sheets to update system records in bulk.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-black uppercase tracking-widest text-muted-foreground mr-2">Type:</label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as any)}
            className="bg-card border border-border rounded-xl px-4 py-2 text-sm font-bold shadow-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
          >
            {availableTypes.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>

          {selectedType === 'students' && (
            <select
              value={studentTemplate}
              onChange={(e) => setStudentTemplate(e.target.value as any)}
              className="bg-card border border-border rounded-xl px-4 py-2 text-sm font-bold shadow-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none text-primary"
            >
              <option value="Basic">Basic Template</option>
              <option value="Full">Full Template</option>
              <option value="With Transport">With Transport</option>
              <option value="Custom">Custom</option>
            </select>
          )}

          <button
            onClick={downloadTemplate}
            disabled={(templateMode === 'class' && !contextClass) || (templateMode === 'section' && (!contextClass || !contextSection))}
            className="flex items-center gap-2 px-4 py-2 bg-muted text-foreground border border-border rounded-xl text-sm font-bold hover:bg-muted/80 transition-all disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4" /> Template
          </button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2 block">Template Mode</label>
            <div className="flex bg-muted/50 p-1 rounded-xl border border-border">
              {(['universal', 'class', 'section'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => { setTemplateMode(m); setContextClass(''); setContextSection(''); }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg capitalize transition-all ${templateMode === m ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {(templateMode === 'class' || templateMode === 'section') && (
            <div>
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2 block">Target Class</label>
              <select
                value={contextClass}
                onChange={(e) => { setContextClass(e.target.value); setContextSection(''); }}
                className="w-full bg-background border border-border rounded-xl px-4 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Select Class</option>
                {storeClasses.map(c => <option key={c.classId} value={c.classId}>{c.name}</option>)}
              </select>
            </div>
          )}

          {templateMode === 'section' && (
            <div>
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2 block">Target Section</label>
              <select
                value={contextSection}
                disabled={!contextClass}
                onChange={(e) => setContextSection(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-4 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
              >
                <option value="">Select Section</option>
                {storeClasses.find(c => c.classId === contextClass)?.sections?.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="mt-6 pt-6 border-t border-border/50">
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-lg">
              <span className="text-[10px] font-black text-primary uppercase tracking-widest">
                {templateMode === 'universal' ? 'Using Universal Mode' :
                  templateMode === 'class' ? `Pre-filled for ${storeClasses.find(c => c.classId === contextClass)?.name || 'Class'}` :
                    `Pre-filled for ${storeClasses.find(c => c.classId === contextClass)?.name || 'Class'} - ${contextSection || 'X'}`}
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-medium italic">Template will only contain columns required for this mode.</p>
          </div>
        </div>
      </div>

      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
        <AlertCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
        <div className="text-sm text-foreground">
          <p className="font-bold mb-1">Multi-School Architecture Constraints:</p>
          <p className="opacity-90">{expectedColumns}</p>
          <p className="text-xs text-muted-foreground mt-2 font-medium bg-background px-3 py-1 rounded-md border border-border inline-block">
            Smart Sync: Student records merge securely into Firestore using ID: [Class]-[Section]-[Roll].
          </p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!preview ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onDragOver={e => { e.preventDefault(); if (hasSubAccess(role || 'admin', typeToFeature(selectedType))) setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); if (hasSubAccess(role || 'admin', typeToFeature(selectedType)) && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
            onClick={() => { if (hasSubAccess(role || 'admin', typeToFeature(selectedType))) fileRef.current?.click(); }}
            className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 ${dragOver ? 'border-primary bg-primary/5 scale-[1.01] shadow-soft' : 'border-border hover:border-primary/40 hover:bg-muted/30 shadow-sm'
              } ${!hasSubAccess(role || 'admin', typeToFeature(selectedType)) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 transition-colors ${dragOver ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              <Upload className="w-6 h-6" />
            </div>
            <p className="text-base font-bold text-foreground mb-1">
              {!hasSubAccess(role || 'admin', typeToFeature(selectedType)) ? `Restricted Access (${selectedType} Upload)` : 'Drag & Drop your file here'}
            </p>
            <p className="text-sm font-medium text-muted-foreground">Supports .csv, .xlsx, .xls</p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
            />
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-4 bg-card border border-border rounded-2xl p-5 shadow-soft"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-success" />
                </div>
                <div>
                  <h4 className="font-bold text-foreground">{fileName}</h4>
                  <p className="text-xs font-semibold text-muted-foreground">{preview.length} records detected</p>
                </div>
              </div>
              <button disabled={importing} onClick={clearPreview} className="px-3 py-1.5 font-semibold hover:bg-muted rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2 text-muted-foreground border border-transparent hover:border-border text-sm">
                <X className="w-4 h-4" /> Cancel
              </button>
            </div>

            <div className="overflow-x-auto border border-border rounded-xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    {Object.keys(preview[0]).map((h, i) => (
                      <th key={i} className="px-5 py-3 text-left font-bold text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 5).map((row: any, ri) => (
                    <tr key={ri} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      {Object.values(row).map((cell: any, ci) => (
                        <td key={ci} className="px-5 py-3 font-medium text-foreground whitespace-nowrap">{String(cell)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.length > 5 && (
                <div className="px-5 py-3 text-xs font-bold text-primary bg-primary/5 border-t border-border/50 text-center">
                  ... and {preview.length - 5} more rows ready for Firestore sync.
                </div>
              )}
            </div>

            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {importing ? (
                <div className="flex-1 max-w-sm w-full">
                  <div className="flex justify-between text-xs font-bold text-primary mb-1.5">
                    <span>Writing securely to Firestore...</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-primary"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ ease: "easeOut", duration: 0.2 }}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground font-medium">Auto-validation passed. Ready to persist.</p>
              )}

              <button
                onClick={handleSaveAll}
                disabled={importing}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-primary/30 transition-all disabled:opacity-50 hover:-translate-y-0.5 disabled:translate-y-0 disabled:shadow-none"
              >
                {importing ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Processing Records...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Save All {preview.length} Records
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FileUpload;

import React, { useState, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { useAuth } from '@/contexts/AuthContext';
import { ExamConfig, SubjectConfig, ClassConfig } from '@/lib/types';
import { Check, Edit, Plus, Trash, BookOpen, Layers, Target, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore";

const AcademicSettings = ({ schoolId }: { schoolId: string }) => {
    const { role } = useAuth();
    const { exams, subjects, classes, saveExamConfig, saveSubjectConfig, saveClassConfig, syncStudentsToSupabase } = useStore();

    const [subTab, setSubTab] = useState<'classes' | 'subjects' | 'exams' | 'sync'>('classes');

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap gap-2 mb-4">
                <button onClick={() => setSubTab('classes')} className={`px-4 py-2 text-sm font-medium rounded-lg ${subTab === 'classes' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>Classes</button>
                <button onClick={() => setSubTab('subjects')} className={`px-4 py-2 text-sm font-medium rounded-lg ${subTab === 'subjects' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>Subjects</button>
                <button onClick={() => setSubTab('exams')} className={`px-4 py-2 text-sm font-medium rounded-lg ${subTab === 'exams' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>Exams</button>
                <button onClick={() => setSubTab('sync')} className={`px-4 py-2 text-sm font-medium rounded-lg ${subTab === 'sync' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>Data Sync</button>
            </div>
            {subTab === 'classes' && <ClassesSettings schoolId={schoolId} classes={classes} saveClassConfig={saveClassConfig} role={role} />}
            {subTab === 'subjects' && <SubjectsSettings schoolId={schoolId} subjects={subjects} classes={classes} saveSubjectConfig={saveSubjectConfig} role={role} />}
            {subTab === 'exams' && <ExamsSettings schoolId={schoolId} exams={exams} saveExamConfig={saveExamConfig} role={role} />}
            {subTab === 'sync' && <SyncSettings schoolId={schoolId} syncStudentsToSupabase={syncStudentsToSupabase} />}
        </div>
    );
};

const SyncSettings = ({ schoolId, syncStudentsToSupabase }: any) => {
    const [isSyncing, setIsSyncing] = useState(false);
    const [stats, setStats] = useState<any>(null);

    const handleSync = async () => {
        if (!window.confirm("This will upload all 1208 students to Supabase. Continue?")) return;
        
        setIsSyncing(true);
        setStats(null);
        try {
            const result = await syncStudentsToSupabase(schoolId);
            setStats(result);
            toast.success("Migration completed successfully!");
        } catch (error) {
            console.error(error);
            toast.error("Migration failed. Please check logs.");
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div className="space-y-4 p-6 bg-card border rounded-xl shadow-sm">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-xl">
                    <Layers className="w-6 h-6 text-primary" />
                </div>
                <div>
                    <h3 className="text-lg font-bold">Migration Tool</h3>
                    <p className="text-sm text-muted-foreground">Sync your students from Firestore to Supabase</p>
                </div>
            </div>

            <div className="text-sm text-muted-foreground bg-muted/30 p-4 rounded-lg border border-border">
                <p>This tool will fetch all student records currently in Firebase and upsert them into your Supabase Postgres database. This ensures both dashboards are perfectly in sync.</p>
            </div>

            <button 
                onClick={handleSync} 
                disabled={isSyncing}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${isSyncing ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground hover:opacity-90 shadow-lg shadow-primary/20'}`}
            >
                {isSyncing ? <Layers className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {isSyncing ? "Syncing 1208 Students..." : "Migrate All Students to Supabase"}
            </button>

            {stats && (
                <div className="mt-4 p-4 bg-muted/50 rounded-lg border border-border grid grid-cols-2 gap-4">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-success">{stats.success}</div>
                        <div className="text-xs text-muted-foreground">Successfully Synced</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-destructive">{stats.failed}</div>
                        <div className="text-xs text-muted-foreground">Errors / Retries</div>
                    </div>
                </div>
            )}
        </div>
    );
};

const ClassesSettings = ({ schoolId, classes, saveClassConfig, role }: any) => {
    const [draftName, setDraftName] = useState('');
    const [draftOrder, setDraftOrder] = useState('');
    const [draftSections, setDraftSections] = useState('A, B, C');
    const sorted = [...classes].sort((a, b) => a.order - b.order);

    const handleAddClass = async () => {
        const sectionsArray = draftSections ? draftSections.split(',').map(s => s.trim()).filter(Boolean) : ["A"];
        const order = draftOrder;
        const currentSchoolId = "school_001";
        const className = draftName;

        console.log("CLASS DEBUG:", {
            className,
            sectionsArray,
            order,
            currentSchoolId
        });

        if (!currentSchoolId) {
            alert("School ID missing");
            return;
        }

        if (!className || !order) return;

        try {
            const classQuery = query(collection(db, "schools", currentSchoolId, "classes"), where("name", "==", className));
            console.log("Checking for duplicate class name...");
            const querySnapshot = await getDocs(classQuery);

            if (!querySnapshot.empty) {
                alert("Class already exists");
                return;
            }

            const classRef = collection(db, "schools", currentSchoolId, "classes");

            await addDoc(classRef, {
                name: className,
                sections: sectionsArray,
                order: Number(order),
                schoolId: currentSchoolId,
                createdAt: new Date()
            });

            console.log("CLASS ADDED SUCCESS");
            alert("Class successfully saved");
            setDraftName('');
            setDraftOrder('');
            setDraftSections('A, B, C');
            toast.success("Class added");
        } catch (error) {
            console.error("CLASS WRITE ERROR:", error);
            alert("Failed to save class");
        }
    };

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-bold">Manage Classes</h3>
            <div className="flex flex-wrap gap-2 items-end">
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-muted-foreground ml-1 uppercase tracking-wider">Class Name</label>
                    <input type="text" value={draftName} onChange={e => setDraftName(e.target.value)} placeholder="e.g. 1, 2, Nursery" className="px-3 py-2 text-sm bg-muted/50 border rounded-lg w-40" />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-muted-foreground ml-1 uppercase tracking-wider">Sections</label>
                    <input type="text" value={draftSections} onChange={e => setDraftSections(e.target.value)} placeholder="A, B, C" className="px-3 py-2 text-sm bg-muted/50 border rounded-lg w-40" />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-muted-foreground ml-1 uppercase tracking-wider">Order</label>
                    <input type="number" value={draftOrder} onChange={e => setDraftOrder(e.target.value)} placeholder="1" className="px-3 py-2 text-sm bg-muted/50 border rounded-lg w-20" />
                </div>
                <button onClick={() => {
                    console.log("ADD CLASS CLICKED");
                    handleAddClass();
                }} className="bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-all flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Add Class
                </button>
            </div>
            <div className="grid gap-2">
                {sorted.map(c => (
                    <div key={c.id} className="p-4 bg-card border rounded-xl flex justify-between items-center hover:border-primary/40 transition-colors">
                        <div>
                            <span className="font-bold text-sm text-foreground">{c.name}</span>
                            <div className="flex gap-1.5 mt-1">
                                {(c.sections || ["A"]).map((s: string) => (
                                    <span key={s} className="px-2 py-0.5 bg-muted text-[10px] font-bold rounded border border-border">{s}</span>
                                ))}
                            </div>
                        </div>
                        <span className="text-muted-foreground text-xs font-medium">Order: {c.order}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const SubjectsSettings = ({ schoolId, subjects, classes, saveSubjectConfig, role }: any) => {
    const [draftName, setDraftName] = useState('');
    const [selectedClasses, setSelectedClasses] = useState<string[]>([]);

    const handleSave = async () => {
        if (!draftName) return;
        const id = `S_${Date.now()}`;
        await saveSubjectConfig(schoolId, { id, subjectId: id, name: draftName, classIds: selectedClasses });
        setDraftName('');
        setSelectedClasses([]);
        toast.success("Subject added");
    };

    const toggleClass = (classId: string) => {
        setSelectedClasses(prev => prev.includes(classId) ? prev.filter(c => c !== classId) : [...prev, classId]);
    };

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-bold">Manage Subjects</h3>
            <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                    <input type="text" value={draftName} onChange={e => setDraftName(e.target.value)} placeholder="Subject Name" className="px-3 py-2 flex-grow text-sm bg-muted/50 border rounded-lg" />
                </div>
                <div className="text-xs text-muted-foreground mt-2">Select Applicable Classes:</div>
                <div className="flex flex-wrap gap-2">
                    {classes.map((c: any) => (
                        <button key={c.id} onClick={() => toggleClass(c.classId)} className={`px-2 py-1 text-xs rounded-lg border ${selectedClasses.includes(c.classId) ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                            {c.name}
                        </button>
                    ))}
                </div>
                <button onClick={handleSave} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold self-start mt-2">Add Subject</button>
            </div>
            <div className="grid gap-2 mt-4">
                {subjects.map((s: any) => (
                    <div key={s.id} className="p-3 bg-card border rounded-lg flex justify-between items-center">
                        <div>
                            <div className="font-semibold text-sm">{s.name}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Classes: {
                                s.classIds.length === 0
                                  ? 'All'
                                  : s.classIds
                                      .map((id: string) => {
                                        const cls = classes.find((c: any) => c.classId === id || c.id === id);
                                        return cls ? cls.name : '';
                                      })
                                      .filter(Boolean)
                                      .join(', ')
                              }
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const ExamsSettings = ({ schoolId, exams, saveExamConfig, role }: any) => {
    const [draftName, setDraftName] = useState('');
    const [draftOrder, setDraftOrder] = useState('');

    const sorted = [...exams].sort((a: any, b: any) => a.order - b.order);

    const handleSave = async () => {
        if (!draftName || !draftOrder) return;
        const id = `E_${Date.now()}`;
        await saveExamConfig(schoolId, { id, examId: id, name: draftName, order: parseInt(draftOrder), isPublished: false });
        setDraftName('');
        setDraftOrder('');
        toast.success("Exam added");
    };

    const togglePublish = async (exam: any) => {
        await saveExamConfig(schoolId, { ...exam, isPublished: !exam.isPublished });
        toast.success(`Exam ${!exam.isPublished ? 'Published' : 'Hidden'}`);
    }

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-bold">Manage Exams</h3>
            <div className="flex gap-2 items-center">
                <input type="text" value={draftName} onChange={e => setDraftName(e.target.value)} placeholder="Exam Name (e.g. Unit 1)" className="px-3 py-2 flex-grow text-sm bg-muted/50 border rounded-lg" />
                <input type="number" value={draftOrder} onChange={e => setDraftOrder(e.target.value)} placeholder="Order" className="px-3 py-2 text-sm bg-muted/50 border rounded-lg w-24" />
                <button onClick={handleSave} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold">Add Exam</button>
            </div>
            <div className="grid gap-2 mt-4">
                {sorted.map(e => (
                    <div key={e.id} className="p-3 bg-card border rounded-lg flex justify-between items-center">
                        <span className="font-semibold text-sm">{e.name} <span className="text-muted-foreground ml-2 text-xs">(Order: {e.order})</span></span>
                        <button onClick={() => togglePublish(e)} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg ${e.isPublished ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                            {e.isPublished ? <Check className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                            {e.isPublished ? 'Published' : 'Hidden'}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AcademicSettings;

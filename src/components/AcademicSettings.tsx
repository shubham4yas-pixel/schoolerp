import React, { useState, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { useAuth } from '@/contexts/AuthContext';
import { ExamConfig, SubjectConfig, ClassConfig } from '@/lib/types';
import { Check, Edit, Plus, Trash, BookOpen, Layers, Target, Eye, EyeOff, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from "@/lib/supabase";

const AcademicSettings = ({ schoolId }: { schoolId: string }) => {
    const { role } = useAuth();
    const { 
        exams, subjects, classes, 
        saveExamConfig, saveSubjectConfig, saveClassConfig, 
        syncStudentsToSupabase,
        deleteExamConfig, deleteSubjectConfig, deleteClassConfig
    } = useStore();

    const [subTab, setSubTab] = useState<'classes' | 'subjects' | 'exams'>('classes');

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap gap-2 mb-4">
                <button onClick={() => setSubTab('classes')} className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${subTab === 'classes' ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted hover:bg-muted/80'}`}>Classes</button>
                <button onClick={() => setSubTab('subjects')} className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${subTab === 'subjects' ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted hover:bg-muted/80'}`}>Subjects</button>
                <button onClick={() => setSubTab('exams')} className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${subTab === 'exams' ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted hover:bg-muted/80'}`}>Exams</button>
            </div>
            
            <div className="bg-card rounded-2xl border border-border p-8 shadow-sm">
                {subTab === 'classes' && <ClassesSettings schoolId={schoolId} classes={classes} saveClassConfig={saveClassConfig} deleteClassConfig={deleteClassConfig} role={role} />}
                {subTab === 'subjects' && <SubjectsSettings schoolId={schoolId} subjects={subjects} classes={classes} saveSubjectConfig={saveSubjectConfig} deleteSubjectConfig={deleteSubjectConfig} role={role} />}
                {subTab === 'exams' && <ExamsSettings schoolId={schoolId} exams={exams} saveExamConfig={saveExamConfig} deleteExamConfig={deleteExamConfig} role={role} />}
            </div>
        </div>
    );
};



const ClassesSettings = ({ schoolId, classes, saveClassConfig, deleteClassConfig, role }: any) => {
    const [draftName, setDraftName] = useState('');
    const [draftOrder, setDraftOrder] = useState('');
    const [draftSections, setDraftSections] = useState('A, B, C');
    const [editingId, setEditingId] = useState<string | null>(null);

    const sorted = [...classes].sort((a, b) => a.order - b.order);

    const handleEdit = (cls: ClassConfig) => {
        setEditingId(cls.id);
        setDraftName(cls.name);
        setDraftOrder(cls.order?.toString() || '');
        setDraftSections(cls.sections?.join(', ') || 'A');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancel = () => {
        setEditingId(null);
        setDraftName('');
        setDraftOrder('');
        setDraftSections('A, B, C');
    };

    const handleDelete = async (id: string, name: string) => {
        if (!window.confirm(`Are you sure you want to delete Class ${name}? This may affect student data.`)) return;
        await deleteClassConfig(schoolId, id);
        toast.success(`Class ${name} deleted`);
    };

    const handleSave = async () => {
        if (!draftName || !draftOrder) {
            toast.error("Please fill Name and Order");
            return;
        }

        const sectionsArray = draftSections ? draftSections.split(',').map(s => s.trim()).filter(Boolean) : ["A"];
        const id = editingId || `C_${Date.now()}`;
        
        try {
            await saveClassConfig(schoolId, {
                id,
                classId: id,
                name: draftName,
                sections: sectionsArray,
                order: Number(draftOrder),
                schoolId: schoolId
            });

            toast.success(editingId ? "Class updated" : "Class added");
            handleCancel();
        } catch (error) {
            console.error(error);
            toast.error("Failed to save class");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-black text-foreground">Manage Classes</h3>
                    <p className="text-sm text-muted-foreground">Configure the active classes and sections in your school</p>
                </div>
                {editingId && (
                    <button onClick={handleCancel} className="text-xs font-bold text-destructive flex items-center gap-1 hover:underline">
                        <X className="w-3 h-3" /> Cancel Edit
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-muted/30 p-5 rounded-2xl border border-border items-end">
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-muted-foreground ml-1 uppercase tracking-widest">Class Name</label>
                    <input type="text" value={draftName} onChange={e => setDraftName(e.target.value)} placeholder="e.g. 10th" className="w-full px-4 py-3 text-sm bg-background border border-border rounded-xl font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all" />
                </div>
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-muted-foreground ml-1 uppercase tracking-widest">Sections</label>
                    <input type="text" value={draftSections} onChange={e => setDraftSections(e.target.value)} placeholder="A, B, C" className="w-full px-4 py-3 text-sm bg-background border border-border rounded-xl font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all" />
                </div>
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-muted-foreground ml-1 uppercase tracking-widest">Sort Order</label>
                    <input type="number" value={draftOrder} onChange={e => setDraftOrder(e.target.value)} placeholder="1" className="w-full px-4 py-3 text-sm bg-background border border-border rounded-xl font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all text-center" />
                </div>
                <button onClick={handleSave} className="bg-primary text-primary-foreground h-12 px-6 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:opacity-90 transition-all flex items-center justify-center gap-2">
                    {editingId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {editingId ? "Update Class" : "Add Class"}
                </button>
            </div>

            <div className="grid gap-3">
                {sorted.map(c => (
                    <div key={c.id} className={`p-4 bg-card border rounded-2xl flex justify-between items-center group transition-all ${editingId === c.id ? 'border-primary ring-1 ring-primary/20 bg-primary/5' : 'hover:border-primary/40'}`}>
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center font-black text-sm text-muted-foreground">
                                {c.order}
                            </div>
                            <div>
                                <span className="font-black text-base text-foreground uppercase tracking-tight">{c.name}</span>
                                <div className="flex gap-1.5 mt-1">
                                    {(c.sections || ["A"]).map((s: string) => (
                                        <span key={s} className="px-2.5 py-0.5 bg-background text-[10px] font-black rounded-lg border border-border text-primary/60">SEC {s}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEdit(c)} className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-all" title="Edit">
                                <Edit className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(c.id, c.name)} className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all" title="Delete">
                                <Trash className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const SubjectsSettings = ({ schoolId, subjects, classes, saveSubjectConfig, deleteSubjectConfig, role }: any) => {
    const [draftName, setDraftName] = useState('');
    const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);

    const handleEdit = (sub: SubjectConfig) => {
        setEditingId(sub.id);
        setDraftName(sub.name);
        setSelectedClasses(sub.classIds || []);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancel = () => {
        setEditingId(null);
        setDraftName('');
        setSelectedClasses([]);
    };

    const handleDelete = async (id: string, name: string) => {
        if (!window.confirm(`Delete subject ${name}? This cannot be undone.`)) return;
        await deleteSubjectConfig(schoolId, id);
        toast.success("Subject deleted");
    };

    const handleSave = async () => {
        if (!draftName) {
            toast.error("Subject name is required");
            return;
        }
        const id = editingId || `S_${Date.now()}`;
        await saveSubjectConfig(schoolId, { id, subjectId: id, name: draftName, classIds: selectedClasses });
        toast.success(editingId ? "Subject updated" : "Subject added");
        handleCancel();
    };

    const toggleClass = (classId: string) => {
        setSelectedClasses(prev => prev.includes(classId) ? prev.filter(c => c !== classId) : [...prev, classId]);
    };

    const toggleAllClasses = () => {
        if (selectedClasses.length === classes.length) setSelectedClasses([]);
        else setSelectedClasses(classes.map((c: any) => c.classId));
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-black text-foreground">Manage Subjects</h3>
                    <p className="text-sm text-muted-foreground">Define subjects and assign them to specific classes</p>
                </div>
                {editingId && (
                    <button onClick={handleCancel} className="text-xs font-bold text-destructive flex items-center gap-1 hover:underline">
                        <X className="w-3 h-3" /> Cancel Edit
                    </button>
                )}
            </div>

            <div className="space-y-4 bg-muted/30 p-6 rounded-2xl border border-border">
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-muted-foreground ml-1 uppercase tracking-widest">Subject Name</label>
                    <input type="text" value={draftName} onChange={e => setDraftName(e.target.value)} placeholder="e.g. Mathematics" className="w-full px-4 py-3 text-sm bg-background border border-border rounded-xl font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all" />
                </div>
                
                <div className="space-y-3 mt-2">
                    <div className="flex items-center justify-between px-1">
                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Applicable Classes</label>
                        <button onClick={toggleAllClasses} className="text-[10px] font-black uppercase text-primary hover:underline">
                            {selectedClasses.length === classes.length ? 'Deselect All' : 'Select All'}
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {classes.sort((a: any, b: any) => a.order - b.order).map((c: any) => (
                            <button 
                                key={c.id} 
                                onClick={() => toggleClass(c.classId)} 
                                className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all ${selectedClasses.includes(c.classId) ? 'bg-primary border-primary text-primary-foreground shadow-md shadow-primary/20' : 'bg-background border-border text-muted-foreground hover:border-primary/40'}`}
                            >
                                {c.name}
                            </button>
                        ))}
                    </div>
                </div>

                <button onClick={handleSave} className="bg-primary text-primary-foreground px-8 py-4 rounded-xl text-xs font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:opacity-90 transition-all flex items-center gap-2 mt-2">
                    {editingId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {editingId ? "Update Subject" : "Add Subject"}
                </button>
            </div>

            <div className="grid gap-3">
                {subjects.map((s: any) => (
                    <div key={s.id} className={`p-5 bg-card border rounded-2xl flex justify-between items-center group transition-all ${editingId === s.id ? 'border-primary ring-1 ring-primary/20 bg-primary/5' : 'hover:border-primary/40'}`}>
                        <div className="flex items-center gap-4">
                            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                                <BookOpen className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="font-black text-base text-foreground uppercase tracking-tight">{s.name}</div>
                                <div className="text-[10px] font-black text-muted-foreground mt-1 uppercase tracking-wider flex items-center gap-1.5">
                                    <span className="text-primary/40">Classes:</span> 
                                    {s.classIds?.length === 0 || !s.classIds
                                        ? 'All School'
                                        : s.classIds
                                            .map((id: string) => classes.find((c: any) => c.classId === id || c.id === id)?.name)
                                            .filter(Boolean)
                                            .join(', ')
                                    }
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEdit(s)} className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-all" title="Edit">
                                <Edit className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(s.id, s.name)} className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all" title="Delete">
                                <Trash className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const ExamsSettings = ({ schoolId, exams, saveExamConfig, deleteExamConfig, role }: any) => {
    const [draftName, setDraftName] = useState('');
    const [draftOrder, setDraftOrder] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);

    const sorted = [...exams].sort((a: any, b: any) => a.order - b.order);

    const handleEdit = (exam: ExamConfig) => {
        setEditingId(exam.id);
        setDraftName(exam.name);
        setDraftOrder(exam.order?.toString() || '');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancel = () => {
        setEditingId(null);
        setDraftName('');
        setDraftOrder('');
    };

    const handleDelete = async (id: string, name: string) => {
        if (!window.confirm(`Delete Exam ${name}? This will remove related data.`)) return;
        await deleteExamConfig(schoolId, id);
        toast.success("Exam removed");
    };

    const handleSave = async () => {
        if (!draftName || !draftOrder) {
            toast.error("Name and Order are required");
            return;
        }
        const id = editingId || `E_${Date.now()}`;
        await saveExamConfig(schoolId, { 
            id, 
            examId: id, 
            name: draftName, 
            order: parseInt(draftOrder), 
            isPublished: editingId ? (exams.find((e:any)=>e.id === editingId)?.isPublished || false) : false 
        });
        toast.success(editingId ? "Exam updated" : "Exam added");
        handleCancel();
    };

    const togglePublish = async (exam: any) => {
        await saveExamConfig(schoolId, { ...exam, isPublished: !exam.isPublished });
        toast.success(`Exam ${!exam.isPublished ? 'Published' : 'Hidden'}`);
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-black text-foreground">Manage Exams</h3>
                    <p className="text-sm text-muted-foreground">Configure the academic examination sessions</p>
                </div>
                {editingId && (
                    <button onClick={handleCancel} className="text-xs font-bold text-destructive flex items-center gap-1 hover:underline">
                        <X className="w-3 h-3" /> Cancel Edit
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-muted/30 p-6 rounded-2xl border border-border items-end">
                <div className="space-y-1.5 md:col-span-1">
                    <label className="text-[10px] font-black text-muted-foreground ml-1 uppercase tracking-widest">Exam Name</label>
                    <input type="text" value={draftName} onChange={e => setDraftName(e.target.value)} placeholder="e.g. First Terminal" className="w-full px-4 py-3 text-sm bg-background border border-border rounded-xl font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all" />
                </div>
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-muted-foreground ml-1 uppercase tracking-widest">Sort Order</label>
                    <input type="number" value={draftOrder} onChange={e => setDraftOrder(e.target.value)} placeholder="1" className="w-full px-4 py-3 text-sm bg-background border border-border rounded-xl font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all text-center" />
                </div>
                <button onClick={handleSave} className="bg-primary text-primary-foreground h-12 px-6 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:opacity-90 transition-all flex items-center justify-center gap-2">
                    {editingId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {editingId ? "Update Exam" : "Add Exam"}
                </button>
            </div>

            <div className="grid gap-3">
                {sorted.map(e => (
                    <div key={e.id} className={`p-4 bg-card border rounded-2xl flex justify-between items-center group transition-all ${editingId === e.id ? 'border-primary ring-1 ring-primary/20 bg-primary/5' : 'hover:border-primary/40'}`}>
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center font-black text-sm">
                                {e.order}
                            </div>
                            <div>
                                <span className="font-black text-base text-foreground uppercase tracking-tight">{e.name}</span>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${e.isPublished ? 'bg-success/10 text-success border border-success/20' : 'bg-muted text-muted-foreground border border-border'}`}>
                                        {e.isPublished ? 'Live' : 'Draft'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => togglePublish(e)} className={`p-2 rounded-lg transition-all ${e.isPublished ? 'text-success hover:bg-success/10' : 'text-muted-foreground hover:bg-muted'}`} title={e.isPublished ? 'Internalize (Hide)' : 'Publish'}>
                                {e.isPublished ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                            </button>
                            <div className="w-px h-4 bg-border mx-1" />
                            <button onClick={() => handleEdit(e)} className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-all" title="Edit">
                                <Edit className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(e.id, e.name)} className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all" title="Delete">
                                <Trash className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AcademicSettings;

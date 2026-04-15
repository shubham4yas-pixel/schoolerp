import { useState, useMemo, useRef, useEffect } from 'react';
import { Student } from '@/lib/types';
import { ChevronDown, Search, User } from 'lucide-react';
import StudentAvatar from '@/components/StudentAvatar';

interface StudentComboboxProps {
    students: Student[];
    selectedId: string;
    onSelect: (id: string) => void;
    placeholder?: string;
    label?: string;
}

/**
 * Searchable student picker that groups by Class → Section.
 * Replaces plain <select> for student selection across all forms.
 */
const StudentCombobox = ({
    students,
    selectedId,
    onSelect,
    placeholder = 'Select student...',
    label,
}: StudentComboboxProps) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const ref = useRef<HTMLDivElement>(null);

    const selected = useMemo(() => (students || []).find(s => s.id === selectedId), [students, selectedId]);

    const filtered = useMemo(() => {
        if (!students) return [];
        const q = query.toLowerCase();
        return q
            ? students.filter(s =>
                s.name.toLowerCase().includes(q) ||
                s.id.toLowerCase().includes(q) ||
                s.rollNumber?.toLowerCase().includes(q) ||
                (s as any).rollNo?.toLowerCase().includes(q)
            )
            : students;
    }, [students, query]);

    // Group by class → section
    const grouped = useMemo(() => {
        const map: Record<string, Record<string, Student[]>> = {};
        if (!filtered) return map;
        for (const s of filtered) {
            const cls = s.classId || (s as any).class || 'N/A';
            if (!map[cls]) map[cls] = {};
            if (!map[cls][s.section]) map[cls][s.section] = [];
            map[cls][s.section].push(s);
        }
        return map;
    }, [filtered]);

    // Close on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const handleSelect = (id: string) => {
        onSelect(id);
        setQuery('');
        setOpen(false);
    };

    return (
        <div ref={ref} className="relative">
            {label && <label className="block text-sm font-medium text-foreground mb-1.5">{label}</label>}

            {/* Trigger */}
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm bg-muted/50 border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring hover:bg-muted/70 transition-colors"
            >
                <span className={selected ? 'text-foreground' : 'text-muted-foreground'}>
                    {selected ? (
                        <span className="flex items-center gap-2">
                            <User className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="font-bold text-xs opacity-60 mr-1.5 whitespace-nowrap">[{selected.rollNumber || selected.id}]</span>
                            {selected.name}
                            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                {selected.classId || (selected as any).class || 'N/A'}-{selected.section}
                            </span>
                        </span>
                    ) : placeholder}
                </span>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown */}
            {open && (
                <div className="absolute z-[100] mt-1 w-full bg-card border border-border rounded-xl shadow-xl overflow-hidden">
                    {/* Search box */}
                    <div className="p-2 border-b border-border">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                            <input
                                autoFocus
                                type="text"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder="Type name or ID..."
                                className="w-full pl-8 pr-3 py-1.5 text-sm bg-muted/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                        </div>
                    </div>

                    {/* Options grouped by class/section */}
                    <div className="max-h-60 overflow-y-auto">
                        {filtered.length === 0 ? (
                            <div className="py-6 text-center text-sm text-muted-foreground">No students found</div>
                        ) : (
                            Object.entries(grouped)
                                .sort(([a], [b]) => a.localeCompare(b))
                                .map(([cls, sections]) => (
                                    <div key={cls}>
                                        <div className="px-3 py-1.5 text-xs font-bold text-muted-foreground bg-muted/30 sticky top-0">
                                            Class {cls}
                                        </div>
                                        {Object.entries(sections)
                                            .sort(([a], [b]) => a.localeCompare(b))
                                            .map(([sec, studs]) => (
                                                <div key={sec}>
                                                    <div className="px-4 py-1 text-xs font-semibold text-primary/70">Section {sec}</div>
                                                    {studs.map(s => (
                                                        <button
                                                            key={s.id}
                                                            type="button"
                                                            onClick={() => handleSelect(s.id)}
                                                            className={`w-full flex items-center justify-between px-4 py-2 text-sm hover:bg-muted/50 transition-colors text-left ${s.id === selectedId ? 'bg-primary/10 text-primary font-medium' : 'text-foreground'
                                                                }`}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <StudentAvatar
                                                                    student={s}
                                                                    className="w-6 h-6 rounded-md flex-shrink-0"
                                                                    initialsClassName="text-[10px] font-bold text-primary-foreground"
                                                                />
                                                                <span>{s.name}</span>
                                                            </div>
                                                            <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">{s.id}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            ))}
                                    </div>
                                ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentCombobox;

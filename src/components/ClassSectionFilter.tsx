import { useMemo } from 'react';
import { Student } from '@/lib/types';
import { getUniqueClasses, getUniqueSections, getClassName } from '@/lib/data-utils';
import { Users } from 'lucide-react';
import { useStore } from '@/store/useStore';

interface ClassSectionFilterProps {
    students: Student[];
    selectedClass?: string;
    selectedSection?: string;
    searchQuery?: string;
    onClassChange?: (cls: string) => void;
    onSectionChange?: (section: string) => void;
    onSearchChange?: (q: string) => void;
    showSearch?: boolean;
    compact?: boolean;
    useGlobal?: boolean;
}

/** Reusable hierarchical Class → Section → Search filter used across all modules */
const ClassSectionFilter = ({
    students,
    selectedClass: propsClass,
    selectedSection: propsSection,
    searchQuery: propsSearch = '',
    onClassChange: propsOnClassChange,
    onSectionChange: propsOnSectionChange,
    onSearchChange: propsOnSearchChange,
    showSearch = false,
    compact = false,
    useGlobal = false,
}: ClassSectionFilterProps) => {
    const {
        globalFilterClass, globalFilterSection, globalFilterSearch,
        setGlobalFilterClass, setGlobalFilterSection, setGlobalFilterSearch,
        classes: storeClasses, loading
    } = useStore();

    const selectedClass = useGlobal ? globalFilterClass : (propsClass ?? '');
    const selectedSection = useGlobal ? globalFilterSection : (propsSection ?? '');
    const searchQuery = useGlobal ? globalFilterSearch : propsSearch;

    const onClassChange = useGlobal ? setGlobalFilterClass : (propsOnClassChange ?? (() => { }));
    const onSectionChange = useGlobal ? setGlobalFilterSection : (propsOnSectionChange ?? (() => { }));
    const onSearchChange = useGlobal ? setGlobalFilterSearch : (propsOnSearchChange ?? (() => { }));

    // Use store classes as the absolute source of truth.
    const classes = useMemo(() => {
        return [...storeClasses].sort((a, b) => a.order - b.order).map(c => c.classId);
    }, [storeClasses]);

    const sections = useMemo(() => {
        if (!selectedClass) return [];
        const config = storeClasses.find(c => c.classId === selectedClass);
        if (config && config.sections) return config.sections;
        
        // Fallback to student data ONLY if config is missing (safety)
        return getUniqueSections(students, selectedClass);
    }, [students, storeClasses, selectedClass]);

    const selectCls = 'px-3 py-2 text-sm bg-muted/50 border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring';

    return (
        <div className={`flex flex-wrap gap-3 ${compact ? '' : 'p-4 bg-muted/20 rounded-xl border border-border'}`}>
            {!compact && (
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground w-full">
                    <Users className="w-4 h-4" />
                    <span>Filter Students</span>
                </div>
            )}

            {/* Class Selector */}
            <div className="flex-1 min-w-[120px]">
                {!compact && <label className="block text-xs font-medium text-muted-foreground mb-1">Class</label>}
                <select
                    value={selectedClass}
                    onChange={e => {
                        onClassChange(e.target.value);
                        onSectionChange(''); // reset section when class changes
                    }}
                    className={selectCls + ' w-full'}
                >
                    <option value="">{loading.classes ? "Syncing Classes..." : "All Classes"}</option>
                    {classes.map(c => (
                        <option key={c} value={c}>{getClassName(c, storeClasses)}</option>
                    ))}
                </select>
            </div>

            {/* Section Selector — only visible when class is selected */}
            {selectedClass && (
                <div className="flex-1 min-w-[120px]">
                    {!compact && <label className="block text-xs font-medium text-muted-foreground mb-1">Section</label>}
                    <select
                        value={selectedSection}
                        onChange={e => onSectionChange(e.target.value)}
                        className={selectCls + ' w-full'}
                    >
                        <option value="">All Sections</option>
                        {sections.map(s => (
                            <option key={s} value={s}>Section {s}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* Optional search */}
            {showSearch && onSearchChange && (
                <div className="flex-[2] min-w-[180px]">
                    {!compact && <label className="block text-xs font-medium text-muted-foreground mb-1">Search</label>}
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => onSearchChange(e.target.value)}
                        placeholder="Search name or ID..."
                        className={selectCls + ' w-full'}
                    />
                </div>
            )}
        </div>
    );
};

export default ClassSectionFilter;

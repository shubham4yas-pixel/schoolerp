import { UserRole } from './types';

export const ACCESS_MAP: Record<UserRole, string[]> = {
    admin: [
        "overview",
        "classConsole",
        "dataEntry",
        "uploadSheets",
        "studentSearch",
        "compare",
        "busTransport",
        "academicSettings",
        "feeSettings",
        "credentials"
    ],

    accountant: [
        "overview",
        "dataEntry",
        "uploadSheets",
        "busTransport",
        "feeSettings"
    ],

    teacher: [
        "overview",
        "classConsole",
        "dataEntry",
        "uploadSheets",
        "studentSearch",
        "compare"
    ],

    student: [
        "overview",
        "compare",
        "attendance"
    ],

    parent: [
        "overview"
    ]
};

/**
 * Mapping between internal Tab IDs and RBAC Feature Keys
 */
export const TAB_FEATURE_MAP: Record<string, string> = {
    'overview': 'overview',
    'console': 'classConsole',
    'forms': 'dataEntry',
    'upload': 'uploadSheets',
    'search': 'studentSearch',
    'compare': 'compare',
    'bus': 'busTransport',
    'academic_settings': 'academicSettings',
    'settings': 'feeSettings',
    'credentials': 'credentials',
    'attendance': 'attendance'
};

/**
 * Mapping for sub-features within components (e.g., DataEntryForms)
 */
export const SUB_FEATURE_MAP: Record<UserRole, string[]> = {
    admin: ['student', 'marks', 'attendance', 'feedback', 'fees'],
    accountant: ['fees'],
    teacher: ['marks', 'attendance', 'feedback'],
    student: [],
    parent: []
};

export const hasAccess = (role: UserRole, feature: string): boolean => {
    return ACCESS_MAP[role]?.includes(feature) || false;
};

export const hasSubAccess = (role: UserRole, subFeature: string): boolean => {
    return SUB_FEATURE_MAP[role]?.includes(subFeature) || false;
};

export const canViewTab = (role: UserRole, tabId: string): boolean => {
    const feature = TAB_FEATURE_MAP[tabId];
    if (!feature) return true; // Default to visible if not mapped
    return hasAccess(role, feature);
};

export const filterTabs = <T extends { id: string }>(role: UserRole, tabs: T[]): T[] => {
    return tabs.filter(tab => canViewTab(role, tab.id));
};

/**
 * One-time migration script: Firebase → Supabase
 * Migrates classes, subjects, and exams for school_001.
 *
 * Run from the browser console or as a standalone script with:
 *   import { runAcademicMigration } from '@/scripts/migrate_academic_to_supabase';
 *   runAcademicMigration('school_001');
 */

import { db } from '@/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { supabase } from '@/lib/supabase';

async function migrateClasses(schoolId: string) {
    console.log('📦 Migrating classes...');
    const snap = await getDocs(collection(db, 'schools', schoolId, 'classes'));
    const records = snap.docs.map(doc => {
        const d = doc.data();
        return {
            id: doc.id,
            school_id: schoolId,
            name: d.name || '',
            order: d.order ?? 0,
            sections: d.sections ?? [],
        };
    });

    if (!records.length) {
        console.warn('  No classes found in Firebase.');
        return { success: 0, failed: 0 };
    }

    const { error } = await supabase.from('classes').upsert(records, { onConflict: 'id' });
    if (error) {
        console.error('  Classes migration failed:', error);
        return { success: 0, failed: records.length };
    }
    console.log(`  ✅ Migrated ${records.length} classes`);
    return { success: records.length, failed: 0 };
}

async function migrateSubjects(schoolId: string) {
    console.log('📦 Migrating subjects...');
    const snap = await getDocs(collection(db, 'schools', schoolId, 'config', 'academic', 'subjects'));
    const records = snap.docs.map(doc => {
        const d = doc.data();
        return {
            id: doc.id,
            school_id: schoolId,
            name: d.name || '',
            class_ids: d.classIds ?? [],
        };
    });

    if (!records.length) {
        console.warn('  No subjects found in Firebase.');
        return { success: 0, failed: 0 };
    }

    const { error } = await supabase.from('subjects').upsert(records, { onConflict: 'id' });
    if (error) {
        console.error('  Subjects migration failed:', error);
        return { success: 0, failed: records.length };
    }
    console.log(`  ✅ Migrated ${records.length} subjects`);
    return { success: records.length, failed: 0 };
}

async function migrateExams(schoolId: string) {
    console.log('📦 Migrating exams...');
    const snap = await getDocs(collection(db, 'schools', schoolId, 'config', 'academic', 'exams'));
    const records = snap.docs.map(doc => {
        const d = doc.data();
        return {
            id: doc.id,
            school_id: schoolId,
            name: d.name || '',
            order: d.order ?? 0,
            exam_date: d.examDate ?? null,
            result_date: d.resultDate ?? null,
            is_published: d.isPublished ?? false,
        };
    });

    if (!records.length) {
        console.warn('  No exams found in Firebase.');
        return { success: 0, failed: 0 };
    }

    const { error } = await supabase.from('exams').upsert(records, { onConflict: 'id' });
    if (error) {
        console.error('  Exams migration failed:', error);
        return { success: 0, failed: records.length };
    }
    console.log(`  ✅ Migrated ${records.length} exams`);
    return { success: records.length, failed: 0 };
}

export async function runAcademicMigration(schoolId = 'school_001') {
    console.log(`🚀 Starting academic migration for school: ${schoolId}`);

    const classesResult  = await migrateClasses(schoolId);
    const subjectsResult = await migrateSubjects(schoolId);
    const examsResult    = await migrateExams(schoolId);

    console.log('─────────────────────────────────');
    console.log('Migration Summary:');
    console.log(`  Classes  → ✅ ${classesResult.success}  ❌ ${classesResult.failed}`);
    console.log(`  Subjects → ✅ ${subjectsResult.success}  ❌ ${subjectsResult.failed}`);
    console.log(`  Exams    → ✅ ${examsResult.success}  ❌ ${examsResult.failed}`);
    console.log('─────────────────────────────────');

    return { classesResult, subjectsResult, examsResult };
}

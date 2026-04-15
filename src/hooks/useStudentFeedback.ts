import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Feedback } from '@/lib/types';

type UseStudentFeedbackOptions = {
  schoolId?: string;
  studentId?: string;
  publishedOnly?: boolean;
};

const normalizeFeedback = (feedback: Partial<Feedback> & { id: string }): Feedback => ({
  id: feedback.id,
  studentId: feedback.studentId || '',
  class: feedback.class || '',
  classId: feedback.classId || '',
  section: feedback.section || '',
  teacherId: feedback.teacherId || '',
  teacherName: feedback.teacherName || 'Teacher',
  examType: feedback.examType || '',
  feedbackText: String(feedback.feedbackText || feedback.remark || '').trim(),
  status: feedback.status || 'draft',
  createdAt: feedback.createdAt || feedback.updatedAt || feedback.date || '',
  updatedAt: feedback.updatedAt || feedback.createdAt || feedback.date || '',
  category: feedback.category,
  remark: String(feedback.remark || feedback.feedbackText || '').trim(),
  date: feedback.date || feedback.updatedAt || feedback.createdAt || '',
});

const getFeedbackSortTime = (feedback: Feedback) =>
  new Date(feedback.updatedAt || feedback.createdAt || feedback.date || 0).getTime();

const getFeedbackKey = (feedback: Feedback) =>
  [
    feedback.studentId,
    feedback.teacherId || feedback.teacherName || '',
    feedback.examType || '',
    feedback.feedbackText || feedback.remark || '',
    feedback.date || feedback.createdAt || feedback.updatedAt || '',
  ].join('__');

export const useStudentFeedback = ({
  schoolId,
  studentId,
  publishedOnly = false,
}: UseStudentFeedbackOptions) => {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db || !schoolId || !studentId) {
      setFeedback([]);
      setLoading(false);
      return;
    }

    let legacyFeedback: Feedback[] = [];
    let currentFeedback: Feedback[] = [];

    const syncFeedback = () => {
      const deduped = new Map<string, Feedback>();

      [...legacyFeedback, ...currentFeedback]
        .map(normalizeFeedback)
        .filter(entry => entry.studentId === studentId && (entry.feedbackText || entry.remark))
        .forEach((entry) => {
          const key = getFeedbackKey(entry);
          const existing = deduped.get(key);

          if (!existing || getFeedbackSortTime(entry) >= getFeedbackSortTime(existing)) {
            deduped.set(key, entry);
          }
        });

      const next = [...deduped.values()]
        .filter(entry => !publishedOnly || entry.status === 'published')
        .sort((left, right) => getFeedbackSortTime(right) - getFeedbackSortTime(left));

      setFeedback(next);
      setLoading(false);
    };

    const legacyQuery = query(
      collection(db, 'schools', schoolId, 'feedback'),
      where('studentId', '==', studentId),
    );
    const currentQuery = query(
      collection(db, 'schools', schoolId, 'feedbacks'),
      where('studentId', '==', studentId),
    );

    const unsubLegacy = onSnapshot(
      legacyQuery,
      (snapshot) => {
        legacyFeedback = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Feedback));
        syncFeedback();
      },
      (error) => {
        console.error('Legacy feedback listener error:', error);
        syncFeedback();
      },
    );

    const unsubCurrent = onSnapshot(
      currentQuery,
      (snapshot) => {
        currentFeedback = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Feedback));
        syncFeedback();
      },
      (error) => {
        console.error('Feedback listener error:', error);
        syncFeedback();
      },
    );

    return () => {
      unsubLegacy();
      unsubCurrent();
    };
  }, [schoolId, studentId, publishedOnly]);

  const latestFeedback = useMemo(() => feedback[0] || null, [feedback]);

  return { feedback, loading, latestFeedback };
};

export default useStudentFeedback;

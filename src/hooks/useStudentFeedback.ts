import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
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

const mapFeedbackRow = (row: any): Feedback => normalizeFeedback({
  id: String(row.id || ''),
  studentId: String(row.student_id || row.studentId || ''),
  class: row.class || '',
  classId: row.class_id || row.classId || '',
  section: row.section || '',
  teacherId: row.teacher_id || row.teacherId || '',
  teacherName: row.teacher_name || row.teacherName || 'Teacher',
  examType: row.exam_type || row.examType || '',
  feedbackText: row.feedback_text || row.feedbackText || '',
  status: row.status || 'draft',
  createdAt: row.created_at || row.createdAt || '',
  updatedAt: row.updated_at || row.updatedAt || '',
  category: row.category || undefined,
  remark: row.remark || row.feedback_text || '',
  date: row.date || '',
});

const getFeedbackSortTime = (feedback: Feedback) =>
  new Date(feedback.updatedAt || feedback.createdAt || feedback.date || 0).getTime();

export const useStudentFeedback = ({
  schoolId,
  studentId,
  publishedOnly = false,
}: UseStudentFeedbackOptions) => {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!schoolId || !studentId) {
      setFeedback([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadFeedback = async () => {
      setLoading(true);

      try {
        let query = supabase
          .from('feedbacks')
          .select('*')
          .eq('school_id', schoolId)
          .eq('student_id', studentId);

        if (publishedOnly) {
          query = query.eq('status', 'published');
        }

        const { data, error } = await query;
        if (error) throw error;

        if (!cancelled) {
          const mapped = (data || []).map(mapFeedbackRow).sort((left, right) => getFeedbackSortTime(right) - getFeedbackSortTime(left));
          setFeedback(mapped);
        }
      } catch (error) {
        console.error('Failed to fetch feedback:', error);
        if (!cancelled) setFeedback([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadFeedback();

    return () => {
      cancelled = true;
    };
  }, [schoolId, studentId, publishedOnly]);

  const latestFeedback = useMemo(() => feedback[0] || null, [feedback]);

  return { feedback, loading, latestFeedback };
};

export default useStudentFeedback;

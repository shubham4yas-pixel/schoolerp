import { useMemo } from 'react';
import { Feedback } from '@/lib/types';

interface FeedbackListProps {
  feedback: Feedback[];
  limit?: number;
  emptyMessage?: string;
}

const getFeedbackTime = (entry: Feedback) =>
  new Date(entry.updatedAt || entry.createdAt || entry.date || 0).getTime();

const formatFeedbackTime = (value?: string) =>
  new Date(value || Date.now()).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

const FeedbackList = ({
  feedback,
  limit,
  emptyMessage = 'No feedback yet.',
}: FeedbackListProps) => {
  const items = useMemo(() => {
    const sorted = [...feedback].sort((left, right) => getFeedbackTime(right) - getFeedbackTime(left));
    return typeof limit === 'number' ? sorted.slice(0, limit) : sorted;
  }, [feedback, limit]);

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-4">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-3">
      {items.map(entry => (
        <div key={entry.id} className="bg-muted/30 rounded-lg p-4">
          <div className="flex justify-between items-start gap-3 mb-1">
            <div className="min-w-0">
              <span className="text-sm font-medium text-foreground">{entry.teacherName || 'Teacher'}</span>
              {entry.examType && (
                <p className="text-[11px] text-muted-foreground mt-0.5">{entry.examType}</p>
              )}
            </div>
            <span className="text-xs text-muted-foreground text-right shrink-0">
              {formatFeedbackTime(entry.updatedAt || entry.createdAt || entry.date)}
            </span>
          </div>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {entry.feedbackText || entry.remark}
          </p>
        </div>
      ))}
    </div>
  );
};

export default FeedbackList;

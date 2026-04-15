import { useEffect, useState } from 'react';
import { Student } from '@/lib/types';

interface StudentAvatarProps {
  student: Pick<Student, 'name' | 'avatarColor' | 'photoURL'>;
  className?: string;
  initialsClassName?: string;
}

export const getStudentInitials = (name?: string) =>
  (name || 'Student')
    .split(' ')
    .map(part => part.trim()[0] || '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

const StudentAvatar = ({
  student,
  className = '',
  initialsClassName = '',
}: StudentAvatarProps) => {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [student.photoURL]);

  const showImage = Boolean(student.photoURL) && !imageFailed;

  return (
    <div
      className={`relative overflow-hidden flex items-center justify-center ${className}`.trim()}
      style={showImage ? undefined : { backgroundColor: student.avatarColor || '#6366f1' }}
    >
      {showImage ? (
        <img
          src={student.photoURL}
          alt={`${student.name} profile`}
          className="w-full h-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span className={initialsClassName}>{getStudentInitials(student.name)}</span>
      )}
    </div>
  );
};

export default StudentAvatar;

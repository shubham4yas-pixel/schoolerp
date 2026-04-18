/**
 * ProfilePhotoWidget
 * A reusable avatar with a camera-icon overlay for uploading profile photos.
 * Used in Teacher, Student, and Parent dashboards.
 */
import React, { useRef, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { uploadUserProfileImage, uploadProfileImage } from '@/lib/profileImageUpload';
import { useAuth } from '@/contexts/AuthContext';

interface ProfilePhotoWidgetProps {
  /** Current photo URL (or empty string) */
  photoURL?: string;
  /** Display name for avatar initials fallback */
  name: string;
  /** size class, e.g. 'w-20 h-20' */
  size?: string;
  /** For students: pass studentId + schoolId to use uploadProfileImage */
  studentId?: string;
  schoolId?: string;
  /** Called with the new data-url after a successful upload */
  onUploadSuccess?: (dataUrl: string) => void;
  /** Whether the widget should allow uploads */
  editable?: boolean;
}

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const ProfilePhotoWidget = ({
  photoURL,
  name,
  size = 'w-20 h-20',
  studentId,
  schoolId,
  onUploadSuccess,
  editable = true,
}: ProfilePhotoWidgetProps) => {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<string>(photoURL || '');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Update preview if parent changes photoURL
  React.useEffect(() => {
    setPreview(photoURL || '');
  }, [photoURL]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || uploading) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be smaller than 5 MB');
      return;
    }

    // Show local preview immediately
    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);
    setUploading(true);
    setProgress(0);

    try {
      let dataUrl: string;

      if (studentId && schoolId) {
        // Student route: update students table
        dataUrl = await uploadProfileImage(file, studentId, schoolId, setProgress);
      } else if (user?.uid) {
        // Non-student route: update user_profiles table
        dataUrl = await uploadUserProfileImage(file, user.uid, setProgress);
      } else {
        throw new Error('Cannot upload: no valid user id found');
      }

      URL.revokeObjectURL(localPreview);
      setPreview(dataUrl);
      onUploadSuccess?.(dataUrl);
      toast.success('Profile photo updated!');
    } catch (err: any) {
      setPreview(photoURL || '');
      toast.error(err?.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className={`relative ${size} flex-shrink-0`}>
      {/* Avatar circle */}
      <div className={`${size} rounded-2xl overflow-hidden bg-gradient-to-br from-primary/80 to-secondary/80 flex items-center justify-center ring-2 ring-border`}>
        {preview ? (
          <img src={preview} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-xl font-bold text-white select-none">{getInitials(name)}</span>
        )}

        {/* Upload progress overlay */}
        {uploading && (
          <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center rounded-2xl gap-1">
            <Loader2 className="w-6 h-6 text-white animate-spin" />
            <span className="text-xs text-white font-medium">{progress}%</span>
          </div>
        )}
      </div>

      {/* Camera button */}
      {editable && !uploading && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:opacity-90 transition-opacity border-2 border-background"
          title="Change profile photo"
        >
          <Camera className="w-3.5 h-3.5" />
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
};

export default ProfilePhotoWidget;

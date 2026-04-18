import { supabase } from "@/lib/supabase";

const mapUploadError = (error: unknown) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Upload failed. Please retry.";
};

const readFileAsDataUrl = (file: File, onProgress?: (progress: number) => void) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress?.(Math.round((event.loaded / event.total) * 70));
      }
    };

    reader.onerror = () => reject(reader.error || new Error("Could not read image file"));
    reader.onload = () => {
      onProgress?.(85);
      resolve(String(reader.result || ""));
    };
    reader.readAsDataURL(file);
  });

/**
 * Upload a profile picture for a student.
 * Saves the photo_url to the students table by roll_number/id.
 */
export async function uploadProfileImage(
  file: File,
  studentId: string,
  schoolId: string,
  onProgress?: (progress: number) => void,
) {
  if (!file || file.size === 0) {
    console.error("Invalid file");
    throw new Error("Invalid file");
  }

  if (!studentId) {
    console.error("Missing studentId for profile upload");
    throw new Error("Missing student id");
  }

  if (!schoolId) {
    console.error("Missing schoolId for profile upload");
    throw new Error("Missing school id");
  }

  if (!file.type.startsWith("image/")) {
    throw new Error("Please select an image file");
  }

  try {
    onProgress?.(10);
    const imageDataUrl = await readFileAsDataUrl(file, onProgress);

    const { error } = await supabase
      .from("students")
      .update({
        profile_image: imageDataUrl,
        photo_url: imageDataUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("school_id", schoolId)
      .eq("roll_number", studentId);

    if (error) throw error;

    onProgress?.(100);
    return imageDataUrl;
  } catch (error) {
    console.error("PROFILE IMAGE SAVE ERROR:", error);
    throw new Error(mapUploadError(error));
  }
}

/**
 * Upload a profile picture for a non-student user (teacher, parent, accountant, admin).
 * Saves the photo_url to the user_profiles table by uid.
 */
export async function uploadUserProfileImage(
  file: File,
  uid: string,
  onProgress?: (progress: number) => void,
): Promise<string> {
  if (!file || file.size === 0) throw new Error("Invalid file");
  if (!uid) throw new Error("Missing user id");
  if (!file.type.startsWith("image/")) throw new Error("Please select an image file");

  try {
    onProgress?.(10);
    const imageDataUrl = await readFileAsDataUrl(file, onProgress);
    onProgress?.(90);

    const { error } = await supabase
      .from("user_profiles")
      .update({
        photo_url: imageDataUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", uid);

    if (error) throw error;

    onProgress?.(100);
    return imageDataUrl;
  } catch (error) {
    console.error("USER PROFILE IMAGE SAVE ERROR:", error);
    throw new Error(mapUploadError(error));
  }
}

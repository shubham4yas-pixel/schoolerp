import { doc, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { sanitize } from "@/lib/data-utils";

const mapUploadError = (error: unknown) => {
  const code = typeof error === "object" && error && "code" in error
    ? String((error as { code?: string }).code)
    : "";

  switch (code) {
    case "storage/unknown":
    case "storage/retry-limit-exceeded":
    case "storage/unauthorized":
    case "storage/canceled":
      return "Upload failed. Please retry.";
    default:
      if (error instanceof Error && error.message) {
        return error.message;
      }
      return "Upload failed. Please retry.";
  }
};

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

  if (!file.type.startsWith("image/")) {
    throw new Error("Please select an image file");
  }

  console.log("FILE:", file);
  console.log("SIZE:", file.size);
  console.log("TYPE:", file.type);

  const storageRef = ref(storage, `profilePictures/${studentId}.jpg`);
  console.log("STORAGE PATH:", storageRef.fullPath);
  console.log(
    "EXPECTED STORAGE ENDPOINT:",
    `https://firebasestorage.googleapis.com/v0/b/${storage.app.options.storageBucket}/o`,
  );

  const uploadTask = uploadBytesResumable(storageRef, file);

  return new Promise<string>((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress = snapshot.totalBytes > 0
          ? (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          : 0;

        console.log("STATE:", snapshot.state);
        console.log("Progress:", progress);
        onProgress?.(progress);
      },
      (error) => {
        console.error("ERROR CODE:", error.code);
        console.error("ERROR MSG:", error.message);
        reject(new Error(mapUploadError(error)));
      },
      async () => {
        try {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          console.log("SUCCESS URL:", url);

          await setDoc(
            doc(db, "schools", schoolId, "students", studentId),
            sanitize({
              profileImage: url,
              photoURL: url,
            }),
            { merge: true },
          );

          resolve(url);
        } catch (error) {
          console.error("PROFILE IMAGE SAVE ERROR:", error);
          reject(new Error(mapUploadError(error)));
        }
      },
    );
  });
}

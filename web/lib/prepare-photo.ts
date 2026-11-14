import { cropPhoto, type CropKind } from "@/components/photo-cropper";
import { facePhotoError, rejectUnclearFacePhoto } from "@/lib/face-check";

export async function preparePhoto(file: File, kind: CropKind): Promise<File | null> {
  const cropped = await cropPhoto(file, kind);
  if (!cropped) return null;
  if (kind === "profile" || kind === "selfie") {
    const problem = await rejectUnclearFacePhoto(cropped);
    if (problem) throw new Error(problem || facePhotoError);
  }
  return cropped;
}

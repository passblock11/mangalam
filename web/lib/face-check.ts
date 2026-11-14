export const facePhotoError = "Use a clear photo where every face is fully visible and looking at the camera.";

type Landmark = { x: number; y: number };
type Blend = { categories?: Array<{ categoryName?: string; score?: number }> };
type Matrix = { data?: number[] };
type Detection = { faceLandmarks?: Landmark[][]; faceBlendshapes?: Blend[]; facialTransformationMatrixes?: Matrix[] };

let landmarkerPromise: Promise<{ detect: (image: HTMLCanvasElement) => Detection }> | null = null;

async function detector() {
  if (!landmarkerPromise) {
    const pending = (async () => {
      const vision = await import("@mediapipe/tasks-vision");
      const files = await vision.FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm",
      );
      const created = await vision.FaceLandmarker.createFromOptions(files, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "IMAGE",
        numFaces: 6,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
      });
      return created as unknown as { detect: (image: HTMLCanvasElement) => Detection };
    })();
    landmarkerPromise = pending;
    pending.catch(() => {
      landmarkerPromise = null;
    });
  }
  return landmarkerPromise;
}

export async function rejectUnclearFacePhoto(file: File): Promise<string | null> {
  try {
    const image = await createImageBitmap(file);
    if (image.width < 32 || image.height < 32) return facePhotoError;
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d");
    if (!context) return facePhotoError;
    context.drawImage(image, 0, 0);
    image.close();
    const result = (await detector()).detect(canvas);
    const faces = result.faceLandmarks ?? [];
    if (faces.length === 0) return facePhotoError;
    for (let index = 0; index < faces.length; index += 1) {
      if (!faceIsClear(faces[index], imageSize(canvas), result.faceBlendshapes?.[index], result.facialTransformationMatrixes?.[index])) {
        return facePhotoError;
      }
    }
    return null;
  } catch {
    return facePhotoError;
  }
}

function imageSize(canvas: HTMLCanvasElement) {
  return { width: canvas.width, height: canvas.height };
}

function faceIsClear(landmarks: Landmark[], size: { width: number; height: number }, blend: Blend | undefined, matrix: Matrix | undefined) {
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const point of landmarks) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  const boxWidth = (maxX - minX) * size.width;
  const boxHeight = (maxY - minY) * size.height;
  const imageShort = Math.min(size.width, size.height);
  const faceShort = Math.min(boxWidth, boxHeight);
  if (faceShort < imageShort * 0.12) return false;
  const pose = headPose(matrix?.data);
  if (!pose) return false;
  if (Math.abs(pose.yaw) > 30 || Math.abs(pose.pitch) > 25) return false;
  if (landmarks.length < 10) return false;
  const blink = (name: string) => blend?.categories?.find((item) => item.categoryName === name)?.score;
  const left = blink("eyeBlinkLeft");
  const right = blink("eyeBlinkRight");
  if (left != null && right != null && (1 - left < 0.4 || 1 - right < 0.4)) return false;
  return true;
}

function headPose(data: number[] | undefined) {
  if (!data || data.length < 11) return null;
  const columnMajor = data.length >= 16;
  const r20 = columnMajor ? data[2] : data[8];
  const r21 = columnMajor ? data[6] : data[9];
  const r22 = columnMajor ? data[10] : data[10];
  const pitch = (Math.asin(Math.max(-1, Math.min(1, -r21))) * 180) / Math.PI;
  const yaw = (Math.atan2(r20, r22) * 180) / Math.PI;
  return { pitch, yaw };
}

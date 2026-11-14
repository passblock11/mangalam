import 'dart:ui' as ui;

import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import 'package:image_picker/image_picker.dart';

/// Shown when a photo cannot be saved. The check itself draws nothing.
const facePhotoError =
    'Use a clear photo where every face is fully visible and looking at the camera.';

/// Accepts a photo when every detected face is facing the camera and is at
/// least a little close. A face that is only slightly farther away still
/// passes. No boxes or guides are drawn.
Future<String?> rejectUnclearFacePhoto(XFile file) async {
  final detector = FaceDetector(
    options: FaceDetectorOptions(
      performanceMode: FaceDetectorMode.accurate,
      enableLandmarks: true,
      enableClassification: true,
      enableContours: false,
      enableTracking: false,
      minFaceSize: 0.05,
    ),
  );
  try {
    final size = await _imageSize(file);
    if (size == null) return facePhotoError;
    final faces = await detector.processImage(InputImage.fromFilePath(file.path));
    if (faces.isEmpty) return facePhotoError;
    for (final face in faces) {
      if (!_faceIsClear(face, size.$1, size.$2)) return facePhotoError;
    }
    return null;
  } catch (_) {
    return facePhotoError;
  } finally {
    await detector.close();
  }
}

Future<(int, int)?> _imageSize(XFile file) async {
  try {
    final bytes = await file.readAsBytes();
    final codec = await ui.instantiateImageCodec(bytes);
    final frame = await codec.getNextFrame();
    final width = frame.image.width;
    final height = frame.image.height;
    frame.image.dispose();
    codec.dispose();
    if (width < 32 || height < 32) return null;
    return (width, height);
  } catch (_) {
    return null;
  }
}

bool _faceIsClear(Face face, int width, int height) {
  final box = face.boundingBox;
  // Compare the face with the shorter photo edge so a clear face that is a
  // little farther away still passes. A face under 12% of that edge is too far.
  final imageShort = width < height ? width : height;
  final faceShort = box.width < box.height ? box.width : box.height;
  if (faceShort < imageShort * 0.12) return false;
  final yaw = face.headEulerAngleY;
  final pitch = face.headEulerAngleX;
  if (yaw == null || pitch == null) return false;
  if (yaw.abs() > 30 || pitch.abs() > 25) return false;
  if (face.landmarks[FaceLandmarkType.leftEye] == null) return false;
  if (face.landmarks[FaceLandmarkType.rightEye] == null) return false;
  if (face.landmarks[FaceLandmarkType.noseBase] == null) return false;
  final left = face.leftEyeOpenProbability;
  final right = face.rightEyeOpenProbability;
  if (left != null && right != null && (left < 0.4 || right < 0.4)) return false;
  return true;
}

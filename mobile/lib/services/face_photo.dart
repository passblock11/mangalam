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
      minFaceSize: 0.03,
    ),
  );
  try {
    final size = await _imageSize(file);
    if (size == null) return facePhotoError;
    final faces = await detector.processImage(InputImage.fromFilePath(file.path));
    if (faces.isEmpty) return facePhotoError;
    final toCheck = _facesToValidate(faces);
    if (toCheck.isEmpty) return facePhotoError;
    for (final face in toCheck) {
      if (!_faceIsClear(face, size.$1, size.$2)) return facePhotoError;
    }
    return null;
  } catch (_) {
    return facePhotoError;
  } finally {
    await detector.close();
  }
}

/// ML Kit sometimes emits a tiny false positive next to the main subject.
List<Face> _facesToValidate(List<Face> faces) {
  if (faces.length <= 1) return faces;
  var largest = 0.0;
  for (final face in faces) {
    final box = face.boundingBox;
    final area = box.width * box.height;
    if (area > largest) largest = area;
  }
  if (largest <= 0) return faces;
  return faces.where((face) {
    final box = face.boundingBox;
    final area = box.width * box.height;
    return area >= largest * 0.3;
  }).toList();
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
  final imageShort = width < height ? width : height;
  final imageLong = width > height ? width : height;
  final faceShort = box.width < box.height ? box.width : box.height;
  final faceArea = box.width * box.height;
  final imageArea = width * height;

  // Size: allow clear portraits where the face is not huge in frame (3:4 crop, slight distance).
  final shortFrac = faceShort / imageShort;
  final areaFrac = faceArea / imageArea;
  final longFrac = faceShort / imageLong;
  final largeEnough =
      shortFrac >= 0.07 || areaFrac >= 0.0035 || longFrac >= 0.09;
  if (!largeEnough) return false;

  final yaw = face.headEulerAngleY;
  final pitch = face.headEulerAngleX;
  if (yaw != null && yaw.abs() > 42) return false;
  if (pitch != null && pitch.abs() > 36) return false;

  final leftEye = face.landmarks[FaceLandmarkType.leftEye];
  final rightEye = face.landmarks[FaceLandmarkType.rightEye];
  final nose = face.landmarks[FaceLandmarkType.noseBase];
  if (leftEye == null || rightEye == null) return false;
  if (nose == null && shortFrac < 0.05) return false;

  final left = face.leftEyeOpenProbability;
  final right = face.rightEyeOpenProbability;
  if (left != null && right != null && left < 0.22 && right < 0.22) return false;

  return true;
}
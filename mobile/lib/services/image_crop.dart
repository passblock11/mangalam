import 'package:flutter/material.dart';
import 'package:image_cropper/image_cropper.dart';
import 'package:image_picker/image_picker.dart';

import '../l10n/app_locale.dart';

/// Where the photo will be used. This only chooses the starting frame.
/// The frame can still be moved, zoomed, and switched to another ratio.
enum ImageCropKind { profile, selfie, document, chat, report }

class _Ratio implements CropAspectRatioPresetData {
  const _Ratio(this.name, this.data);

  @override
  final String name;

  @override
  final (int, int)? data;
}

/// Opens the native cropper after a photo is chosen.
/// Cancel returns null. A cropper failure returns the original file so the
/// upload can still continue.
class ImageCrop {
  ImageCrop._();

  static const _portrait = _Ratio('3:4', (3, 4));
  static const _story = _Ratio('9:16', (9, 16));

  static const _presets = <CropAspectRatioPresetData>[
    CropAspectRatioPreset.original,
    CropAspectRatioPreset.square,
    _portrait,
    CropAspectRatioPreset.ratio4x3,
    _story,
    CropAspectRatioPreset.ratio16x9,
  ];

  static bool isRaster(String name) {
    final lower = name.toLowerCase();
    return lower.endsWith('.jpg') ||
        lower.endsWith('.jpeg') ||
        lower.endsWith('.png') ||
        lower.endsWith('.webp') ||
        lower.endsWith('.heic') ||
        lower.endsWith('.heif');
  }

  static Future<List<XFile>> many(List<XFile> files, ImageCropKind kind) async {
    final out = <XFile>[];
    for (final file in files) {
      final cropped = await one(file, kind);
      if (cropped != null) out.add(cropped);
    }
    return out;
  }

  static Future<XFile?> one(XFile file, ImageCropKind kind) async {
    if (file.path.isEmpty) return file;
    try {
      final cropped = await ImageCropper().cropImage(
        sourcePath: file.path,
        maxWidth: 1600,
        maxHeight: 1600,
        compressFormat: ImageCompressFormat.jpg,
        compressQuality: 88,
        uiSettings: [
          AndroidUiSettings(
            toolbarTitle: t('Crop photo'),
            toolbarColor: const Color(0xFFB71C1C),
            toolbarWidgetColor: Colors.white,
            activeControlsWidgetColor: const Color(0xFFC9A227),
            backgroundColor: const Color(0xFF1F1B16),
            lockAspectRatio: false,
            hideBottomControls: false,
            initAspectRatio: _initial(kind),
            aspectRatioPresets: _presets,
          ),
          IOSUiSettings(
            title: t('Crop photo'),
            aspectRatioLockEnabled: false,
            resetAspectRatioEnabled: true,
            aspectRatioPickerButtonHidden: false,
            aspectRatioPresets: _presets,
          ),
        ],
      );
      if (cropped == null) return null;
      return XFile(
        cropped.path,
        name: _jpgName(file.name),
        mimeType: 'image/jpeg',
      );
    } catch (_) {
      return file;
    }
  }

  static CropAspectRatioPresetData _initial(ImageCropKind kind) {
    switch (kind) {
      case ImageCropKind.profile:
        return _portrait;
      case ImageCropKind.selfie:
      case ImageCropKind.document:
      case ImageCropKind.chat:
      case ImageCropKind.report:
        return CropAspectRatioPreset.original;
    }
  }

  static String _jpgName(String name) {
    final dot = name.lastIndexOf('.');
    final base = dot > 0 ? name.substring(0, dot) : name;
    final clean = base.trim().isEmpty ? 'photo' : base.trim();
    return '$clean.jpg';
  }
}

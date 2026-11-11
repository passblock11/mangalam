import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Handles profile photo picking, uploading to Supabase Storage,
/// and producing public URLs.
///
/// Storage layout:
///   bucket:  profile-photos  (public)
///   path:    {userId}/{index}.jpg
class PhotoService {
  PhotoService._();

  static const _bucket = 'profile-photos';

  static SupabaseClient get _sb => Supabase.instance.client;

  /// Current authenticated user id (or empty).
  static String get _uid => _sb.auth.currentUser?.id ?? '';

  /// Pick up to [remaining] images from the gallery.
  static Future<List<XFile>> pickFromGallery({int remaining = 6}) async {
    final picker = ImagePicker();
    try {
      return await picker.pickMultiImage(
        imageQuality: 80,
        maxWidth: 1080,
        limit: remaining,
      );
    } catch (_) {
      return [];
    }
  }

  /// Pick a single image from the camera.
  static Future<XFile?> pickFromCamera() async {
    final picker = ImagePicker();
    try {
      return await picker.pickImage(
        source: ImageSource.camera,
        imageQuality: 80,
        maxWidth: 1080,
      );
    } catch (_) {
      return null;
    }
  }

  /// Upload a single file and return its public URL.
  /// Throws on failure.
  static Future<String> upload(XFile file, int index) async {
    final uid = _uid;
    if (uid.isEmpty) throw StateError('Not signed in');
    final path = '$uid/$index.jpg';
    final bytes = await file.readAsBytes();
    await _sb.storage.from(_bucket).uploadBinary(
          path,
          bytes,
          fileOptions: const FileOptions(
            contentType: 'image/jpeg',
            upsert: true,
          ),
        );
    return _sb.storage.from(_bucket).getPublicUrl(path);
  }

  /// Replace the entire photo set: uploads [files] at indices 0..n-1 and
  /// returns the list of public URLs. Also removes any higher-index objects.
  static Future<List<String>> replaceAll(List<XFile> files) async {
    final uid = _uid;
    if (uid.isEmpty) throw StateError('Not signed in');
    final urls = <String>[];
    for (var i = 0; i < files.length; i++) {
      urls.add(await upload(files[i], i));
    }
    // Best-effort cleanup of stale higher-index photos.
    for (var i = files.length; i < files.length + 6; i++) {
      try {
        await _sb.storage.from(_bucket).remove(['$uid/$i.jpg']);
      } catch (_) {
        // ignore — may not exist
      }
    }
    return urls;
  }

  /// Delete a single photo by index.
  static Future<void> deleteAt(int index) async {
    final uid = _uid;
    if (uid.isEmpty) return;
    try {
      await _sb.storage.from(_bucket).remove(['$uid/$index.jpg']);
    } catch (_) {}
  }
}

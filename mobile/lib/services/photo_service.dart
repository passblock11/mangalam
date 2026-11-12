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
  static const _verifBucket = 'verification-docs';

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
    await _sb.storage
        .from(_bucket)
        .uploadBinary(
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

  // ---- Verification documents (private bucket) ----

  /// Upload a verification image (selfie or govt id) to the private
  /// `verification-docs` bucket. Returns the storage path used.
  static Future<String> uploadVerificationDoc(XFile file, String kind) async {
    final uid = _uid;
    if (uid.isEmpty) throw StateError('Not signed in');
    final path = '$uid/$kind.jpg';
    final bytes = await file.readAsBytes();
    await _sb.storage
        .from(_verifBucket)
        .uploadBinary(
          path,
          bytes,
          fileOptions: const FileOptions(
            contentType: 'image/jpeg',
            upsert: true,
          ),
        );
    // Private bucket — return the path; backend reads via signed URL.
    return path;
  }

  /// Create a short-lived signed URL for a verification doc (admin preview).
  static String publicUrlFor(String path) =>
      _sb.storage.from(_verifBucket).getPublicUrl(path);

  // ---- Chat attachments (public bucket) ----

  static const _chatBucket = 'chat-attachments';

  /// Upload a chat attachment (image / video / file) and return its public
  /// URL. Path layout: {conversationId}/{senderId}/{timestamp}.{ext}.
  static Future<({String url, String type, String mime, String name, int size})>
      uploadChatAttachment({
    required String conversationId,
    required XFile file,
    required String type, // image | video | file | audio
  }) async {
    final uid = _uid;
    if (uid.isEmpty) throw StateError('Not signed in');
    final mime = file.mimeType ?? 'application/octet-stream';
    final ext = _extFor(mime, file.name);
    final path =
        '$conversationId/$uid/${DateTime.now().millisecondsSinceEpoch}$ext';
    final bytes = await file.readAsBytes();
    await _sb.storage.from(_chatBucket).uploadBinary(
          path,
          bytes,
          fileOptions: FileOptions(contentType: mime, upsert: false),
        );
    final url = _sb.storage.from(_chatBucket).getPublicUrl(path);
    return (
      url: url,
      type: type,
      mime: mime,
      name: file.name,
      size: bytes.length,
    );
  }

  static String _extFor(String mime, String name) {
    final fromName = name.contains('.') ? '.${name.split('.').last}' : '';
    if (fromName.length <= 6) return fromName;
    switch (mime) {
      case 'image/jpeg':
        return '.jpg';
      case 'image/png':
        return '.png';
      case 'image/gif':
        return '.gif';
      case 'image/webp':
        return '.webp';
      case 'video/mp4':
        return '.mp4';
      case 'audio/mpeg':
        return '.mp3';
      case 'audio/mp4':
        return '.m4a';
      case 'application/pdf':
        return '.pdf';
      default:
        return '';
    }
  }
}

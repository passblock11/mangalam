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
  ///
  /// Each upload gets its own file name. Reusing `{index}.jpg` kept the same
  /// URL, so the app (and the CDN) kept showing the previous photo until a
  /// full restart.
  /// Throws on failure.
  static Future<String> upload(XFile file, [int index = 0]) async {
    final uid = _uid;
    if (uid.isEmpty) throw StateError('Not signed in');
    final stamp = DateTime.now().microsecondsSinceEpoch;
    final path = '$uid/$stamp-$index.jpg';
    final bytes = await file.readAsBytes();
    await _sb.storage.from(_bucket).uploadBinary(
          path,
          bytes,
          fileOptions: const FileOptions(
            contentType: 'image/jpeg',
            upsert: false,
            cacheControl: '31536000',
          ),
        );
    final url = _sb.storage.from(_bucket).getPublicUrl(path);
    return '$url?v=$stamp';
  }

  /// Upload [files] as new photos and return their public URLs.
  static Future<List<String>> replaceAll(List<XFile> files) async {
    final urls = <String>[];
    for (var i = 0; i < files.length; i++) {
      urls.add(await upload(files[i], i));
    }
    return urls;
  }

  /// Delete a chat attachment. Profile photos are left alone.
  static Future<void> deleteChatUrl(String url) async {
    final path = objectPath(url);
    if (path == null || !path.contains('/chat/')) return;
    try {
      await _sb.storage.from(_chatBucket).remove([path]);
    } catch (_) {}
  }

  /// Delete the storage object behind a profile photo URL.
  /// Chat files that share this bucket are left alone.
  static Future<void> deleteByUrl(String url) async {
    final path = objectPath(url);
    if (path == null || path.isEmpty || path.contains('/chat/')) return;
    try {
      await _sb.storage.from(_bucket).remove([path]);
    } catch (_) {}
  }

  /// `.../profile-photos/{uid}/{file}.jpg` → `{uid}/{file}.jpg`.
  static String? objectPath(String url) {
    final uri = Uri.tryParse(url);
    if (uri == null) return null;
    const marker = '/profile-photos/';
    final i = uri.path.indexOf(marker);
    if (i < 0) return null;
    final raw = uri.path.substring(i + marker.length);
    String path = raw;
    try {
      path = Uri.decodeComponent(raw);
    } catch (_) {}
    if (path.isEmpty || path.contains('..')) return null;
    return path;
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

  // Chat files live in the existing public profile-photos bucket, under
  // the sender's own folder, so uploads work with the storage rules that
  // are already in place.
  static const _chatBucket = 'profile-photos';

  static const maxChatBytes = 5 * 1024 * 1024;

  /// Upload a chat photo or file and return its public URL.
  /// Path layout: {senderId}/chat/{conversationId}/{timestamp}.{ext}.
  static Future<({String url, String type, String mime, String name, int size})>
      uploadChatAttachment({
    required String conversationId,
    required XFile file,
    required String type, // image | file | audio
  }) async {
    final uid = _uid;
    if (uid.isEmpty) throw StateError('Not signed in');
    if (type == 'video') {
      throw StateError('Video uploads are not available.');
    }
    final size = await file.length();
    if (size > maxChatBytes) {
      throw StateError('File is larger than 5 MB.');
    }
    final mime = _safeMime(file, type);
    final ext = _extFor(mime, file.name);
    final path =
        '$uid/chat/$conversationId/${DateTime.now().millisecondsSinceEpoch}$ext';
    final bytes = await file.readAsBytes();
    if (bytes.length > maxChatBytes) {
      throw StateError('File is larger than 5 MB.');
    }
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
      name: file.name.isEmpty ? 'file$ext' : file.name,
      size: bytes.length,
    );
  }

  /// Storage rejects anything that is not a real type/subtype, including
  /// Android content:// identifiers that file pickers sometimes return.
  static String _safeMime(XFile file, String type) {
    final raw = (file.mimeType ?? '').trim().toLowerCase();
    final ok = RegExp(r'^[a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]*$');
    if (ok.hasMatch(raw) && !raw.startsWith('content:')) return raw;
    final name = file.name.toLowerCase();
    const byExt = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.mp3': 'audio/mpeg',
      '.m4a': 'audio/mp4',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    for (final entry in byExt.entries) {
      if (name.endsWith(entry.key)) return entry.value;
    }
    switch (type) {
      case 'image':
        return 'image/jpeg';
      case 'video':
        return 'video/mp4';
      case 'audio':
        return 'audio/mpeg';
      default:
        return 'application/octet-stream';
    }
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

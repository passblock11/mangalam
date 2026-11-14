import 'package:flutter/material.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';
import 'package:image_picker/image_picker.dart';

import '../../services/api_client.dart';
import '../../services/face_photo.dart';
import '../../services/image_crop.dart';
import '../../services/photo_service.dart';
import 'mangalam_theme.dart';
import 'photo_gallery.dart';
import '../../l10n/app_locale.dart';

/// A reusable photo grid for onboarding & edit-profile.
/// Shows existing [photoUrls] + "add" tiles, supports picking from gallery
/// or camera, and calls [onChanged] with the new full URL list after upload.
class PhotoPickerSection extends StatefulWidget {
  const PhotoPickerSection({
    super.key,
    required this.photoUrls,
    required this.onChanged,
    this.maxPhotos = 6,
    this.compact = false,
  });

  final List<String> photoUrls;
  final ValueChanged<List<String>> onChanged;
  final int maxPhotos;
  final bool compact;

  @override
  State<PhotoPickerSection> createState() => _PhotoPickerSectionState();
}

class _PhotoPickerSectionState extends State<PhotoPickerSection> {
  bool _uploading = false;
  String? _cleanupKey;

  /// Same file must not be shown twice. Older uploads reused one address, so
  /// the saved list can contain that address more than once.
  List<String> _unique(List<String> urls) {
    final seen = <String>{};
    final out = <String>[];
    for (final url in urls) {
      final bare = url.split('?').first;
      if (bare.isEmpty || !seen.add(bare)) continue;
      out.add(url);
    }
    return out;
  }

  @override
  void initState() {
    super.initState();
    _scheduleCleanup(widget.photoUrls);
  }

  @override
  void didUpdateWidget(PhotoPickerSection oldWidget) {
    super.didUpdateWidget(oldWidget);
    _scheduleCleanup(widget.photoUrls);
  }

  void _scheduleCleanup(List<String> urls) {
    final clean = _unique(urls);
    if (clean.length == urls.length) return;
    final key = urls.join('\n');
    if (_cleanupKey == key) return;
    _cleanupKey = key;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final latest = _unique(widget.photoUrls);
      if (latest.length == widget.photoUrls.length) return;
      widget.onChanged(latest);
    });
  }

  Future<void> _addFromGallery() async {
    final remaining = widget.maxPhotos - _unique(widget.photoUrls).length;
    if (remaining <= 0) return;
    final picked = await PhotoService.pickFromGallery(remaining: remaining);
    if (picked.isEmpty) return;
    final files = await ImageCrop.many(picked, ImageCropKind.profile);
    if (files.isEmpty || !mounted) return;
    final accepted = await _withClearFaces(files);
    if (accepted.isEmpty) return;
    _upload(accepted);
  }

  Future<void> _addFromCamera() async {
    final file = await PhotoService.pickFromCamera();
    if (file == null) return;
    final cropped = await ImageCrop.one(file, ImageCropKind.profile);
    if (cropped == null || !mounted) return;
    final accepted = await _withClearFaces([cropped]);
    if (accepted.isEmpty) return;
    _upload(accepted);
  }

  Future<List<XFile>> _withClearFaces(List<XFile> files) async {
    setState(() => _uploading = true);
    final accepted = <XFile>[];
    var rejected = false;
    try {
      for (final file in files) {
        final problem = await rejectUnclearFacePhoto(file);
        if (problem == null) {
          accepted.add(file);
        } else {
          rejected = true;
        }
      }
    } finally {
      if (mounted && accepted.isEmpty) setState(() => _uploading = false);
    }
    if (rejected && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(t(facePhotoError))),
      );
    }
    return accepted;
  }

  Future<void> _upload(List<dynamic> files) async {
    if (!mounted) return;
    setState(() => _uploading = true);
    try {
      // Build the new set: existing urls + newly uploaded at next indices.
      final newUrls = _unique(widget.photoUrls);
      for (final f in files) {
        final index = newUrls.length;
        final url = await PhotoService.upload(f as dynamic, index);
        newUrls.add(url);
        if (newUrls.length >= widget.maxPhotos) break;
      }
      widget.onChanged(newUrls);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(tf('Upload failed: {error}', {'error': tError(e)}))));
      }
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _removeAt(int i) async {
    final urls = _unique(widget.photoUrls);
    if (i < 0 || i >= urls.length) return;
    final url = urls[i];
    await PhotoService.deleteByUrl(url);
    await NetworkImage(url).evict();
    final bare = url.split('?').first;
    if (bare != url) await NetworkImage(bare).evict();
    urls.removeAt(i);
    widget.onChanged(urls);
  }

  @override
  Widget build(BuildContext context) {
    final urls = _unique(widget.photoUrls);
    final count = urls.length;
    final remaining = widget.maxPhotos - count;
    final tileSize = widget.compact ? 96.0 : 140.0;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: [
            for (var i = 0; i < count; i++)
              _PhotoTile(
                key: ValueKey('photo-$i-${urls[i]}'),
                url: urls[i],
                size: tileSize,
                onRemove: () => _removeAt(i),
                onOpen: () => openPhotoViewer(
                  context,
                  urls: urls,
                  initial: i,
                ),
              ),
            if (remaining > 0)
              _AddTile(
                size: tileSize,
                uploading: _uploading,
                onGallery: _addFromGallery,
                onCamera: _addFromCamera,
              ),
          ],
        ),
        const SizedBox(height: 10),
        Text(
          '$count / ${widget.maxPhotos} photos',
          style: const TextStyle(fontSize: 12, color: MangalamTheme.muted),
        ),
      ],
    );
  }
}

class _PhotoTile extends StatelessWidget {
  const _PhotoTile({
    super.key,
    required this.url,
    required this.size,
    required this.onRemove,
    required this.onOpen,
  });

  final String url;
  final double size;
  final VoidCallback onRemove;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(14),
        child: Stack(
          fit: StackFit.expand,
          children: [
            GestureDetector(
              onTap: onOpen,
              child: Image.network(
                url,
                fit: BoxFit.cover,
                gaplessPlayback: false,
              ),
            ),
            Positioned(
              top: 4,
              right: 4,
              child: GestureDetector(
                onTap: onRemove,
                child: Container(
                  padding: const EdgeInsets.all(4),
                  decoration: const BoxDecoration(
                    color: Colors.black54,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Iconsax.close_circle,
                    color: Colors.white,
                    size: 16,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AddTile extends StatelessWidget {
  const _AddTile({
    required this.size,
    required this.uploading,
    required this.onGallery,
    required this.onCamera,
  });

  final double size;
  final bool uploading;
  final VoidCallback onGallery;
  final VoidCallback onCamera;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: Material(
        color: MangalamTheme.cream,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: BorderSide(
            color: MangalamTheme.maroon.withValues(alpha: 0.3),
            width: 1.2,
          ),
        ),
        child: uploading
            ? const Center(
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: MangalamTheme.maroon,
                ),
              )
            : PopupMenuButton<String>(
                icon: const Icon(
                  Iconsax.add_circle,
                  color: MangalamTheme.maroon,
                  size: 30,
                ),
                padding: EdgeInsets.zero,
                onSelected: (v) {
                  if (v == 'gallery') onGallery();
                  if (v == 'camera') onCamera();
                },
                itemBuilder: (_) => [
                  PopupMenuItem(
                    value: 'gallery',
                    child: Row(
                      children: [
                        Icon(Iconsax.gallery_export, size: 18),
                        SizedBox(width: 8),
                        Text(t('From gallery')),
                      ],
                    ),
                  ),
                  PopupMenuItem(
                    value: 'camera',
                    child: Row(
                      children: [
                        Icon(Iconsax.camera, size: 18),
                        SizedBox(width: 8),
                        Text(t('Take photo')),
                      ],
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

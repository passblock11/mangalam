import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';

import '../../l10n/app_locale.dart';
import 'mangalam_theme.dart';

/// A horizontally swipeable photo gallery with page indicators and a
/// tap-to-open full-screen zoomable viewer. Falls back to a gradient +
/// initial avatar when there are no photos.
///
/// Used on profile detail / preview screens so all of a member's photos
/// are viewable (scrollable + enlargeable), not just the first one.
class PhotoGallery extends StatefulWidget {
  const PhotoGallery({
    super.key,
    required this.name,
    this.photoUrls = const [],
    this.aspectRatio = 0.95,
    this.showCountBadge = true,
    /// Extra top inset for the count badge (e.g. under a transparent AppBar).
    this.badgeTopInset = 0,
    this.locked = false,
  });

  final String name;
  final List<String> photoUrls;
  final double aspectRatio;
  final bool showCountBadge;
  final double badgeTopInset;
  final bool locked;

  @override
  State<PhotoGallery> createState() => _PhotoGalleryState();
}

class _PhotoGalleryState extends State<PhotoGallery> {
  int _page = 0;
  final _pageController = PageController();

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _openViewer(int index) {
    Navigator.of(context).push(
      PageRouteBuilder<void>(
        opaque: false,
        barrierColor: Colors.black,
        pageBuilder: (_, _, _) => _FullScreenViewer(
          urls: widget.photoUrls,
          initial: index,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final urls = widget.photoUrls;
    final locked = widget.locked && urls.isNotEmpty;

    if (urls.isEmpty) {
      return AspectRatio(
        aspectRatio: widget.aspectRatio,
        child: widget.locked
            ? const _PrivatePhotos()
            : _InitialAvatar(name: widget.name),
      );
    }

    return AspectRatio(
      aspectRatio: widget.aspectRatio,
      child: Stack(
        fit: StackFit.expand,
        children: [
          PageView.builder(
            controller: _pageController,
            itemCount: urls.length,
            onPageChanged: (i) => setState(() => _page = i),
            itemBuilder: (context, i) {
              final image = _NetworkImage(url: urls[i], blurred: locked);
              if (locked) return image;
              return GestureDetector(
                onTap: () => _openViewer(i),
                child: image,
              );
            },
          ),
          if (locked)
            const Positioned(
              left: 20,
              right: 20,
              bottom: 28,
              child: _PrivateCaption(),
            ),
          // Page indicators
          if (urls.length > 1)
            Positioned(
              bottom: locked ? 108 : 10,
              left: 0,
              right: 0,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(urls.length, (i) {
                  final active = i == _page;
                  return AnimatedContainer(
                    duration: const Duration(milliseconds: 180),
                    margin: const EdgeInsets.symmetric(horizontal: 3),
                    width: active ? 7 : 6,
                    height: active ? 7 : 6,
                    decoration: BoxDecoration(
                      color: active
                          ? Colors.white
                          : Colors.white.withValues(alpha: 0.5),
                      shape: BoxShape.circle,
                    ),
                  );
                }),
              ),
            ),
          // Photo count badge
          if (widget.showCountBadge && urls.length > 1)
            Positioned(
              top: 10 + widget.badgeTopInset,
              right: 12,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.45),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Iconsax.gallery, color: Colors.white, size: 13),
                    const SizedBox(width: 4),
                    Text(
                      '${_page + 1}/${urls.length}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _NetworkImage extends StatelessWidget {
  const _NetworkImage({required this.url, this.blurred = false});
  final String url;
  final bool blurred;

  @override
  Widget build(BuildContext context) {
    final image = Image.network(
      url,
      key: ValueKey('${blurred ? 'blur' : 'clear'}-$url'),
      fit: BoxFit.cover,
      gaplessPlayback: false,
      loadingBuilder: (context, child, progress) {
        if (progress == null) return child;
        return Container(
          color: const Color(0xFFF3E9DF),
          alignment: Alignment.center,
          child: const CircularProgressIndicator(
            strokeWidth: 2,
            color: MangalamTheme.maroon,
          ),
        );
      },
      errorBuilder: (_, _, _) => Container(
        color: const Color(0xFFF3E9DF),
        alignment: Alignment.center,
        child: const Icon(Iconsax.gallery,
            color: MangalamTheme.muted, size: 32),
      ),
    );
    if (!blurred) return image;
    return ClipRect(
      child: ImageFiltered(
        imageFilter: ImageFilter.blur(sigmaX: 28, sigmaY: 28),
        child: Transform.scale(scale: 1.25, child: image),
      ),
    );
  }
}

class _PrivateCaption extends StatelessWidget {
  const _PrivateCaption();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.45),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Iconsax.lock, color: Colors.white, size: 18),
          const SizedBox(height: 4),
          Text(
            t('Photos are private'),
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w800,
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            t('Ask this member for photos in chat.'),
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.9),
              fontSize: 12,
              height: 1.3,
            ),
          ),
        ],
      ),
    );
  }
}

class _InitialAvatar extends StatelessWidget {
  const _InitialAvatar({required this.name});
  final String name;

  @override
  Widget build(BuildContext context) {
    final initial =
        name.trim().isEmpty ? '?' : name.trim()[0].toUpperCase();
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: MangalamTheme.gradientFor(name),
        ),
      ),
      alignment: Alignment.center,
      child: Text(initial,
          style: const TextStyle(
              color: Colors.white, fontSize: 64, fontWeight: FontWeight.w800)),
    );
  }
}

class _PrivatePhotos extends StatelessWidget {
  const _PrivatePhotos();

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFFF3E9DF),
      alignment: Alignment.center,
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Iconsax.lock, color: MangalamTheme.maroon, size: 36),
          const SizedBox(height: 10),
          Text(
            t('Photos are private'),
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: MangalamTheme.ink,
              fontWeight: FontWeight.w800,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            t('Ask this member for photos in chat.'),
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: MangalamTheme.muted,
              fontSize: 13,
              height: 1.35,
            ),
          ),
        ],
      ),
    );
  }
}

/// Opens every photo full-screen, starting at [initial]. Swipe and the
/// arrow buttons move between photos. Used by profile galleries and the
/// photo grids on Profile and Edit profile.
void openPhotoViewer(
  BuildContext context, {
  required List<String> urls,
  int initial = 0,
}) {
  if (urls.isEmpty) return;
  final start = initial.clamp(0, urls.length - 1);
  Navigator.of(context).push(
    PageRouteBuilder<void>(
      opaque: false,
      barrierColor: Colors.black,
      pageBuilder: (_, _, _) => _FullScreenViewer(urls: urls, initial: start),
    ),
  );
}

/// Full-screen, swipeable, pinch-to-zoom photo viewer.
class _FullScreenViewer extends StatefulWidget {
  const _FullScreenViewer({required this.urls, required this.initial});

  final List<String> urls;
  final int initial;

  @override
  State<_FullScreenViewer> createState() => _FullScreenViewerState();
}

class _FullScreenViewerState extends State<_FullScreenViewer> {
  late final PageController _controller;
  late int _index;

  @override
  void initState() {
    super.initState();
    _index = widget.initial;
    _controller = PageController(initialPage: widget.initial);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _go(int delta) {
    final next = _index + delta;
    if (next < 0 || next >= widget.urls.length) return;
    _controller.animateToPage(
      next,
      duration: const Duration(milliseconds: 220),
      curve: Curves.easeOut,
    );
  }

  @override
  Widget build(BuildContext context) {
    final many = widget.urls.length > 1;
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          PageView.builder(
            controller: _controller,
            itemCount: widget.urls.length,
            onPageChanged: (i) => setState(() => _index = i),
            itemBuilder: (context, i) => InteractiveViewer(
              maxScale: 4,
              minScale: 1,
              child: Center(
                child: Image.network(
                  widget.urls[i],
                  fit: BoxFit.contain,
                  loadingBuilder: (context, child, progress) {
                    if (progress == null) return child;
                    return const Center(
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    );
                  },
                  errorBuilder: (_, __, ___) => const Center(
                    child: Icon(Iconsax.gallery, color: Colors.white, size: 40),
                  ),
                ),
              ),
            ),
          ),
          Positioned(
            top: MediaQuery.paddingOf(context).top + 8,
            left: 8,
            child: _roundBtn(
              Iconsax.arrow_left,
              () => Navigator.of(context).pop(),
            ),
          ),
          Positioned(
            top: MediaQuery.paddingOf(context).top + 12,
            left: 0,
            right: 0,
            child: Center(
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  '${_index + 1} / ${widget.urls.length}',
                  style: const TextStyle(
                    color: Colors.black,
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.4,
                  ),
                ),
              ),
            ),
          ),
          if (many && _index > 0)
            Positioned(
              left: 10,
              top: 0,
              bottom: 0,
              child: Center(
                child: _roundBtn(Icons.chevron_left, () => _go(-1)),
              ),
            ),
          if (many && _index < widget.urls.length - 1)
            Positioned(
              right: 10,
              top: 0,
              bottom: 0,
              child: Center(
                child: _roundBtn(Icons.chevron_right, () => _go(1)),
              ),
            ),
        ],
      ),
    );
  }

  Widget _roundBtn(IconData icon, VoidCallback onTap) {
    return Material(
      color: Colors.white,
      shape: const CircleBorder(),
      elevation: 2,
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: SizedBox(
          width: 44,
          height: 44,
          child: Icon(icon, color: Colors.black, size: 22),
        ),
      ),
    );
  }
}

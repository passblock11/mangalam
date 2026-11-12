import 'package:flutter/material.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';

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
  });

  final String name;
  final List<String> photoUrls;
  final double aspectRatio;
  final bool showCountBadge;

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
        pageBuilder: (_, __, ___) => _FullScreenViewer(
          urls: widget.photoUrls,
          initial: index,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final urls = widget.photoUrls;

    if (urls.isEmpty) {
      return AspectRatio(
        aspectRatio: widget.aspectRatio,
        child: _InitialAvatar(name: widget.name),
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
            itemBuilder: (context, i) => GestureDetector(
              onTap: () => _openViewer(i),
              child: _NetworkImage(url: urls[i]),
            ),
          ),
          // Page indicators
          if (urls.length > 1)
            Positioned(
              bottom: 10,
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
              top: MediaQuery.paddingOf(context).top + 56,
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
  const _NetworkImage({required this.url});
  final String url;

  @override
  Widget build(BuildContext context) {
    return Image.network(
      url,
      fit: BoxFit.cover,
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
      errorBuilder: (_, __, ___) => Container(
        color: const Color(0xFFF3E9DF),
        alignment: Alignment.center,
        child: const Icon(Iconsax.gallery,
            color: MangalamTheme.muted, size: 32),
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: Text(
          '${_index + 1} / ${widget.urls.length}',
          style: const TextStyle(fontSize: 14),
        ),
        leading: IconButton(
          icon: const Icon(Iconsax.arrow_left),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: PageView.builder(
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
                    color: MangalamTheme.maroon,
                  ),
                );
              },
              errorBuilder: (_, __, ___) => const Center(
                child: Icon(Iconsax.gallery, color: Colors.white54, size: 40),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

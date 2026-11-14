import 'dart:async';

import 'package:flutter/material.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';

import '../../services/app_branding.dart';

/// Heart mark, or the admin logo. A failed image falls back to the heart.
class BrandMark extends StatelessWidget {
  const BrandMark({
    super.key,
    required this.size,
    required this.iconSize,
    required this.ring,
    this.padding = 0,
  });

  final double size;
  final double iconSize;
  final Color ring;
  final double padding;

  @override
  Widget build(BuildContext context) {
    final url = AppBranding.instance.look.logoUrl;
    return Container(
      width: size,
      height: size,
      padding: EdgeInsets.all(padding),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.08),
        shape: BoxShape.circle,
        border: Border.all(color: ring, width: 2.5),
      ),
      clipBehavior: Clip.antiAlias,
      child: url.isEmpty
          ? Icon(Iconsax.heart, color: ring, size: iconSize)
          : Image.network(
              url,
              fit: BoxFit.cover,
              errorBuilder: (_, _, _) =>
                  Icon(Iconsax.heart, color: ring, size: iconSize),
              loadingBuilder: (context, child, progress) {
                if (progress == null) return child;
                return Icon(Iconsax.heart, color: ring, size: iconSize);
              },
            ),
    );
  }
}

/// Login photos. Paints nothing when every image fails, so the gradient shows.
class LoginPhotoBackdrop extends StatefulWidget {
  const LoginPhotoBackdrop({super.key, required this.urls, required this.onVisible});

  final List<String> urls;
  final ValueChanged<bool> onVisible;

  @override
  State<LoginPhotoBackdrop> createState() => _LoginPhotoBackdropState();
}

class _LoginPhotoBackdropState extends State<LoginPhotoBackdrop> {
  final _failed = <String>{};
  int _index = 0;
  Timer? _timer;
  bool _reported = false;

  List<String> get _ok =>
      widget.urls.where((url) => !_failed.contains(url)).toList(growable: false);

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 5), (_) {
      final urls = _ok;
      if (!mounted || urls.length < 2) return;
      setState(() => _index = (_index + 1) % urls.length);
    });
  }

  @override
  void didUpdateWidget(covariant LoginPhotoBackdrop oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.urls.join() != widget.urls.join()) {
      _failed.clear();
      _index = 0;
      _reported = false;
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _report(bool visible) {
    if (_reported == visible) return;
    _reported = visible;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) widget.onVisible(visible);
    });
  }

  @override
  Widget build(BuildContext context) {
    final urls = _ok;
    if (urls.isEmpty) {
      _report(false);
      return const SizedBox.expand();
    }
    _report(true);
    final url = urls[_index % urls.length];
    return Stack(
      fit: StackFit.expand,
      children: [
        Positioned.fill(
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 700),
            child: Image.network(
              url,
              key: ValueKey(url),
              fit: BoxFit.cover,
              width: double.infinity,
              height: double.infinity,
              errorBuilder: (_, _, _) {
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  if (!mounted || _failed.contains(url)) return;
                  setState(() => _failed.add(url));
                });
                return const SizedBox.expand();
              },
            ),
          ),
        ),
        const Positioned.fill(child: ColoredBox(color: Color(0x47000000))),
      ],
    );
  }
}

import 'dart:async';

import 'package:flutter/material.dart';

import '../../l10n/app_locale.dart';
import '../../services/app_branding.dart';
import 'brand_widgets.dart';
import 'mangalam_theme.dart';

/// Animated splash. Startup work runs while this is on screen, and the next
/// screen waits until both the animation and that work have finished.
/// With no custom design saved, this is the original Mangalam splash.
class BrandedSplash extends StatefulWidget {
  const BrandedSplash({super.key, required this.next, required this.ready});

  final WidgetBuilder next;
  final Future<void> ready;

  @override
  State<BrandedSplash> createState() => _BrandedSplashState();
}

class _BrandedSplashState extends State<BrandedSplash>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _fade;
  late final Animation<double> _scale;
  bool _imageFailed = false;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
    _fade = CurvedAnimation(parent: _ctrl, curve: Curves.easeOut);
    _scale = CurvedAnimation(parent: _ctrl, curve: Curves.easeOutBack);
    _ctrl.forward();
    AppBranding.instance.addListener(_onBrand);
    final hold = AppBranding.instance.look.hold;
    unawaited(Future<void>(() async {
      try {
        await Future.wait<void>([
          Future<void>.delayed(hold),
          widget.ready,
        ]);
      } catch (e, st) {
        debugPrint('[BrandedSplash] startup failed: $e\n$st');
      }
      if (!mounted) return;
      // Capture the next screen now. The route rebuilds when the language
      // changes, and the splash context is gone by then.
      final next = widget.next(context);
      Navigator.of(context).pushReplacement<void, void>(
        PageRouteBuilder(
          pageBuilder: (_, _, _) => next,
          transitionsBuilder: (_, anim, _, child) =>
              FadeTransition(opacity: anim, child: child),
          transitionDuration: const Duration(milliseconds: 500),
        ),
      );
    }));
  }

  void _onBrand() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    AppBranding.instance.removeListener(_onBrand);
    _ctrl.dispose();
    super.dispose();
  }

  Widget _reveal(Widget child, String animation, {required bool scale}) {
    if (!scale || animation == 'fade') {
      return FadeTransition(opacity: _fade, child: child);
    }
    if (animation == 'rise') {
      return FadeTransition(
        opacity: _fade,
        child: SlideTransition(
          position: Tween<Offset>(
            begin: const Offset(0, 0.18),
            end: Offset.zero,
          ).animate(_fade),
          child: child,
        ),
      );
    }
    return ScaleTransition(
      scale: _scale,
      child: FadeTransition(opacity: _fade, child: child),
    );
  }

  @override
  Widget build(BuildContext context) {
    final look = AppBranding.instance.look;
    final animation = look.custom ? look.animation : 'scale_fade';
    final start = look.custom ? look.splashStart : const Color(0xFFB71C1C);
    final end = look.custom ? look.splashEnd : const Color(0xFF7E0F0F);
    final accent = look.custom ? look.accent : MangalamTheme.gold;
    final titleColor = look.custom ? look.titleColor : Colors.white;
    final photo = look.custom && !_imageFailed ? look.splashImageUrl : '';
    final name = look.appName.isNotEmpty ? look.appName : t('Mangalam');
    final line = look.custom && look.tagline.isNotEmpty
        ? look.tagline
        : t('Find your perfect match');

    return Scaffold(
      backgroundColor: start,
      body: Stack(
        fit: StackFit.expand,
        children: [
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [start, end],
              ),
            ),
          ),
          if (photo.isNotEmpty)
            Positioned.fill(
              child: Image.network(
                photo,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) {
                  WidgetsBinding.instance.addPostFrameCallback((_) {
                    if (mounted && !_imageFailed) setState(() => _imageFailed = true);
                  });
                  return const SizedBox.expand();
                },
              ),
            ),
          if (photo.isNotEmpty)
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      start.withValues(alpha: 0.72),
                      end.withValues(alpha: 0.82),
                    ],
                  ),
                ),
              ),
            ),
          SafeArea(
            child: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _reveal(
                    BrandMark(size: 132, iconSize: 64, ring: accent),
                    animation,
                    scale: true,
                  ),
                  const SizedBox(height: 28),
                  _reveal(
                    Text(
                      name,
                      style: TextStyle(
                        color: titleColor,
                        fontSize: 34,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.2,
                      ),
                    ),
                    animation,
                    scale: false,
                  ),
                  const SizedBox(height: 8),
                  FadeTransition(
                    opacity: _fade,
                    child: Text(
                      line,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: accent,
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                        letterSpacing: 0.4,
                      ),
                    ),
                  ),
                  const SizedBox(height: 40),
                  if (!look.custom || look.showLoader)
                    SizedBox(
                      width: 28,
                      height: 28,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.5,
                        color: accent.withValues(alpha: 0.8),
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

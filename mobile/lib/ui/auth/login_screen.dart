import 'dart:async';
import 'package:iconsax_flutter/iconsax_flutter.dart';

import 'package:flutter/material.dart';

import '../../core/config.dart';
import '../../core/google_auth_config.dart';
import '../../services/oauth_sign_in.dart';
import '../core/mangalam_theme.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  bool _busy = false;
  String? _error;
  bool _googleReady = GoogleAuthConfig.isReadyForNative;

  @override
  void initState() {
    super.initState();
    unawaited(_primeGoogle());
  }

  Future<void> _primeGoogle() async {
    await GoogleAuthConfig.hydrate();
    if (mounted && GoogleAuthConfig.hasWebClient) {
      await OAuthSignIn.ensureGoogleInitialized();
    }
    if (mounted) {
      setState(() => _googleReady = GoogleAuthConfig.isReadyForNative);
    }
  }

  Future<void> _run(Future<void> Function() action) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await action();
    } on OAuthConfigException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = _friendlyError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String _friendlyError(Object e) {
    final raw = e.toString();
    if (raw.contains('canceled') || raw.contains('Cancelled')) {
      return 'Sign-in was cancelled.';
    }
    return raw.replaceFirst('ApiException(', '').replaceAll('): ', ': ');
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final googleReady = _googleReady;
    final canSignIn = !_busy && AppConfig.hasSupabase && googleReady;

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            // ── Hero ──────────────────────────────────────────────
            Expanded(
              flex: 5,
              child: Stack(
                children: [
                  Container(
                    decoration: const BoxDecoration(
                      gradient: MangalamTheme.heroGradient,
                    ),
                  ),
                  SafeArea(
                    bottom: false,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 28,
                        vertical: 24,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(10),
                                decoration: BoxDecoration(
                                  color: Colors.white.withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(14),
                                  border: Border.all(
                                    color: Colors.white.withValues(alpha: 0.25),
                                  ),
                                ),
                                child: const Icon(
                                  Iconsax.heart,
                                  color: Colors.white,
                                  size: 22,
                                ),
                              ),
                              const SizedBox(width: 10),
                              Text(
                                'Mangalam',
                                style: theme.textTheme.titleLarge?.copyWith(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 0.5,
                                ),
                              ),
                            ],
                          ),
                          const Spacer(),
                          // Mandala-ish decorative ring
                          Align(
                            alignment: Alignment.centerLeft,
                            child: _Mandala(),
                          ),
                          const Spacer(),
                          Text(
                            'Find your\nperfect match.',
                            style: theme.textTheme.displaySmall?.copyWith(
                              color: Colors.white,
                              fontWeight: FontWeight.w800,
                              height: 1.05,
                              letterSpacing: -1,
                            ),
                          ),
                          const SizedBox(height: 14),
                          Text(
                            'Trusted by thousands of families to\nfind meaningful, verified alliances.',
                            style: theme.textTheme.bodyMedium?.copyWith(
                              color: Colors.white.withValues(alpha: 0.85),
                              height: 1.45,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            // ── Bottom action sheet ───────────────────────────────
            Expanded(
              flex: 4,
              child: Container(
                decoration: const BoxDecoration(
                  color: MangalamTheme.cream,
                  borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
                ),
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(24, 28, 24, 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        'Welcome',
                        style: theme.textTheme.headlineSmall?.copyWith(
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.4,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Sign in to continue your journey.',
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: MangalamTheme.muted,
                        ),
                      ),
                      const SizedBox(height: 28),
                      _GoogleButton(
                        busy: _busy,
                        enabled: canSignIn,
                        onTap: () => _run(OAuthSignIn.signInWithGoogle),
                      ),
                      if (!googleReady && _error == null) ...[
                        const SizedBox(height: 16),
                        Text(
                          GoogleAuthConfig.setupInstructions,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: MangalamTheme.muted,
                            height: 1.4,
                          ),
                        ),
                      ],
                      if (_error != null) ...[
                        const SizedBox(height: 18),
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: MangalamTheme.maroon.withValues(alpha: 0.08),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: MangalamTheme.maroon.withValues(
                                alpha: 0.25,
                              ),
                            ),
                          ),
                          child: Row(
                            children: [
                              Icon(
                                Iconsax.warning_2,
                                size: 20,
                                color: MangalamTheme.maroon,
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  _error!,
                                  style: TextStyle(
                                    color: MangalamTheme.maroon,
                                    height: 1.35,
                                    fontSize: 13,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                      const SizedBox(height: 24),
                      Center(
                        child: Text(
                          'By continuing you agree to our Terms\nand Privacy Policy.',
                          textAlign: TextAlign.center,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: MangalamTheme.muted,
                            height: 1.4,
                          ),
                        ),
                      ),
                    ],
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

class _GoogleButton extends StatelessWidget {
  const _GoogleButton({
    required this.busy,
    required this.enabled,
    required this.onTap,
  });

  final bool busy;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: enabled ? Colors.white : const Color(0xFFEFE6DC),
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: enabled ? onTap : null,
        child: Container(
          height: 54,
          padding: const EdgeInsets.symmetric(horizontal: 18),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: enabled
                  ? const Color(0xFFD7C8B8)
                  : const Color(0xFFCFC2B0),
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (busy)
                const SizedBox(
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.5,
                    color: MangalamTheme.maroon,
                  ),
                )
              else
                const SizedBox(width: 22, height: 22, child: GoogleGLogo()),
              const SizedBox(width: 12),
              Text(
                busy ? 'Please wait…' : 'Continue with Google',
                style: TextStyle(
                  fontSize: 15.5,
                  fontWeight: FontWeight.w700,
                  color: enabled ? MangalamTheme.ink : MangalamTheme.muted,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Decorative mandala-like ring in the hero.
class _Mandala extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 200,
      height: 200,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Container(
            width: 200,
            height: 200,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                color: Colors.white.withValues(alpha: 0.18),
                width: 1,
              ),
            ),
          ),
          Container(
            width: 150,
            height: 150,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                color: Colors.white.withValues(alpha: 0.22),
                width: 1,
              ),
            ),
          ),
          Container(
            width: 100,
            height: 100,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                color: MangalamTheme.goldLight.withValues(alpha: 0.5),
                width: 1.2,
              ),
            ),
          ),
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [MangalamTheme.goldLight, MangalamTheme.gold],
              ),
              boxShadow: [
                BoxShadow(
                  color: MangalamTheme.gold.withValues(alpha: 0.5),
                  blurRadius: 18,
                  spreadRadius: 1,
                ),
              ],
            ),
            child: const Icon(Iconsax.heart, color: Colors.white, size: 26),
          ),
        ],
      ),
    );
  }
}

/// Multi-color Google "G" logo painted via CustomPaint (no asset needed).
class GoogleGLogo extends StatelessWidget {
  const GoogleGLogo({super.key});

  @override
  Widget build(BuildContext context) {
    return CustomPaint(painter: _GoogleGPainter(), size: const Size(22, 22));
  }
}

class _GoogleGPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final stroke = size.width * 0.18;
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2 - stroke / 2;

    // Blue (top-right quadrant)
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      -0.55,
      1.7,
      false,
      Paint()
        ..color = const Color(0xFF4285F4)
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..strokeCap = StrokeCap.round,
    );
    // Red (bottom-right)
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      1.15,
      1.7,
      false,
      Paint()
        ..color = const Color(0xFFEA4335)
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..strokeCap = StrokeCap.round,
    );
    // Yellow (bottom-left)
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      2.85,
      1.7,
      false,
      Paint()
        ..color = const Color(0xFFFBBC05)
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..strokeCap = StrokeCap.round,
    );
    // Green (top-left)
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      4.55,
      1.7,
      false,
      Paint()
        ..color = const Color(0xFF34A853)
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..strokeCap = StrokeCap.round,
    );

    // Horizontal bar across the middle (the G's stem)
    canvas.drawLine(
      Offset(size.width / 2, size.height / 2),
      Offset(size.width, size.height / 2),
      Paint()
        ..color = const Color(0xFF4285F4)
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..strokeCap = StrokeCap.round,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

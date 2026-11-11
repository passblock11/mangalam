import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/config.dart';
import '../../core/google_auth_config.dart';
import '../../services/oauth_sign_in.dart';

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
    final cs = theme.colorScheme;
    final googleReady = _googleReady;

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 400),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SizedBox(height: 12),
                  Icon(Icons.favorite, size: 48, color: cs.primary),
                  const SizedBox(height: 20),
                  Text(
                    'Mangalam',
                    style: theme.textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                      letterSpacing: -0.6,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Sign in with Google.',
                    style: theme.textTheme.bodyLarge?.copyWith(
                      color: cs.onSurfaceVariant,
                      height: 1.35,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 40),
                  FilledButton.icon(
                    onPressed: (_busy || !AppConfig.hasSupabase || !googleReady)
                        ? null
                        : () => _run(OAuthSignIn.signInWithGoogle),
                    icon: const Icon(Icons.g_mobiledata_rounded, size: 28),
                    label: const Text(
                      'Continue with Google',
                      style: TextStyle(fontWeight: FontWeight.w600),
                    ),
                    style: FilledButton.styleFrom(
                      minimumSize: const Size.fromHeight(52),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                  if (!googleReady && _error == null) ...[
                    const SizedBox(height: 16),
                    Text(
                      GoogleAuthConfig.setupInstructions,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: cs.onSurfaceVariant,
                        height: 1.35,
                      ),
                    ),
                  ],
                  if (_error != null) ...[
                    const SizedBox(height: 20),
                    Material(
                      color: cs.errorContainer.withValues(alpha: 0.5),
                      borderRadius: BorderRadius.circular(12),
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Text(
                          _error!,
                          style: TextStyle(
                            color: cs.onErrorContainer,
                            height: 1.35,
                          ),
                        ),
                      ),
                    ),
                  ],
                  if (_busy) ...[
                    const SizedBox(height: 24),
                    const Center(
                      child: SizedBox(
                        width: 28,
                        height: 28,
                        child: CircularProgressIndicator(strokeWidth: 2.5),
                      ),
                    ),
                  ],
                  const SizedBox(height: 16),
                  Text(
                    'By continuing you agree to our Terms and Privacy Policy.',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: cs.outline,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

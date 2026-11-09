import 'package:flutter/material.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';

import '../../core/config.dart';
import '../../services/oauth_sign_in.dart';
import 'phone_otp_sheet.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  bool _busy = false;
  String? _error;
  bool _appleAvailable = false;

  @override
  void initState() {
    super.initState();
    _loadAppleAvailability();
    if (AppConfig.hasGoogleOAuth) {
      OAuthSignIn.ensureGoogleInitialized();
    }
  }

  Future<void> _loadAppleAvailability() async {
    final ok = await OAuthSignIn.isAppleSignInAvailable;
    if (mounted) setState(() => _appleAvailable = ok);
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

  void _openPhoneOtp() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      useSafeArea: true,
      builder: (context) => const PhoneOtpSheet(),
    );
  }

  String _friendlyError(Object e) {
    final raw = e.toString();
    if (raw.contains('canceled') || raw.contains('Cancelled')) {
      return 'Sign-in was cancelled.';
    }
    if (raw.contains('DLT') || raw.contains('MSG91')) {
      return 'Phone SMS needs DLT setup. Prefer Google or Apple above.';
    }
    return raw.replaceFirst('ApiException(', '').replaceAll('): ', ': ');
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;

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
                    'Find your match. Sign in in seconds.',
                    style: theme.textTheme.bodyLarge?.copyWith(
                      color: cs.onSurfaceVariant,
                      height: 1.35,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 40),
                  _SocialButton(
                    label: 'Continue with Google',
                    icon: Icons.g_mobiledata_rounded,
                    onPressed: _busy
                        ? null
                        : () => _run(OAuthSignIn.signInWithGoogle),
                    outlined: true,
                  ),
                  const SizedBox(height: 12),
                  if (_appleAvailable)
                    SignInWithAppleButton(
                      height: 52,
                      borderRadius: BorderRadius.circular(12),
                      onPressed: _busy
                          ? null
                          : () => _run(OAuthSignIn.signInWithApple),
                    )
                  else
                    _SocialButton(
                      label: 'Continue with Apple',
                      icon: Icons.apple,
                      onPressed: _busy
                          ? null
                          : () => _run(OAuthSignIn.signInWithApple),
                      outlined: true,
                    ),
                  const SizedBox(height: 28),
                  Row(
                    children: [
                      Expanded(child: Divider(color: cs.outlineVariant)),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        child: Text(
                          'or',
                          style: theme.textTheme.labelLarge?.copyWith(
                            color: cs.onSurfaceVariant,
                          ),
                        ),
                      ),
                      Expanded(child: Divider(color: cs.outlineVariant)),
                    ],
                  ),
                  const SizedBox(height: 20),
                  OutlinedButton.icon(
                    onPressed: _busy ? null : _openPhoneOtp,
                    icon: const Icon(Icons.sms_outlined, size: 20),
                    label: const Text('Continue with phone OTP'),
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size.fromHeight(52),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Phone OTP needs India DLT on MSG91. Google & Apple work without SMS.',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: cs.outline,
                      height: 1.3,
                    ),
                    textAlign: TextAlign.center,
                  ),
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

class _SocialButton extends StatelessWidget {
  const _SocialButton({
    required this.label,
    required this.icon,
    required this.onPressed,
    this.outlined = false,
  });

  final String label;
  final IconData icon;
  final VoidCallback? onPressed;
  final bool outlined;

  @override
  Widget build(BuildContext context) {
    final child = Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(icon, size: 26),
        const SizedBox(width: 10),
        Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
      ],
    );
    final shape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(12));
    if (outlined) {
      return OutlinedButton(
        onPressed: onPressed,
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(52),
          shape: shape,
        ),
        child: child,
      );
    }
    return FilledButton(
      onPressed: onPressed,
      style: FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(52),
        shape: shape,
      ),
      child: child,
    );
  }
}

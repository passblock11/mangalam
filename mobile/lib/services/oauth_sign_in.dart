import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/google_auth_config.dart';
import 'api_client.dart';

/// **Mobile-native** Google → Supabase (`google_sign_in` + `signInWithIdToken`).
///
/// Supabase Flutter **mobile** guide (not web OAuth):
/// https://supabase.com/docs/guides/auth/social-sign-in/auth-google?platform=flutter-mobile
class OAuthSignIn {
  static const _googleScopes = ['email', 'profile'];

  static bool _googleReady = false;

  /// Call once at startup (see `main.dart`).
  static Future<void> ensureGoogleInitialized() async {
    if (_googleReady || kIsWeb || !GoogleAuthConfig.isReadyForNative) return;

    final iosClient = defaultTargetPlatform == TargetPlatform.iOS
        ? GoogleAuthConfig.iosClientId
        : null;

    await GoogleSignIn.instance.initialize(
      serverClientId: GoogleAuthConfig.webClientId,
      clientId: iosClient,
    );
    _googleReady = true;
  }

  static Future<void> signInWithGoogle() async {
    if (kIsWeb) {
      throw const OAuthConfigException(
        'This build targets mobile. Use the iOS/Android app for Google sign-in.',
      );
    }

    await GoogleAuthConfig.hydrate();

    if (!GoogleAuthConfig.isReadyForNative) {
      throw OAuthConfigException(GoogleAuthConfig.setupInstructions);
    }

    await ensureGoogleInitialized();

    if (!GoogleSignIn.instance.supportsAuthenticate()) {
      throw const OAuthConfigException(
        'Google Sign-In is not supported on this platform.',
      );
    }

    try {
      await _nativeGoogleSignIn();
    } on GoogleSignInException catch (e) {
      if (e.code == GoogleSignInExceptionCode.canceled ||
          e.code == GoogleSignInExceptionCode.interrupted) {
        return;
      }
      throw OAuthConfigException(_googleSignInMessage(e));
    }
  }

  /// Sign out Supabase + Google so the next login can pick any account.
  static Future<void> signOutCompletely() async {
    await GoogleSignIn.instance.signOut();
    await Supabase.instance.client.auth.signOut();
  }

  /// Interactive sign-in only (no silent reuse of the device default account).
  static Future<void> _nativeGoogleSignIn() async {
    final googleSignIn = GoogleSignIn.instance;

    await googleSignIn.signOut();
    final GoogleSignInAccount googleUser = await googleSignIn.authenticate();

    final authorization =
        await googleUser.authorizationClient.authorizationForScopes(
          _googleScopes,
        ) ??
        await googleUser.authorizationClient.authorizeScopes(_googleScopes);

    final idToken = googleUser.authentication.idToken;
    if (idToken == null || idToken.isEmpty) {
      throw const OAuthConfigException(
        'Google did not return an ID token. Check Web + Android/iOS client IDs in Google Cloud and Supabase.',
      );
    }

    try {
      await Supabase.instance.client.auth.signInWithIdToken(
        provider: OAuthProvider.google,
        idToken: idToken,
        accessToken: authorization.accessToken,
      );
    } on AuthException catch (e) {
      throw OAuthConfigException(_friendlyAuthMessage(e));
    }
    await _syncProfileName(googleUser.displayName);
  }

  static String _googleSignInMessage(GoogleSignInException e) {
    final detail = e.description ?? e.toString();
    if (detail.contains('10') || detail.toLowerCase().contains('developer')) {
      return '${GoogleAuthConfig.setupInstructions}\n\n'
          'Android tip: add debug SHA-1 to the Google Cloud **Android** OAuth client '
          '(run `cd mobile && ./scripts/android_sha1.sh`).';
    }
    return detail;
  }

  /// Map a Supabase AuthException (from signInWithIdToken) to a clean,
  /// user-readable message. Supabase returns codes like `user_banned`,
  /// `invalid_credentials`, etc.
  static String _friendlyAuthMessage(AuthException e) {
    final code = e.code;
    final msg = e.message.toLowerCase();
    switch (code) {
      case 'user_banned':
        return 'Your account has been suspended. If you believe this is a '
            'mistake, please contact support.';
      case 'email_not_confirmed':
        return 'Please confirm your email address before signing in.';
      case 'invalid_credentials':
      case 'invalid':
        return 'Google sign-in failed. Please try again.';
      case 'rate_limit_exceeded':
        return 'Too many attempts. Please wait a moment and try again.';
      case 'over_request_rate_limit':
        return 'Too many attempts. Please wait a moment and try again.';
      case 'request_rate_limit_exceeded':
        return 'Too many attempts. Please wait a moment and try again.';
      case 'reauthentication_needed':
        return 'Your session expired. Please sign in again.';
      case 'email_address_not_authorized':
        return 'This email address is not authorized to sign in.';
      case 'user_not_found':
        return 'No account found for this email. Please sign up first.';
      default:
        if (msg.contains('network') ||
            msg.contains('failed to fetch') ||
            msg.contains('connection') ||
            msg.contains('timeout')) {
          return 'Network error. Check your connection and try again.';
        }
        return 'Sign-in failed. Please try again.';
    }
  }

  static Future<void> _syncProfileName(String? name) async {
    final trimmed = name?.trim();
    if (trimmed == null || trimmed.isEmpty) return;
    try {
      final api = ApiClient();
      final json = await api.get('/v1/me') as Map<String, dynamic>;
      final profile = json['profile'] as Map<String, dynamic>?;
      final existing = profile?['display_name'] as String?;
      if (existing != null && existing.trim().isNotEmpty) return;
      await api.patch('/v1/me', {'display_name': trimmed});
    } catch (_) {
      // Profile row is created by DB trigger; name can be set later in edit profile.
    }
  }
}

class OAuthConfigException implements Exception {
  const OAuthConfigException(this.message);
  final String message;
  @override
  String toString() => message;
}

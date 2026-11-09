import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../core/config.dart';
import 'api_client.dart';

/// Google & Apple native sign-in → Supabase session (no SMS / DLT).
class OAuthSignIn {
  static bool _googleReady = false;

  static Future<void> ensureGoogleInitialized() async {
    if (_googleReady || !AppConfig.hasGoogleOAuth) return;
    await GoogleSignIn.instance.initialize(
      clientId: AppConfig.googleIosClientId.isEmpty
          ? null
          : AppConfig.googleIosClientId,
      serverClientId: AppConfig.googleWebClientId,
    );
    _googleReady = true;
  }

  static Future<void> signInWithGoogle() async {
    if (AppConfig.hasGoogleOAuth) {
      await ensureGoogleInitialized();
      if (GoogleSignIn.instance.supportsAuthenticate()) {
        final account = await GoogleSignIn.instance.authenticate();
        final idToken = account.authentication.idToken;
        if (idToken == null || idToken.isEmpty) {
          throw const OAuthConfigException('Google did not return an ID token.');
        }
        await Supabase.instance.client.auth.signInWithIdToken(
          provider: OAuthProvider.google,
          idToken: idToken,
        );
        await _syncProfileName(account.displayName);
        return;
      }
    }
    await _signInWithOAuthBrowser(OAuthProvider.google);
  }

  static Future<void> signInWithApple() async {
    if (await isAppleSignInAvailable) {
      try {
        await _signInWithAppleNative();
        return;
      } on SignInWithAppleAuthorizationException catch (e) {
        if (e.code != AuthorizationErrorCode.canceled) rethrow;
        return;
      } on PlatformException catch (e) {
        if (e.code == 'sign_in_canceled') return;
        // Fall back to browser OAuth (e.g. misconfigured entitlement).
      }
    }
    await _signInWithOAuthBrowser(OAuthProvider.apple);
  }

  static Future<void> _signInWithOAuthBrowser(OAuthProvider provider) async {
    final launched = await Supabase.instance.client.auth.signInWithOAuth(
      provider,
      redirectTo: AppConfig.oauthRedirectUrl,
      authScreenLaunchMode: LaunchMode.externalApplication,
    );
    if (!launched) {
      throw OAuthConfigException(
        'Could not open ${provider.name} sign-in. Enable the provider in Supabase and add redirect URL $AppConfig.oauthRedirectUrl',
      );
    }
  }

  static Future<void> _signInWithAppleNative() async {

    final rawNonce = _generateNonce();
    final hashedNonce = sha256.convert(utf8.encode(rawNonce)).toString();

    final credential = await SignInWithApple.getAppleIDCredential(
      scopes: const [
        AppleIDAuthorizationScopes.email,
        AppleIDAuthorizationScopes.fullName,
      ],
      nonce: hashedNonce,
    );

    final idToken = credential.identityToken;
    if (idToken == null || idToken.isEmpty) {
      throw const OAuthConfigException('Apple did not return an identity token.');
    }

    await Supabase.instance.client.auth.signInWithIdToken(
      provider: OAuthProvider.apple,
      idToken: idToken,
      nonce: rawNonce,
    );

    final parts = <String>[
      if (credential.givenName != null) credential.givenName!,
      if (credential.familyName != null) credential.familyName!,
    ];
    final appleName = parts.join(' ').trim();
    if (appleName.isNotEmpty) {
      await Supabase.instance.client.auth.updateUser(
        UserAttributes(data: {'full_name': appleName}),
      );
    }
    await _syncProfileName(appleName.isNotEmpty ? appleName : null);
  }

  static Future<bool> get isAppleSignInAvailable async {
    if (kIsWeb) return false;
    try {
      return await SignInWithApple.isAvailable();
    } on PlatformException {
      return false;
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

  static String _generateNonce([int length = 32]) {
    const charset =
        '0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._';
    final random = Random.secure();
    return List.generate(length, (_) => charset[random.nextInt(charset.length)])
        .join();
  }
}

class OAuthConfigException implements Exception {
  const OAuthConfigException(this.message);
  final String message;
  @override
  String toString() => message;
}

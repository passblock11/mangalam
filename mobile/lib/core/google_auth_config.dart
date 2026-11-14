import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../services/payload_crypto.dart';
import 'config.dart';

/// Google OAuth client IDs for **native** mobile sign-in (Supabase Flutter doc).
class GoogleAuthConfig {
  GoogleAuthConfig._();

  static String _webClientId = AppConfig.googleWebClientId;
  static String _iosClientId = AppConfig.googleIosClientId;
  static bool _hydrated = false;

  static String get webClientId => _webClientId;
  static String get iosClientId => _iosClientId;

  static bool get hasWebClient => _webClientId.isNotEmpty;
  static bool get hasIosClient => _iosClientId.isNotEmpty;

  /// Native `google_sign_in` per Supabase **Flutter (iOS and Android)** section.
  static bool get isReadyForNative {
    if (kIsWeb) return false;
    if (!hasWebClient) return false;
    if (defaultTargetPlatform == TargetPlatform.iOS && !hasIosClient) {
      return false;
    }
    return true;
  }

  static String get iosReversedClientId {
    if (_iosClientId.isEmpty) return '';
    final prefix = _iosClientId.replaceAll('.apps.googleusercontent.com', '');
    return 'com.googleusercontent.apps.$prefix';
  }

  static String get setupInstructions {
    if (defaultTargetPlatform == TargetPlatform.iOS && !hasIosClient) {
      return 'On iOS, add GOOGLE_IOS_CLIENT_ID in dart_defines.json and '
          'GOOGLE_REVERSED_CLIENT_ID in ios/Flutter/GoogleSignIn.xcconfig.\n'
          'Android only needs the Web client ID (already in the app).';
    }
    if (!hasWebClient) {
      return 'Missing GOOGLE_WEB_CLIENT_ID. Run with:\n'
          'flutter run --dart-define-from-file=dart_defines.json';
    }
    return 'Google sign-in is not ready on this device yet.';
  }

  static const bundleIdIos = 'com.mangalam.mangalamApp';
  static const packageAndroid = 'com.mangalam.mangalam_app';

  /// Optional bootstrap from Vercel env when not in dart_defines.
  static Future<void> hydrate() async {
    if (_hydrated) return;
    _hydrated = true;

    final needWeb = _webClientId.isEmpty;
    final needIos = _iosClientId.isEmpty;
    if (!needWeb && !needIos) return;

    try {
      final uri = Uri.parse('${AppConfig.apiBaseUrl}/v1/public/mobile-config');
      final res = await http
          .get(uri, headers: PayloadCrypto.requestHeaders())
          .timeout(const Duration(seconds: 8));
      if (res.statusCode != 200) return;
      final json =
          jsonDecode(await PayloadCrypto.openIfSealed(res.bodyBytes))
              as Map<String, dynamic>;
      final web = (json['google_web_client_id'] as String?)?.trim() ?? '';
      final ios = (json['google_ios_client_id'] as String?)?.trim() ?? '';
      if (needWeb && web.isNotEmpty) _webClientId = web;
      if (needIos && ios.isNotEmpty) _iosClientId = ios;
    } catch (_) {
      // User must set dart_defines or Vercel GOOGLE_* env vars.
    }
  }
}

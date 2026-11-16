import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../l10n/app_locale.dart';
import 'oauth_sign_in.dart';

/// Lives on [MaterialApp] so the suspension notice stays visible when
/// AuthGate replaces the signed-in screens with the login screen.
final GlobalKey<ScaffoldMessengerState> rootMessengerKey =
    GlobalKey<ScaffoldMessengerState>();

bool _closingBannedSession = false;

/// Signs the member out once. Parallel API calls that all receive a ban
/// share this so the snackbar and sign-out run a single time.
Future<void> closeBannedSession({String? reason}) async {
  if (_closingBannedSession) return;
  _closingBannedSession = true;
  final message = (reason ?? '').trim().isNotEmpty
      ? reason!.trim()
      : 'Your account is suspended due to malicious activity detected.';
  final messenger = rootMessengerKey.currentState;
  messenger
    ?..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        content: Text(t(message)),
      ),
    );
  try {
    await OAuthSignIn.signOutCompletely();
  } catch (_) {
    try {
      await Supabase.instance.client.auth.signOut();
    } catch (_) {}
  } finally {
    _closingBannedSession = false;
  }
}

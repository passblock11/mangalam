import 'package:flutter/material.dart';

import '../../services/oauth_sign_in.dart';
import '../core/mangalam_theme.dart';
import '../../l10n/app_locale.dart';

/// Confirm, then sign out. The loading dialog is popped from the root
/// navigator captured before sign-out, because AuthGate replaces the
/// signed-in tree as soon as the session ends and the tab context is
/// no longer mounted.
Future<void> confirmAndSignOut(BuildContext context) async {
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(t('Log out?')),
      content: Text(t('You will be signed out of Mangalam on this device.'),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(ctx).pop(false),
          child: Text(t('Cancel')),
        ),
        FilledButton(
          onPressed: () => Navigator.of(ctx).pop(true),
          child: Text(t('Log out')),
        ),
      ],
    ),
  );
  if (confirmed != true || !context.mounted) return;

  final nav = Navigator.of(context, rootNavigator: true);
  final route = DialogRoute<void>(
    context: context,
    barrierDismissible: false,
    builder: (ctx) => const Center(
      child: CircularProgressIndicator(color: MangalamTheme.maroon),
    ),
  );
  nav.push(route);
  try {
    await OAuthSignIn.signOutCompletely();
  } finally {
    if (route.isActive) {
      nav.removeRoute(route);
    }
  }
}

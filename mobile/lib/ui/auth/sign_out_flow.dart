import 'package:flutter/material.dart';

import '../../services/oauth_sign_in.dart';
import '../core/mangalam_theme.dart';

/// Confirm, then sign out. The loading dialog is popped from the root
/// navigator captured before sign-out, because AuthGate replaces the
/// signed-in tree as soon as the session ends and the tab context is
/// no longer mounted.
Future<void> confirmAndSignOut(BuildContext context) async {
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text('Log out?'),
      content: const Text(
        'You will be signed out of Mangalam on this device.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(ctx).pop(false),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () => Navigator.of(ctx).pop(true),
          child: const Text('Log out'),
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

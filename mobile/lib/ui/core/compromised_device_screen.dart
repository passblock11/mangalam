import 'package:flutter/material.dart';

import '../../l10n/app_locale.dart';
import 'mangalam_theme.dart';

/// Shown instead of sign-in when this phone is jailbroken or rooted.
class CompromisedDeviceScreen extends StatelessWidget {
  const CompromisedDeviceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: MangalamTheme.cream,
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 28),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(
                  Icons.lock_outline,
                  size: 56,
                  color: MangalamTheme.maroon,
                ),
                const SizedBox(height: 20),
                Text(
                  t("This phone can't open Mangalam"),
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    color: MangalamTheme.ink,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  t(
                    'This phone is rooted or jailbroken, so Mangalam stays closed. Use a normal phone to open the app.',
                  ),
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    color: MangalamTheme.muted,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

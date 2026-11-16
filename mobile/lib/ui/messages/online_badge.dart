import 'package:flutter/material.dart';

import '../../l10n/app_locale.dart';

/// Small green presence dot. Shown only while the other member is online.
class OnlineBadge extends StatelessWidget {
  const OnlineBadge({
    super.key,
    required this.online,
    required this.child,
    this.dot = 14,
  });

  final bool online;
  final Widget child;
  final double dot;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: online ? t('Online') : null,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          child,
          if (online)
            Positioned(
              right: -1,
              bottom: -1,
              child: Container(
                width: dot,
                height: dot,
                decoration: BoxDecoration(
                  color: const Color(0xFF22C55E),
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 2),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

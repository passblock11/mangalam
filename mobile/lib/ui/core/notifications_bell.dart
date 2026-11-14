import 'package:flutter/material.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';

import '../../services/notification_service.dart';
import '../core/mangalam_theme.dart';
import '../notifications/notifications_screen.dart';
import '../../l10n/app_locale.dart';

/// Bell icon button with a live unread badge. Drop into any AppBar actions.
/// Reads from [NotificationService.instance.unreadCount].
class NotificationsBell extends StatelessWidget {
  const NotificationsBell({super.key, this.color});

  final Color? color;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<int>(
      valueListenable: NotificationService.instance.unreadCount,
      builder: (context, count, _) {
        return Stack(
          clipBehavior: Clip.none,
          children: [
            IconButton(
              icon: Icon(Iconsax.notification, color: color),
              tooltip: t('Notifications'),
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => const NotificationsScreen(),
                  ),
                );
              },
            ),
            if (count > 0)
              Positioned(
                right: 6,
                top: 6,
                child: Container(
                  constraints: const BoxConstraints(
                    minWidth: 16,
                    minHeight: 16,
                  ),
                  padding: const EdgeInsets.symmetric(horizontal: 3),
                  decoration: const BoxDecoration(
                    color: MangalamTheme.maroon,
                    borderRadius: BorderRadius.all(Radius.circular(8)),
                    border: Border.fromBorderSide(
                      BorderSide(color: Colors.white, width: 1.2),
                    ),
                  ),
                  child: Center(
                    child: Text(
                      count > 99 ? '99+' : '$count',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 9.5,
                        fontWeight: FontWeight.w800,
                        height: 1,
                      ),
                    ),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}

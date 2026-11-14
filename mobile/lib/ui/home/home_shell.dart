import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';

import '../../l10n/app_locale.dart';
import '../../services/notification_service.dart';
import '../core/mangalam_theme.dart';
import '../discover/discover_tab.dart';
import '../likes/likes_tab.dart';
import '../messages/messages_tab.dart';
import '../profile/profile_tab.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    AppLocale.instance.addListener(_onLocale);
    // Refresh the unread badge when the home shell first mounts.
    NotificationService.instance.onAppResumed();
  }

  @override
  void dispose() {
    AppLocale.instance.removeListener(_onLocale);
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  void _onLocale() {
    if (mounted) setState(() {});
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      NotificationService.instance.onAppResumed();
    }
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 4,
      child: Scaffold(
        body: const TabBarView(
          physics: NeverScrollableScrollPhysics(),
          children: [DiscoverTab(), LikesTab(), MessagesTab(), ProfileTab()],
        ),
        extendBody: true,
        bottomNavigationBar: _GlassNavBar(language: AppLocale.instance.code),
      ),
    );
  }
}

/// Glassmorphism bottom navigation bar — translucent with backdrop blur,
/// subtle gradient overlay, and outlined Iconsax icons.
class _GlassNavBar extends StatelessWidget {
  const _GlassNavBar({required this.language});

  /// Included so a language change produces a new bar. A const bar is reused
  /// as-is and keeps the labels from the previous language.
  final String language;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(28),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
            child: Container(
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.72),
                borderRadius: BorderRadius.circular(28),
                border: Border.all(
                  color: Colors.white.withValues(alpha: 0.6),
                  width: 1.2,
                ),
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    Colors.white.withValues(alpha: 0.85),
                    Colors.white.withValues(alpha: 0.55),
                  ],
                ),
                boxShadow: [
                  BoxShadow(
                    color: MangalamTheme.maroon.withValues(alpha: 0.10),
                    blurRadius: 20,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: TabBar(
                indicator: const BoxDecoration(),
                dividerColor: Colors.transparent,
                labelColor: MangalamTheme.maroon,
                unselectedLabelColor: MangalamTheme.muted,
                labelStyle: const TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 11,
                  height: 1.1,
                ),
                unselectedLabelStyle: const TextStyle(
                  fontWeight: FontWeight.w500,
                  fontSize: 11,
                  height: 1.1,
                ),
                indicatorSize: TabBarIndicatorSize.tab,
                tabs: [
                  _GlassTab(
                    key: ValueKey('discover-$language'),
                    icon: Iconsax.heart_search,
                    label: 'Discover',
                  ),
                  _GlassTab(
                    key: ValueKey('likes-$language'),
                    icon: Iconsax.heart,
                    label: 'Likes',
                  ),
                  _GlassTab(
                    key: ValueKey('chats-$language'),
                    icon: Iconsax.message,
                    label: 'Chats',
                  ),
                  _GlassTab(
                    key: ValueKey('profile-$language'),
                    icon: Iconsax.user,
                    label: 'Profile',
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

class _GlassTab extends StatelessWidget {
  const _GlassTab({super.key, required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Tab(
      iconMargin: const EdgeInsets.only(bottom: 4),
      icon: Icon(icon, size: 22),
      text: t(label),
    );
  }
}

import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';

import '../core/mangalam_theme.dart';
import '../discover/discover_tab.dart';
import '../likes/likes_tab.dart';
import '../messages/messages_tab.dart';
import '../profile/profile_tab.dart';

class HomeShell extends StatelessWidget {
  const HomeShell({super.key});

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
        bottomNavigationBar: const _GlassNavBar(),
      ),
    );
  }
}

/// Glassmorphism bottom navigation bar — translucent with backdrop blur,
/// subtle gradient overlay, and outlined Iconsax icons.
class _GlassNavBar extends StatelessWidget {
  const _GlassNavBar();

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
                tabs: const [
                  _GlassTab(icon: Iconsax.heart_search, label: 'Discover'),
                  _GlassTab(icon: Iconsax.heart, label: 'Likes'),
                  _GlassTab(icon: Iconsax.message, label: 'Chats'),
                  _GlassTab(icon: Iconsax.user, label: 'Profile'),
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
  const _GlassTab({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Tab(
      iconMargin: const EdgeInsets.only(bottom: 4),
      icon: Icon(icon, size: 22),
      text: label,
    );
  }
}

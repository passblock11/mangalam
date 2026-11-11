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
          children: [
            DiscoverTab(),
            LikesTab(),
            MessagesTab(),
            ProfileTab(),
          ],
        ),
        bottomNavigationBar: Container(
          decoration: BoxDecoration(
            color: Colors.white,
            boxShadow: [
              BoxShadow(
                color: MangalamTheme.maroon.withValues(alpha: 0.08),
                blurRadius: 16,
                offset: const Offset(0, -2),
              ),
            ],
            border: Border(
              top: BorderSide(color: Theme.of(context).colorScheme.outlineVariant),
            ),
          ),
          child: SafeArea(
            top: false,
            child: TabBar(
              indicatorColor: MangalamTheme.maroon,
              labelColor: MangalamTheme.maroon,
              unselectedLabelColor: MangalamTheme.muted,
              indicatorSize: TabBarIndicatorSize.label,
              indicator: const UnderlineTabIndicator(
                borderSide: BorderSide(width: 3, color: MangalamTheme.maroon),
                insets: EdgeInsets.symmetric(horizontal: -4),
              ),
              labelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 11),
              unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w500, fontSize: 11),
              tabs: const [
                Tab(icon: Icon(Iconsax.heart), text: 'Discover'),
                Tab(icon: Icon(Iconsax.heart), text: 'Likes'),
                Tab(icon: Icon(Iconsax.message), text: 'Chats'),
                Tab(icon: Icon(Iconsax.user), text: 'Profile'),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

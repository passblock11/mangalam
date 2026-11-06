import 'package:flutter/material.dart';

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
        bottomNavigationBar: Material(
          color: Theme.of(context).colorScheme.surface,
          child: TabBar(
            indicatorColor: Theme.of(context).colorScheme.primary,
            labelColor: Theme.of(context).colorScheme.primary,
            unselectedLabelColor: Theme.of(context).colorScheme.onSurfaceVariant,
            tabs: const [
              Tab(icon: Icon(Icons.home_outlined), text: 'Home'),
              Tab(icon: Icon(Icons.favorite_outline), text: 'Likes'),
              Tab(icon: Icon(Icons.chat_bubble_outline), text: 'Messages'),
              Tab(icon: Icon(Icons.person_outline), text: 'Profile'),
            ],
          ),
        ),
      ),
    );
  }
}

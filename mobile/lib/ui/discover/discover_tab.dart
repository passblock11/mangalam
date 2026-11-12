import 'package:flutter/material.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';

import '../../services/api_client.dart';
import '../../services/oauth_sign_in.dart';
import '../core/mangalam_theme.dart';
import '../core/notifications_bell.dart';
import '../profile/profile_detail_screen.dart';

class DiscoverTab extends StatefulWidget {
  const DiscoverTab({super.key});

  @override
  State<DiscoverTab> createState() => _DiscoverTabState();
}

class _DiscoverTabState extends State<DiscoverTab>
    with SingleTickerProviderStateMixin {
  final _api = ApiClient();
  late TabController _tabController;
  List<dynamic>? _items;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(_onTabChanged);
    _load();
  }

  void _onTabChanged() {
    if (_tabController.indexIsChanging) return;
    // Clear the previous tab's items so a proper centered loader shows
    // while the new tab fetches (instead of flashing the other tab's data).
    setState(() {
      _items = null;
      _error = null;
    });
    _load();
  }

  @override
  void dispose() {
    _tabController.removeListener(_onTabChanged);
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    if (!mounted) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final tab = _tabController.index == 0 ? 'all' : 'shortlist';
      final json =
          await _api.get('/v1/matches', {'tab': tab}) as Map<String, dynamic>;
      if (!mounted) return;
      setState(() {
        _items = json['items'] as List<dynamic>?;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _signOut(BuildContext context) async {
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => const PopScope(
        canPop: false,
        child: Center(
          child: CircularProgressIndicator(color: MangalamTheme.maroon),
        ),
      ),
    );
    try {
      await OAuthSignIn.signOutCompletely();
    } finally {
      if (context.mounted) {
        Navigator.of(context, rootNavigator: true).pop();
      }
    }
  }

  Future<void> _interaction(String id, String action) async {
    try {
      await _api.post('/v1/interactions', {
        'to_profile_id': id,
        'action': action,
      });
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(_actionMessage(action))));
      }
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(e.toString())));
      }
    }
  }

  String _actionMessage(String action) {
    switch (action) {
      case 'like':
        return 'Like sent';
      case 'pass':
        return 'Passed';
      case 'shortlist':
        return 'Shortlisted';
      default:
        return action;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Discover'),
        centerTitle: false,
        actions: [
          const NotificationsBell(),
          IconButton(
            onPressed: () => _signOut(context),
            icon: const Icon(Iconsax.logout),
            tooltip: 'Sign out',
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          tabAlignment: TabAlignment.start,
          tabs: const [
            Tab(text: 'All matches'),
            Tab(text: 'Shortlisted'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [_buildList(context), _buildList(context)],
      ),
    );
  }

  Widget _buildList(BuildContext context) {
    if (_error != null) {
      return MangalamEmptyState(
        icon: Iconsax.warning_2,
        title: 'Something went wrong',
        subtitle: _error,
        action: FilledButton.icon(
          onPressed: _load,
          icon: const Icon(Iconsax.refresh),
          label: const Text('Retry'),
        ),
      );
    }
    if (_loading && _items == null) {
      return const Center(
        child: CircularProgressIndicator(color: MangalamTheme.maroon),
      );
    }
    final items = _items ?? [];
    if (items.isEmpty) {
      return MangalamEmptyState(
        icon: Iconsax.heart_search,
        title: 'No new matches nearby',
        subtitle:
            'Try adjusting your preferences or check back later for new profiles.',
        action: OutlinedButton.icon(
          onPressed: _load,
          icon: const Icon(Iconsax.refresh),
          label: const Text('Refresh'),
        ),
      );
    }
    return RefreshIndicator(
      color: MangalamTheme.maroon,
      onRefresh: _load,
      child: Stack(
        children: [
          ListView.builder(
            padding: EdgeInsets.fromLTRB(
              16,
              _loading ? 20 : 12,
              16,
              MediaQuery.of(context).padding.bottom + 120,
            ),
            itemCount: items.length,
            itemBuilder: (context, i) {
              final m = items[i] as Map<String, dynamic>;
              return Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: _ProfileCard(
                  data: m,
                  onLike: () => _interaction(m['id'] as String, 'like'),
                  onPass: () => _interaction(m['id'] as String, 'pass'),
                  onShortlist: () =>
                      _interaction(m['id'] as String, 'shortlist'),
                  onView: () async {
                    await Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) =>
                            ProfileDetailScreen(profileId: m['id'] as String),
                      ),
                    );
                    if (mounted) await _load();
                  },
                ),
              );
            },
          ),
          if (_loading)
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: LinearProgressIndicator(
                color: MangalamTheme.maroon,
                backgroundColor: MangalamTheme.maroon.withValues(alpha: 0.08),
                minHeight: 2,
              ),
            ),
        ],
      ),
    );
  }
}

class _ProfileCard extends StatelessWidget {
  const _ProfileCard({
    required this.data,
    required this.onLike,
    required this.onPass,
    required this.onShortlist,
    required this.onView,
  });

  final Map<String, dynamic> data;
  final VoidCallback onLike, onPass, onShortlist, onView;

  @override
  Widget build(BuildContext context) {
    final name = data['display_name']?.toString() ?? 'Member';
    final city = data['city']?.toString() ?? '';
    final state = data['state']?.toString() ?? '';
    final community = data['community']?.toString() ?? '';
    final age = data['age'];
    final verified = data['is_verified'] == true;
    final active = data['active_recent'] == true;
    final diet = data['diet']?.toString() ?? '';
    final motherTongue = data['mother_tongue']?.toString() ?? '';
    final photoUrls =
        (data['photo_urls'] as List<dynamic>?)?.cast<String>() ?? const [];

    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
        boxShadow: [
          BoxShadow(
            color: MangalamTheme.maroon.withValues(alpha: 0.06),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(22),
        child: Material(
          color: Colors.white,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              AspectRatio(
                aspectRatio: 4 / 3.4,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    ProfilePhoto(name: name, photoUrls: photoUrls),
                    // Top badges
                    Positioned(
                      top: 10,
                      left: 10,
                      child: Row(
                        children: [
                          if (verified)
                            MangalamBadge(
                              label: 'Verified',
                              icon: Iconsax.verify,
                              color: Colors.white,
                              background: Colors.white.withValues(alpha: 0.22),
                              foreground: Colors.white,
                            ),
                          if (verified) const SizedBox(width: 6),
                          if (active)
                            MangalamBadge(
                              label: 'Active',
                              icon: Iconsax.tick_circle,
                              color: const Color(0xFF2E7D32),
                              background: Colors.white.withValues(alpha: 0.2),
                              foreground: Colors.white,
                            ),
                        ],
                      ),
                    ),
                    // Bottom scrim
                    Positioned(
                      left: 0,
                      right: 0,
                      bottom: 0,
                      child: Container(
                        padding: const EdgeInsets.fromLTRB(16, 28, 16, 14),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [
                              Colors.transparent,
                              Colors.black.withValues(alpha: 0.55),
                            ],
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    name,
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 22,
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: -0.3,
                                    ),
                                  ),
                                ),
                                if (age != null)
                                  Text(
                                    '$age yrs',
                                    style: TextStyle(
                                      color: Colors.white.withValues(
                                        alpha: 0.92,
                                      ),
                                      fontSize: 14,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Text(
                              [
                                if (community.isNotEmpty) community,
                                if (city.isNotEmpty) '$city, $state',
                              ].join(' · '),
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.88),
                                fontSize: 13,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 12, 14, 4),
                child: Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    if (diet.isNotEmpty) _tag(Iconsax.cup, diet),
                    if (motherTongue.isNotEmpty)
                      _tag(Iconsax.translate, motherTongue),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 6, 12, 12),
                child: Row(
                  children: [
                    _OutlineAction(
                      icon: Iconsax.close_circle,
                      color: const Color(0xFFE57373),
                      onTap: onPass,
                      tooltip: 'Pass',
                    ),
                    const SizedBox(width: 10),
                    _OutlineAction(
                      icon: Iconsax.heart,
                      color: MangalamTheme.maroon,
                      onTap: onLike,
                      tooltip: 'Like',
                      size: 56,
                      bold: true,
                    ),
                    const SizedBox(width: 10),
                    _OutlineAction(
                      icon: Iconsax.star,
                      color: MangalamTheme.gold,
                      onTap: onShortlist,
                      tooltip: 'Shortlist',
                    ),
                    const Spacer(),
                    TextButton(
                      onPressed: onView,
                      child: const Text('View profile'),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _tag(IconData icon, String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: MangalamTheme.maroon.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: MangalamTheme.maroon),
          const SizedBox(width: 4),
          Text(
            text,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: MangalamTheme.maroon,
            ),
          ),
        ],
      ),
    );
  }
}

/// Outlined circular action button (no filled background).
class _OutlineAction extends StatelessWidget {
  const _OutlineAction({
    required this.icon,
    required this.color,
    required this.onTap,
    required this.tooltip,
    this.size = 46,
    this.bold = false,
  });

  final IconData icon;
  final Color color;
  final VoidCallback onTap;
  final String tooltip;
  final double size;
  final bool bold;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: Material(
        color: Colors.transparent,
        shape: CircleBorder(
          side: BorderSide(color: color.withValues(alpha: 0.5), width: 1.5),
        ),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onTap,
          child: Container(
            width: size,
            height: size,
            alignment: Alignment.center,
            child: Icon(
              icon,
              size: size * 0.42,
              color: color,
              fill: bold ? 1.0 : 0.0,
            ),
          ),
        ),
      ),
    );
  }
}

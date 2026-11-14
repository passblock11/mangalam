import 'package:flutter/material.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';

import '../../l10n/app_locale.dart';
import '../../services/api_client.dart';
import '../auth/sign_out_flow.dart';
import '../core/mangalam_theme.dart';
import '../core/notifications_bell.dart';
import '../core/photo_gallery.dart';
import '../profile/profile_detail_screen.dart';
import 'discover_filters.dart';

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
  bool _hold = false;
  String? _likingId;
  DiscoverFilters _filters = const DiscoverFilters();
  int _loadGen = 0;

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

  Future<void> _load({bool hold = false}) async {
    if (!mounted) return;
    final gen = ++_loadGen;
    setState(() {
      _loading = true;
      _error = null;
      if (hold) _hold = true;
    });
    try {
      final tab = _tabController.index == 0 ? 'all' : 'shortlist';
      final json = await _api.get('/v1/matches', {
            'tab': tab,
            ..._filters.toQuery(),
          })
          as Map<String, dynamic>;
      if (!mounted || gen != _loadGen) return;
      setState(() {
        _items = json['items'] as List<dynamic>?;
        _loading = false;
        _hold = false;
      });
    } catch (e) {
      if (!mounted || gen != _loadGen) return;
      setState(() {
        _error = userFacingError(e);
        _loading = false;
        _hold = false;
      });
    }
  }

  Future<void> _openFilters() async {
    final next = await showDiscoverFilters(context, _filters);
    if (next == null || !mounted) return;
    setState(() => _filters = next);
    await _load(hold: true);
  }

  Future<void> _clearFilters() async {
    setState(() => _filters = const DiscoverFilters());
    await _load(hold: true);
  }

  Future<void> _signOut(BuildContext context) => confirmAndSignOut(context);

  Future<void> _interaction(String id) async {
    if (_likingId != null) return;
    setState(() {
      _likingId = id;
      _hold = true;
    });
    try {
      final res =
          await _api.post('/v1/interactions', {
                'to_profile_id': id,
                'action': 'like',
              })
              as Map<String, dynamic>;
      final interaction = res['interaction'] as Map<String, dynamic>?;
      final mutual = interaction?['status'] == 'mutual';
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            t(
              mutual
                  ? 'It\'s a match. They moved to Matches.'
                  : 'Liked. They are in your Shortlisted tab.',
            ),
          ),
        ),
      );
      await _load(hold: true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _hold = false);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(tError(e))));
    } finally {
      if (mounted) setState(() => _likingId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(t('Discover')),
        centerTitle: false,
        actions: [
          const NotificationsBell(),
          IconButton(
            onPressed: () => _signOut(context),
            icon: const Icon(Iconsax.logout),
            tooltip: t('Sign out'),
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(kTextTabBarHeight),
          child: SizedBox(
            height: kTextTabBarHeight,
            child: Row(
              children: [
                Expanded(
                  child: TabBar(
                    controller: _tabController,
                    isScrollable: true,
                    tabAlignment: TabAlignment.start,
                    tabs: [
                      Tab(text: t('Discover')),
                      Tab(text: t('Shortlisted')),
                    ],
                  ),
                ),
                IconButton(
                  tooltip: t('Filters'),
                  visualDensity: VisualDensity.compact,
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints.tightFor(
                    width: 44,
                    height: 44,
                  ),
                  onPressed: _openFilters,
                  color: _filters.active ? MangalamTheme.maroon : null,
                  icon: const Icon(Iconsax.setting_4),
                ),
                const SizedBox(width: 4),
              ],
            ),
          ),
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
          onPressed: () => _load(),
          icon: const Icon(Iconsax.refresh),
          label: Text(t('Retry')),
        ),
      );
    }
    if (_loading && _items == null) {
      return const Center(
        child: CircularProgressIndicator(color: MangalamTheme.maroon),
      );
    }
    final items = _items ?? [];
    final body = items.isEmpty
        ? _emptyState(context)
        : _profileList(context, items);
    if (!_hold) return body;
    return Stack(
      children: [
        AbsorbPointer(child: body),
        const Positioned.fill(
          child: ColoredBox(color: Color(0xA6FFF8F3)),
        ),
        const Center(
          child: SizedBox(
            width: 36,
            height: 36,
            child: CircularProgressIndicator(
              color: MangalamTheme.maroon,
              strokeWidth: 3,
            ),
          ),
        ),
      ],
    );
  }

  Widget _emptyState(BuildContext context) {
    final shortlist = _tabController.index == 1;
    final filtered = _filters.active;
    return MangalamEmptyState(
      icon: Iconsax.heart_search,
      title: filtered
          ? (shortlist
                ? 'No shortlisted profiles match these filters.'
                : 'No profiles match these filters')
          : (shortlist ? 'Nothing shortlisted yet' : 'No new profiles nearby'),
      subtitle: filtered
          ? 'Widen a range or clear the filters to see more profiles.'
          : (shortlist
                ? 'People you like show up here. When they like you back, they move to Matches.'
                : 'Try adjusting your preferences or check back later for new profiles.'),
      action: filtered
          ? Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                FilledButton(
                  onPressed: _clearFilters,
                  child: Text(t('Clear filters')),
                ),
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  onPressed: () => _load(),
                  icon: const Icon(Iconsax.refresh),
                  label: Text(t('Refresh')),
                ),
              ],
            )
          : OutlinedButton.icon(
              onPressed: () => _load(),
              icon: const Icon(Iconsax.refresh),
              label: Text(t('Refresh')),
            ),
    );
  }

  Widget _profileList(BuildContext context, List<dynamic> items) {
    final showBar = _loading && !_hold;
    return RefreshIndicator(
      color: MangalamTheme.maroon,
      onRefresh: () => _load(),
      child: Stack(
        children: [
          ListView.builder(
            padding: EdgeInsets.fromLTRB(
              16,
              showBar ? 20 : 12,
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
                  onLike: () => _interaction(m['id'] as String),
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
          if (showBar)
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
    required this.onView,
  });

  final Map<String, dynamic> data;
  final VoidCallback onLike, onView;

  @override
  Widget build(BuildContext context) {
    final name = data['display_name']?.toString() ?? t('Member');
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
              Stack(
                children: [
                  PhotoGallery(
                    name: name,
                    photoUrls: photoUrls,
                    aspectRatio: 4 / 3.4,
                    showCountBadge: true,
                    locked: data['photos_locked'] == true,
                  ),
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
                  // Bottom scrim (ignore pointer so photo swipe/tap still work)
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: 0,
                    child: IgnorePointer(
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
                                    tf('{n} yrs', {'n': '$age'}),
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
                                if (city.isNotEmpty) '$city, ${t(state)}',
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
                  ),
                ],
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
                      icon: Iconsax.heart,
                      color: MangalamTheme.maroon,
                      onTap: onLike,
                      tooltip: t('Like'),
                      size: 56,
                      bold: true,
                    ),
                    const Spacer(),
                    TextButton(
                      onPressed: onView,
                      child: Text(t('View profile')),
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
            tValue(text),
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

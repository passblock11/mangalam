import 'package:flutter/material.dart';

import '../../services/api_client.dart';
import '../../services/oauth_sign_in.dart';
import '../profile/profile_detail_screen.dart';

enum DiscoverMode { all, shortlist }

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

  Future<void> _interaction(String id, String action) async {
    try {
      await _api.post('/v1/interactions', {
        'to_profile_id': id,
        'action': action,
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${action[0].toUpperCase()}${action.substring(1)} sent')),
        );
      }
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString())),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return NestedScrollView(
      headerSliverBuilder: (context, inner) => [
        SliverAppBar.large(
          title: const Text('Discover'),
          actions: [
            IconButton(
              onPressed: () => OAuthSignIn.signOutCompletely(),
              icon: const Icon(Icons.logout),
              tooltip: 'Sign out',
            ),
          ],
          bottom: TabBar(
            controller: _tabController,
            tabs: const [
              Tab(text: 'All'),
              Tab(text: 'Shortlist'),
            ],
          ),
        ),
      ],
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildList(context),
          _buildList(context),
        ],
      ),
    );
  }

  Widget _buildList(BuildContext context) {
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(_error!, textAlign: TextAlign.center),
              const SizedBox(height: 16),
              FilledButton(onPressed: _load, child: const Text('Retry')),
            ],
          ),
        ),
      );
    }
    if (_loading && _items == null) {
      return const Center(child: CircularProgressIndicator());
    }
    final items = _items ?? [];
    if (items.isEmpty) {
      return Center(
        child: TextButton(onPressed: _load, child: const Text('No profiles — tap to refresh')),
      );
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        itemCount: items.length,
        itemBuilder: (context, i) {
          final m = items[i] as Map<String, dynamic>;
          final id = m['id'] as String;
          final name = m['display_name'] ?? 'Member';
          final city = m['city'] ?? '';
          final state = m['state'] ?? '';
          final community = m['community'] ?? '';
          final age = m['age'];
          final verified = m['is_verified'] == true;
          return Card(
            clipBehavior: Clip.antiAlias,
            margin: const EdgeInsets.only(bottom: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                AspectRatio(
                  aspectRatio: 4 / 5,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          Theme.of(context).colorScheme.surfaceContainerHighest,
                          Theme.of(context).colorScheme.surface,
                        ],
                      ),
                    ),
                    child: Icon(
                      Icons.person,
                      size: 72,
                      color: Theme.of(context).colorScheme.outline,
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          name,
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                      ),
                      if (verified)
                        Icon(Icons.verified, color: Colors.green.shade700, size: 22),
                      if (m['active_recent'] == true) ...[
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: Colors.green.shade50,
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            'Active',
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.green.shade800,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Text(
                    [
                      if (age != null) '$age years',
                      if (community.toString().isNotEmpty) community,
                    ].join(' · '),
                  ),
                ),
                if (city.toString().isNotEmpty || state.toString().isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
                    child: Text(
                      '$city, $state',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: Theme.of(context).colorScheme.onSurfaceVariant,
                          ),
                    ),
                  ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                  child: Row(
                    children: [
                      IconButton.filledTonal(
                        onPressed: () => _interaction(id, 'like'),
                        icon: const Icon(Icons.favorite),
                        tooltip: 'Like',
                      ),
                      IconButton.filledTonal(
                        onPressed: () => _interaction(id, 'pass'),
                        icon: const Icon(Icons.close),
                        tooltip: 'Pass',
                      ),
                      IconButton.filledTonal(
                        onPressed: () => _interaction(id, 'shortlist'),
                        icon: const Icon(Icons.star_outline),
                        tooltip: 'Shortlist',
                      ),
                      const Spacer(),
                      FilledButton(
                        onPressed: () async {
                          await Navigator.of(context).push(
                            MaterialPageRoute<void>(
                              builder: (_) => ProfileDetailScreen(profileId: id),
                            ),
                          );
                          if (mounted) await _load();
                        },
                        child: const Text('View profile'),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

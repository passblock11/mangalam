import 'package:flutter/material.dart';

import '../../services/api_client.dart';
import '../../utils/formatting.dart';
import '../messages/chat_screen.dart';
import '../profile/profile_detail_screen.dart';

class LikesTab extends StatefulWidget {
  const LikesTab({super.key});

  @override
  State<LikesTab> createState() => _LikesTabState();
}

class _LikesTabState extends State<LikesTab> with SingleTickerProviderStateMixin {
  final _api = ApiClient();
  late TabController _controller;
  int _reloadKey = 0;

  @override
  void initState() {
    super.initState();
    _controller = TabController(length: 3, vsync: this);
    _controller.addListener(_onTab);
  }

  void _onTab() {
    if (_controller.indexIsChanging) return;
    setState(() => _reloadKey++);
  }

  @override
  void dispose() {
    _controller.removeListener(_onTab);
    _controller.dispose();
    super.dispose();
  }

  String get _tabParam {
    switch (_controller.index) {
      case 0:
        return 'mutual';
      case 1:
        return 'views';
      case 2:
      default:
        return 'contacts';
    }
  }

  Future<List<dynamic>> _fetch() async {
    final json = await _api.get('/v1/likes', {'tab': _tabParam}) as Map<String, dynamic>;
    return json['items'] as List<dynamic>? ?? [];
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Material(
          color: Theme.of(context).colorScheme.surface,
          child: TabBar(
            controller: _controller,
            tabs: const [
              Tab(text: 'Matches'),
              Tab(text: 'Views'),
              Tab(text: 'Contacts'),
            ],
          ),
        ),
        Expanded(
          child: FutureBuilder<List<dynamic>>(
            key: ValueKey('${_controller.index}_$_reloadKey'),
            future: _fetch(),
            builder: (context, snap) {
              if (snap.connectionState == ConnectionState.waiting) {
                return const Center(child: CircularProgressIndicator());
              }
              if (snap.hasError) {
                return Center(child: Text(snap.error.toString()));
              }
              final items = snap.data ?? [];
              String? banner;
              if (_controller.index == 0) {
                banner = 'Find your matches here';
              } else if (_controller.index == 1) {
                banner = 'Find who viewed your profile here';
              } else {
                banner = 'Profiles you contacted';
              }
              if (items.isEmpty) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _Banner(text: banner),
                    const Expanded(child: Center(child: Text('Nothing here yet'))),
                  ],
                );
              }
              return ListView.separated(
                padding: EdgeInsets.zero,
                itemCount: items.length + 1,
                separatorBuilder: (_, _) => const Divider(height: 1),
                itemBuilder: (context, i) {
                  if (i == 0) return _Banner(text: banner!);
                  final row = items[i - 1] as Map<String, dynamic>;
                  final profile = row['profile'] as Map<String, dynamic>? ?? {};
                  final id = profile['id'] as String? ?? '';
                  final name = profile['display_name'] ?? 'Member';
                  final community = profile['community'] ?? '';
                  final lang = profile['mother_tongue'] ?? '';
                  final city = profile['city'] ?? '';
                  final state = profile['state'] ?? '';
                  final age = profile['age'];
                  final verified = profile['is_verified'] == true;
                  final matchedAt = row['matched_at'] as String?;
                  final viewedAt = row['viewed_at'] as String?;
                  final contactedAt = row['contacted_at'] as String?;
                  final phone = profile['phone'] as String?;

                  String line3 = '';
                  if (_tabParam == 'mutual' && matchedAt != null) {
                    line3 = 'Matched ${formatRelativeTime(matchedAt)}';
                  } else if (_tabParam == 'views' && viewedAt != null) {
                    line3 = 'Seen ${formatRelativeTime(viewedAt)}';
                  } else if (_tabParam == 'contacts' && contactedAt != null) {
                    line3 = 'Contacted ${formatRelativeTime(contactedAt)}';
                  }

                  return ListTile(
                    leading: CircleAvatar(
                      child: Text(name.isNotEmpty ? name[0].toUpperCase() : '?'),
                    ),
                    title: Row(
                      children: [
                        Expanded(
                          child: Text(
                            name,
                            style: const TextStyle(fontWeight: FontWeight.w600),
                          ),
                        ),
                        if (verified)
                          Icon(Icons.verified, size: 18, color: Colors.green.shade700),
                      ],
                    ),
                    subtitle: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SizedBox(height: 4),
                        Text(
                          [
                            if (age != null) '$age years',
                            if (community.toString().isNotEmpty) community,
                            if (lang.toString().isNotEmpty) lang,
                          ].where((e) => e.toString().isNotEmpty).join(', '),
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                        Text(
                          '$city, $state',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                        if (line3.isNotEmpty)
                          Text(
                            line3,
                            style: TextStyle(color: Colors.grey.shade700, fontSize: 12),
                          ),
                      ],
                    ),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        PopupMenuButton<String>(
                          icon: const Icon(Icons.more_vert),
                          onSelected: (v) {
                            if (v == 'profile') {
                              Navigator.of(context).push(
                                MaterialPageRoute<void>(
                                  builder: (_) => ProfileDetailScreen(profileId: id),
                                ),
                              );
                            }
                          },
                          itemBuilder: (_) => const [
                            PopupMenuItem(value: 'profile', child: Text('View profile')),
                          ],
                        ),
                        IconButton(
                          icon: const Icon(Icons.phone_outlined),
                          tooltip: 'Call',
                          onPressed: phone != null && phone.isNotEmpty ? () {} : null,
                        ),
                        IconButton(
                          icon: const Icon(Icons.chat_bubble_outline),
                          tooltip: 'Message',
                          onPressed: () async {
                            try {
                              final res = await _api.post('/v1/conversations', {
                                'other_profile_id': id,
                                'first_message':
                                    'Hi $name 👋, I saw your profile and wanted to connect.',
                              }) as Map<String, dynamic>;
                              final cid = res['conversation_id'] as String?;
                              if (cid != null && context.mounted) {
                                await Navigator.of(context).push(
                                  MaterialPageRoute<void>(
                                    builder: (_) => ChatScreen(
                                      conversationId: cid,
                                      otherName: name,
                                    ),
                                  ),
                                );
                                setState(() => _reloadKey++);
                              }
                            } catch (_) {
                              if (context.mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text(
                                      'You need a mutual match to start chat — open profile to connect.',
                                    ),
                                  ),
                                );
                                await Navigator.of(context).push(
                                  MaterialPageRoute<void>(
                                    builder: (_) => ProfileDetailScreen(profileId: id),
                                  ),
                                );
                              }
                            }
                          },
                        ),
                      ],
                    ),
                    onTap: () {
                      Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => ProfileDetailScreen(profileId: id),
                        ),
                      );
                    },
                  );
                },
              );
            },
          ),
        ),
      ],
    );
  }
}

class _Banner extends StatelessWidget {
  const _Banner({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      color: Theme.of(context).colorScheme.errorContainer.withValues(alpha: 0.35),
      child: Text(
        text,
        style: Theme.of(context).textTheme.bodyMedium,
      ),
    );
  }
}

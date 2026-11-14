import 'package:flutter/material.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../l10n/app_locale.dart';
import '../../services/api_client.dart';
import '../../utils/formatting.dart';
import '../core/mangalam_theme.dart';
import '../messages/chat_screen.dart';
import '../profile/profile_detail_screen.dart';
import '../profile/profile_widgets.dart';

class LikesTab extends StatefulWidget {
  const LikesTab({super.key});

  @override
  State<LikesTab> createState() => _LikesTabState();
}

class _LikesTabState extends State<LikesTab>
    with SingleTickerProviderStateMixin {
  final _api = ApiClient();
  late TabController _controller;
  int _reloadKey = 0;

  @override
  void initState() {
    super.initState();
    _controller = TabController(length: 4, vsync: this);
    _controller.addListener(_onTab);
  }

  void _onTab() {
    if (_controller.indexIsChanging) return;
    if (!mounted) return;
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
        return 'liked';
      case 1:
        return 'mutual';
      case 2:
        return 'views';
      case 3:
      default:
        return 'contacts';
    }
  }

  String get _emptySubtitle {
    switch (_controller.index) {
      case 0:
        return 'People who liked you are here. Like them back and they move to Matches.';
      case 1:
        return 'Your mutual matches will appear here.';
      case 2:
        return 'Profiles that viewed you will show up here.';
      default:
        return 'Profiles you contacted will appear here.';
    }
  }

  Future<List<dynamic>> _fetch() async {
    final json =
        await _api.get('/v1/likes', {'tab': _tabParam}) as Map<String, dynamic>;
    return json['items'] as List<dynamic>? ?? [];
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(t('Connections')),
        bottom: TabBar(
          controller: _controller,
          isScrollable: true,
          tabAlignment: TabAlignment.start,
          tabs: [
            Tab(text: t('Like')),
            Tab(text: t('Matches')),
            Tab(text: t('Views')),
            Tab(text: t('Contacts')),
          ],
        ),
      ),
      body: FutureBuilder<List<dynamic>>(
        key: ValueKey('${_controller.index}_$_reloadKey'),
        future: _fetch(),
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(
              child: CircularProgressIndicator(color: MangalamTheme.maroon),
            );
          }
          if (snap.hasError) {
            return MangalamEmptyState(
              icon: Iconsax.warning_2,
              title: 'Could not load',
              subtitle: snap.error.toString(),
              action: FilledButton(
                onPressed: () => setState(() => _reloadKey++),
                child: Text(t('Retry')),
              ),
            );
          }
          final items = snap.data ?? [];
          if (items.isEmpty) {
            return MangalamEmptyState(
              icon: _iconForTab(_controller.index),
              title: _emptyTitle(_controller.index),
              subtitle: _emptySubtitle,
            );
          }
          return RefreshIndicator(
            color: MangalamTheme.maroon,
            onRefresh: () async {
              if (!mounted) return;
              setState(() => _reloadKey++);
              // Give the FutureBuilder a tick to start the new fetch.
              await Future<void>.delayed(const Duration(milliseconds: 50));
            },
            child: ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: EdgeInsets.fromLTRB(
                16,
                12,
                16,
                MediaQuery.of(context).padding.bottom + 120,
              ),
              itemCount: items.length,
              separatorBuilder: (_, _) => const SizedBox(height: 10),
              itemBuilder: (context, i) {
                final row = items[i] as Map<String, dynamic>;
                final profile = row['profile'] as Map<String, dynamic>? ?? {};
                return _ConnectionRow(
                  profile: profile,
                  meta: row,
                  tabParam: _tabParam,
                  onMessage: () => _openChat(profile),
                  onView: () => Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => ProfileDetailScreen(
                        profileId: profile['id'] as String? ?? '',
                      ),
                    ),
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }

  IconData _iconForTab(int i) {
    switch (i) {
      case 0:
        return Iconsax.heart;
      case 1:
        return Iconsax.heart_circle;
      case 2:
        return Iconsax.eye;
      default:
        return Iconsax.profile_2user;
    }
  }

  String _emptyTitle(int i) {
    switch (i) {
      case 0:
        return 'No likes yet';
      case 1:
        return 'No matches yet';
      case 2:
        return 'No views yet';
      default:
        return 'No contacts yet';
    }
  }

  Future<void> _openChat(Map<String, dynamic> profile) async {
    final id = profile['id'] as String? ?? '';
    final name = profile['display_name']?.toString() ?? t('Member');
    final photoUrls =
        (profile['photo_urls'] as List<dynamic>?)?.cast<String>() ?? const [];
    try {
      final res =
          await _api.post('/v1/conversations', {
                'other_profile_id': id,
                'first_message': tf(
                  'Hi {name}, I saw your profile and wanted to connect.',
                  {'name': name},
                ),
              })
              as Map<String, dynamic>;
      final cid = res['conversation_id'] as String?;
      if (!mounted) return;
      if (cid != null) {
        await Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => ChatScreen(
              conversationId: cid,
              otherName: name,
              otherProfileId: id,
              otherPhotoUrls: photoUrls,
              photosLocked: profile['photos_locked'] == true,
              contactLocked: profile['contact_locked'] == true,
            ),
          ),
        );
        if (mounted) setState(() => _reloadKey++);
      }
    } catch (e) {
      if (!mounted) return;
      showMessageCreditFailure(context, e);
    }
  }
}

class _ConnectionRow extends StatelessWidget {
  const _ConnectionRow({
    required this.profile,
    required this.meta,
    required this.tabParam,
    required this.onMessage,
    required this.onView,
  });

  final Map<String, dynamic> profile;
  final Map<String, dynamic> meta;
  final String tabParam;
  final VoidCallback onMessage;
  final VoidCallback onView;

  @override
  Widget build(BuildContext context) {
    final name = profile['display_name']?.toString() ?? t('Member');
    final community = profile['community']?.toString() ?? '';
    final lang = profile['mother_tongue']?.toString() ?? '';
    final city = profile['city']?.toString() ?? '';
    final state = profile['state']?.toString() ?? '';
    final age = profile['age'];
    final verified = profile['is_verified'] == true;
    final phone = profile['phone'] as String?;
    final photoUrls =
        (profile['photo_urls'] as List<dynamic>?)?.cast<String>() ?? const [];

    final matchedAt = meta['matched_at'] as String?;
    final viewedAt = meta['viewed_at'] as String?;
    final contactedAt = meta['contacted_at'] as String?;
    final likedAt = meta['liked_at'] as String?;

    String? line3;
    if (tabParam == 'liked' && likedAt != null) {
      line3 = tf('Liked {when}', {'when': formatRelativeTime(likedAt)});
    } else if (tabParam == 'mutual' && matchedAt != null) {
      line3 = tf('Matched {when}', {'when': formatRelativeTime(matchedAt)});
    } else if (tabParam == 'views' && viewedAt != null) {
      line3 = tf('Seen {when}', {'when': formatRelativeTime(viewedAt)});
    } else if (tabParam == 'contacts' && contactedAt != null) {
      line3 = tf('Contacted {when}', {'when': formatRelativeTime(contactedAt)});
    }

    return MangalamCard(
      padding: EdgeInsets.zero,
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onView,
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(14),
            child: SizedBox(
              width: 60,
              height: 60,
              child: ProfilePhoto(
                name: name,
                photoUrls: photoUrls,
                locked: profile['photos_locked'] == true,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 16,
                        ),
                      ),
                    ),
                    if (verified) ...[
                      const SizedBox(width: 6),
                      const VerifiedBadge(compact: true),
                    ],
                  ],
                ),
                const SizedBox(height: 3),
                Text(
                  [
                    if (age != null) tf('{n} yrs', {'n': '$age'}),
                    if (community.isNotEmpty) community,
                    if (lang.isNotEmpty) t(lang),
                  ].join(' · '),
                  style: const TextStyle(
                    fontSize: 12.5,
                    color: MangalamTheme.muted,
                  ),
                ),
                if (city.isNotEmpty || state.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Row(
                      children: [
                        const Icon(
                          Iconsax.location,
                          size: 12,
                          color: MangalamTheme.muted,
                        ),
                        const SizedBox(width: 3),
                        Expanded(
                          child: Text(
                            '$city, ${t(state)}',
                            style: const TextStyle(
                              fontSize: 12,
                              color: MangalamTheme.muted,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                if (line3 != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      line3,
                      style: const TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w600,
                        color: MangalamTheme.maroon,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Column(
            children: [
              IconButton(
                onPressed: onMessage,
                icon: const Icon(Iconsax.message),
                color: MangalamTheme.maroon,
                style: IconButton.styleFrom(
                  backgroundColor: MangalamTheme.maroon.withValues(alpha: 0.08),
                ),
              ),
              IconButton(
                tooltip: phone != null && phone.isNotEmpty
                    ? 'Call'
                    : 'Open profile to unlock contact',
                onPressed: phone != null && phone.isNotEmpty
                    ? () async {
                        final uri = Uri.parse(
                          'tel:${phone.replaceAll(RegExp(r'\s'), '')}',
                        );
                        if (await canLaunchUrl(uri)) await launchUrl(uri);
                      }
                    : onView,
                icon: const Icon(Iconsax.call),
                color: MangalamTheme.gold,
                style: IconButton.styleFrom(
                  backgroundColor: MangalamTheme.gold.withValues(alpha: 0.12),
                ),
              ),
            ],
          ),
        ],
          ),
        ),
      ),
    );
  }
}

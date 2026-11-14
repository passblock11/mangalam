import 'dart:async';

import 'package:flutter/material.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../services/api_client.dart';
import '../../utils/formatting.dart';
import '../core/mangalam_theme.dart';
import '../core/notifications_bell.dart';
import '../profile/profile_widgets.dart';
import 'chat_screen.dart';
import '../../l10n/app_locale.dart';

class MessagesTab extends StatefulWidget {
  const MessagesTab({super.key});

  @override
  State<MessagesTab> createState() => _MessagesTabState();
}

class _MessagesTabState extends State<MessagesTab>
    with SingleTickerProviderStateMixin {
  final _api = ApiClient();
  late TabController _tab;
  int _key = 0;
  RealtimeChannel? _channel;
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: 2, vsync: this);
    _tab.addListener(_onTab);
    _subscribeRealtime();
  }

  void _onTab() {
    if (_tab.indexIsChanging) return;
    if (!mounted) return;
    setState(() => _key++);
  }

  /// Live-refresh conversation previews when any message is inserted.
  void _subscribeRealtime() {
    _channel = Supabase.instance.client.channel('messages_list');
    _channel!
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'messages',
          callback: (_) {
            // Debounce bursts so a fast conversation doesn't spam refetches.
            _debounce?.cancel();
            _debounce = Timer(const Duration(milliseconds: 400), () {
              if (mounted) setState(() => _key++);
            });
          },
        )
        .subscribe();
  }

  @override
  void dispose() {
    _tab.removeListener(_onTab);
    _tab.dispose();
    _debounce?.cancel();
    if (_channel != null) {
      try {
        Supabase.instance.client.removeChannel(_channel!);
      } catch (_) {}
    }
    super.dispose();
  }

  String get _folder => _tab.index == 0 ? 'primary' : 'sent';

  Future<List<dynamic>> _load() async {
    final json =
        await _api.get('/v1/conversations', {'folder': _folder})
            as Map<String, dynamic>;
    return json['conversations'] as List<dynamic>? ?? [];
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(t('Messages')),
        actions: const [NotificationsBell()],
        bottom: TabBar(
          controller: _tab,
          isScrollable: true,
          tabAlignment: TabAlignment.start,
          tabs: [
            Tab(text: t('Primary')),
            Tab(text: t('Sent')),
          ],
        ),
      ),
      body: FutureBuilder<List<dynamic>>(
        key: ValueKey('$_folder$_key'),
        future: _load(),
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(
              child: CircularProgressIndicator(color: MangalamTheme.maroon),
            );
          }
          if (snap.hasError) {
            return MangalamEmptyState(
              icon: Iconsax.warning_2,
              title: 'Could not load messages',
              subtitle: snap.error.toString(),
              action: FilledButton(
                onPressed: () => setState(() => _key++),
                child: Text(t('Retry')),
              ),
            );
          }
          final list = snap.data ?? [];
          if (list.isEmpty) {
            return MangalamEmptyState(
              icon: Iconsax.message,
              title: 'No conversations yet',
              subtitle: 'Start a chat from a match\'s profile to see it here.',
            );
          }
          return ListView.separated(
            padding: EdgeInsets.fromLTRB(
              8,
              8,
              8,
              MediaQuery.of(context).padding.bottom + 120,
            ),
            itemCount: list.length,
            separatorBuilder: (_, _) => const Divider(height: 1, indent: 76),
            itemBuilder: (context, i) {
              final row = list[i] as Map<String, dynamic>;
              final id = row['id'] as String;
              final other = row['other_profile'] as Map<String, dynamic>? ?? {};
              final name = other['display_name']?.toString() ?? t('Member');
              final last = row['last_message'] as Map<String, dynamic>?;
              final rawBody = last?['body'] as String? ?? '';
              final attachType = last?['attachment_type']?.toString();
              final deleted = last?['deleted'] == true;
              final body = deleted
                  ? t('This message is deleted')
                  : rawBody.trim().isNotEmpty
                      ? rawBody
                      : attachType == 'image'
                          ? t('📷 Photo')
                          : attachType == 'audio'
                              ? t('🎤 Voice message')
                              : attachType != null
                                  ? '📎 ${last?['attachment_name'] ?? t('File')}'
                                  : '';
              final created = last?['created_at'] as String?;
              final verified = other['is_verified'] == true;
              final photoUrls =
                  (other['photo_urls'] as List<dynamic>?)?.cast<String>() ??
                  const [];

              return ListTile(
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 6,
                ),
                leading: ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: SizedBox(
                    width: 52,
                    height: 52,
                    child: ProfilePhoto(
                      name: name,
                      photoUrls: photoUrls,
                      locked: other['photos_locked'] == true,
                    ),
                  ),
                ),
                title: Row(
                  children: [
                    Flexible(
                      child: Text(
                        name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 15.5,
                        ),
                      ),
                    ),
                    if (verified) ...[
                      const SizedBox(width: 6),
                      const VerifiedBadge(compact: true),
                    ],
                  ],
                ),
                subtitle: Text(
                  body.isEmpty ? t('Say hello') : body,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: MangalamTheme.muted,
                    fontSize: 13.5,
                  ),
                ),
                trailing: Text(
                  formatRelativeTime(created),
                  style: const TextStyle(
                    fontSize: 11.5,
                    color: MangalamTheme.muted,
                  ),
                ),
                onTap: () async {
                  await Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => ChatScreen(
                        conversationId: id,
                        otherName: name,
                        otherProfileId: other['id']?.toString(),
                        otherPhotoUrls: photoUrls,
                        photosLocked: other['photos_locked'] == true,
                      ),
                    ),
                  );
                  if (mounted) setState(() => _key++);
                },
              );
            },
          );
        },
      ),
    );
  }
}

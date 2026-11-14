import 'package:flutter/material.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';

import '../../l10n/app_locale.dart';
import '../../services/api_client.dart';
import '../../services/notification_service.dart';
import '../../utils/formatting.dart';
import '../core/mangalam_theme.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  final _api = ApiClient();
  List<dynamic> _items = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (!mounted) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final json = await _api.get('/v1/notifications') as Map<String, dynamic>;
      if (!mounted) return;
      setState(() {
        _items = json['items'] as List<dynamic>? ?? [];
        _loading = false;
      });
      // Mark all as read on open + reset badge.
      await NotificationService.instance.markAllRead();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = userFacingError(e);
        _loading = false;
      });
    }
  }

  IconData _iconFor(String type) {
    switch (type) {
      case 'like':
        return Iconsax.heart;
      case 'match':
        return Iconsax.heart_circle;
      case 'message':
        return Iconsax.message;
      case 'shortlist':
        return Iconsax.star;
      case 'view':
        return Iconsax.eye;
      case 'verification':
        return Iconsax.shield;
      case 'support':
        return Iconsax.headphone;
      case 'report':
        return Iconsax.warning_2;
      default:
        return Iconsax.notification;
    }
  }

  Color _colorFor(String type) {
    switch (type) {
      case 'match':
        return MangalamTheme.gold;
      case 'message':
        return MangalamTheme.maroon;
      case 'like':
      case 'shortlist':
        return const Color(0xFFE53935);
      default:
        return MangalamTheme.muted;
    }
  }

  void _onTap(Map<String, dynamic> item) {
    final type = item['type'] as String? ?? 'system';
    final data = (item['data'] as Map?)?.cast<String, dynamic>() ?? {};
    openNotificationTarget(
      context,
      type: type,
      data: data,
      title: item['title'] as String?,
      body: item['body'] as String?,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(t('Notifications')),
        actions: [
          IconButton(
            onPressed: _load,
            icon: const Icon(Iconsax.refresh),
            tooltip: t('Refresh'),
          ),
        ],
      ),
      body: RefreshIndicator(
        color: MangalamTheme.maroon,
        onRefresh: _load,
        child: _loading
            ? const Center(
                child: CircularProgressIndicator(color: MangalamTheme.maroon),
              )
            : _error != null
                ? MangalamEmptyState(
                    icon: Iconsax.warning_2,
                    title: 'Could not load notifications',
                    subtitle: _error!,
                    action: FilledButton(
                      onPressed: _load,
                      child: Text(t('Retry')),
                    ),
                  )
                : _items.isEmpty
                    ? ListView(
                        children: [
                          const SizedBox(height: 120),
                          MangalamEmptyState(
                            icon: Iconsax.notification,
                            title: 'No notifications yet',
                            subtitle:
                                'Likes, matches and messages will appear here.',
                          ),
                        ],
                      )
                    : ListView.separated(
                        padding: EdgeInsets.fromLTRB(
                          8,
                          8,
                          8,
                          MediaQuery.of(context).padding.bottom + 120,
                        ),
                        itemCount: _items.length,
                        separatorBuilder: (_, __) =>
                            const Divider(height: 1, indent: 72),
                        itemBuilder: (context, i) {
                          final n = _items[i] as Map<String, dynamic>;
                          final type = n['type'] as String? ?? 'system';
                          final title = n['title'] as String? ?? '';
                          final body = n['body'] as String? ?? '';
                          final created = n['created_at'] as String?;
                          final unread = n['read_at'] == null;
                          final color = _colorFor(type);
                          return ListTile(
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 14,
                              vertical: 8,
                            ),
                            leading: Container(
                              width: 46,
                              height: 46,
                              decoration: BoxDecoration(
                                color: color.withValues(alpha: 0.12),
                                shape: BoxShape.circle,
                              ),
                              child: Icon(_iconFor(type), color: color, size: 22),
                            ),
                            title: Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    tNotice(title),
                                    style: TextStyle(
                                      fontWeight: unread
                                          ? FontWeight.w800
                                          : FontWeight.w600,
                                      fontSize: 15,
                                      color: MangalamTheme.ink,
                                    ),
                                  ),
                                ),
                                if (unread)
                                  Container(
                                    width: 9,
                                    height: 9,
                                    decoration: const BoxDecoration(
                                      color: MangalamTheme.maroon,
                                      shape: BoxShape.circle,
                                    ),
                                  ),
                              ],
                            ),
                            subtitle: body.isEmpty
                                ? null
                                : Padding(
                                    padding: const EdgeInsets.only(top: 3),
                                    child: Text(
                                      tNotice(body),
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        fontSize: 13.5,
                                        color: MangalamTheme.muted,
                                        height: 1.35,
                                      ),
                                    ),
                                  ),
                            trailing: Text(
                              formatRelativeTime(created),
                              style: const TextStyle(
                                fontSize: 11.5,
                                color: MangalamTheme.muted,
                              ),
                            ),
                            onTap: () => _onTap(n),
                          );
                        },
                      ),
      ),
    );
  }
}

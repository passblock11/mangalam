import 'package:flutter/material.dart';

import '../../services/api_client.dart';
import '../../utils/formatting.dart';
import 'chat_screen.dart';

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

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: 2, vsync: this);
    _tab.addListener(_onTab);
  }

  void _onTab() {
    if (_tab.indexIsChanging) return;
    if (!mounted) return;
    setState(() => _key++);
  }

  @override
  void dispose() {
    _tab.removeListener(_onTab);
    _tab.dispose();
    super.dispose();
  }

  String get _folder => _tab.index == 0 ? 'primary' : 'sent';

  Future<List<dynamic>> _load() async {
    final json = await _api.get('/v1/conversations', {'folder': _folder})
        as Map<String, dynamic>;
    return json['conversations'] as List<dynamic>? ?? [];
  }

  @override
  Widget build(BuildContext context) {
    final accent = Colors.green.shade700;
    return Column(
      children: [
        Material(
          color: Theme.of(context).colorScheme.surface,
          child: TabBar(
            controller: _tab,
            tabs: const [
              Tab(text: 'Primary'),
              Tab(text: 'Sent'),
            ],
          ),
        ),
        Expanded(
          child: FutureBuilder<List<dynamic>>(
            key: ValueKey('$_folder$_key'),
            future: _load(),
            builder: (context, snap) {
              if (snap.connectionState == ConnectionState.waiting) {
                return const Center(child: CircularProgressIndicator());
              }
              if (snap.hasError) {
                return Center(child: Text(snap.error.toString()));
              }
              final list = snap.data ?? [];
              if (list.isEmpty) {
                return const Center(child: Text('No conversations'));
              }
              return ListView.separated(
                itemCount: list.length,
                separatorBuilder: (_, _) => const Divider(height: 1),
                itemBuilder: (context, i) {
                  final row = list[i] as Map<String, dynamic>;
                  final id = row['id'] as String;
                  final other =
                      row['other_profile'] as Map<String, dynamic>? ?? {};
                  final name = other['display_name'] ?? 'Member';
                  final last = row['last_message'] as Map<String, dynamic>?;
                  final body = last?['body'] as String? ?? '';
                  final created = last?['created_at'] as String?;
                  return ListTile(
                    leading: CircleAvatar(
                      child: Text(_initial(name)),
                    ),
                    title: Text(name, style: const TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: Text(
                      body,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    trailing: Text(
                      formatRelativeTime(created),
                      style: TextStyle(fontSize: 12, color: accent),
                    ),
                    onTap: () async {
                      await Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => ChatScreen(
                            conversationId: id,
                            otherName: name,
                          ),
                        ),
                      );
                      setState(() => _key++);
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

String _initial(String name) {
  if (name.isEmpty) return '?';
  return name[0].toUpperCase();
}

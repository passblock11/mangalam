import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../services/api_client.dart';
import '../messages/chat_screen.dart';
import 'profile_widgets.dart';

class ProfileDetailScreen extends StatefulWidget {
  const ProfileDetailScreen({super.key, required this.profileId});

  final String profileId;

  @override
  State<ProfileDetailScreen> createState() => _ProfileDetailScreenState();
}

class _ProfileDetailScreenState extends State<ProfileDetailScreen> {
  final _api = ApiClient();
  Map<String, dynamic>? _data;
  String? _error;
  bool _loading = true;
  bool _bioExpanded = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final json = await _api.get('/v1/profiles/${widget.profileId}') as Map<String, dynamic>;
      setState(() {
        _data = json['profile'] as Map<String, dynamic>?;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _interaction(String action) async {
    try {
      await _api.post('/v1/interactions', {
        'to_profile_id': widget.profileId,
        'action': action,
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Sent: $action')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
      }
    }
  }

  Future<void> _report() async {
    final reason = await showDialog<String>(
      context: context,
      builder: (ctx) {
        final c = TextEditingController();
        return AlertDialog(
          title: const Text('Report'),
          content: TextField(
            controller: c,
            decoration: const InputDecoration(hintText: 'Reason'),
            maxLines: 3,
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, c.text.trim()),
              child: const Text('Submit'),
            ),
          ],
        );
      },
    );
    if (reason == null || reason.isEmpty) return;
    try {
      await _api.post('/v1/reports', {
        'reported_profile_id': widget.profileId,
        'reason': reason,
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Reported')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
      }
    }
  }

  Future<void> _block() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Block'),
        content: const Text('Block this profile?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Block')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await _api.post('/v1/blocks', {'blocked_id': widget.profileId});
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Blocked')));
        Navigator.of(context).pop();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
      }
    }
  }

  Future<void> _openChat() async {
    try {
      final name = _data?['display_name'] ?? 'Member';
      final res = await _api.post('/v1/conversations', {
        'other_profile_id': widget.profileId,
      }) as Map<String, dynamic>;
      final cid = res['conversation_id'] as String?;
      if (cid != null && mounted) {
        await Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => ChatScreen(
              conversationId: cid,
              otherName: name.toString(),
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Chat needs mutual match: $e')),
        );
      }
    }
  }

  Future<void> _launchWa() async {
    final phone = _data?['phone'] as String?;
    if (phone == null || phone.length < 8) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('WhatsApp: reveal or match first')),
        );
      }
      return;
    }
    final digits = phone.replaceAll(RegExp(r'\D'), '');
    final uri = Uri.parse('https://wa.me/$digits');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  Future<void> _launchTel() async {
    final phone = _data?['phone'] as String?;
    if (phone == null || phone.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Use Reveal phone in chat or connect when available')),
        );
      }
      return;
    }
    final uri = Uri.parse('tel:${phone.replaceAll(RegExp(r'\s'), '')}');
    if (await canLaunchUrl(uri)) await launchUrl(uri);
  }

  @override
  Widget build(BuildContext context) {
    final accent = Theme.of(context).colorScheme.primary;

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.black26,
        foregroundColor: Colors.white,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.of(context).pop(),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.favorite_border),
            onPressed: () => _interaction('like'),
          ),
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert),
            onSelected: (v) {
              if (v == 'report') _report();
              if (v == 'block') _block();
            },
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'report', child: Text('Report')),
              PopupMenuItem(value: 'block', child: Text('Block')),
            ],
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(_error!, textAlign: TextAlign.center),
                        FilledButton(onPressed: _load, child: const Text('Retry')),
                      ],
                    ),
                  ),
                )
              : _buildScroll(context, accent),
      bottomNavigationBar: _data == null
          ? null
          : _ContactBar(
              onPhone: _launchTel,
              onChat: _openChat,
              onWhatsApp: _launchWa,
            ),
    );
  }

  Widget _buildScroll(BuildContext context, Color accent) {
    final p = _data!;
    final name = p['display_name'] ?? 'Member';
    final age = p['age'];
    final community = p['community']?.toString() ?? '';
    final lang = p['mother_tongue']?.toString() ?? '';
    final city = p['city']?.toString() ?? '';
    final state = p['state']?.toString() ?? '';
    final bio = p['bio'] as String?;
    final verified = p['is_verified'] == true;
    final activityLabel = p['activity_label']?.toString() ?? '';

    final partner = p['partner_preferences'] is Map<String, dynamic>
        ? p['partner_preferences'] as Map<String, dynamic>
        : <String, dynamic>{};

    final gridItems = <({String label, String value})>[
      (label: 'Caste', value: community.isEmpty ? '—' : community),
      (label: 'Mother tongue', value: lang.isEmpty ? '—' : lang),
      (label: 'Diet', value: (p['diet'] ?? '—').toString()),
      (label: 'Height', value: heightHuman(p['height_cm'])),
      (label: 'Profile for?', value: (p['profile_for'] ?? '—').toString()),
      (label: 'Marital status', value: (p['marital_status'] ?? '—').toString()),
    ];

    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(
          child: Stack(
            children: [
              AspectRatio(
                aspectRatio: 1,
                child: ColoredBox(
                  color: Theme.of(context).colorScheme.surfaceContainerHighest,
                  child: Icon(Icons.person, size: 140, color: Theme.of(context).colorScheme.outline),
                ),
              ),
              Positioned(
                top: MediaQuery.paddingOf(context).top + 8,
                right: 16,
                child: IconButton.filled(
                  style: IconButton.styleFrom(backgroundColor: Colors.white70),
                  onPressed: () => _interaction('like'),
                  icon: Icon(Icons.favorite, color: accent),
                ),
              ),
            ],
          ),
        ),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
          sliver: SliverList(
            delegate: SliverChildListDelegate([
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text(
                      name,
                      style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
                    ),
                  ),
                  if (verified)
                    Padding(
                      padding: const EdgeInsets.only(left: 4, top: 4),
                      child: Icon(Icons.verified, color: Colors.green.shade700, size: 26),
                    ),
                ],
              ),
              if (activityLabel.isNotEmpty) ...[
                const SizedBox(height: 8),
                Align(
                  alignment: Alignment.centerLeft,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.green.shade50,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.circle, size: 8, color: Colors.green.shade700),
                        const SizedBox(width: 6),
                        Text(
                          activityLabel,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: Colors.green.shade800,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
              if (bio != null && bio.isNotEmpty) ...[
                const SizedBox(height: 12),
                Text(
                  _bioExpanded ? bio : _clipBio(bio, 180),
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                if (bio.length > 180)
                  TextButton(
                    onPressed: () => setState(() => _bioExpanded = !_bioExpanded),
                    child: Text(_bioExpanded ? 'Show less' : 'Show more'),
                  ),
              ],
              const SizedBox(height: 12),
              Row(
                children: [
                  Icon(Icons.place_outlined, size: 18, color: Theme.of(context).colorScheme.onSurfaceVariant),
                  const SizedBox(width: 6),
                  Expanded(child: Text('$city, $state')),
                ],
              ),
              const SizedBox(height: 4),
              Row(
                children: [
                  Icon(Icons.calendar_today_outlined, size: 18, color: Theme.of(context).colorScheme.onSurfaceVariant),
                  const SizedBox(width: 6),
                  Text(age != null ? '$age years' : '—'),
                ],
              ),
              const SizedBox(height: 20),
              DetailCardGrid(items: gridItems),
              const SizedBox(height: 20),
              SectionCard(
                icon: Icons.work_outline,
                title: 'Occupation',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    DetailPair(label: 'Occupation', value: (p['occupation'] ?? '—').toString()),
                    DetailPair(label: 'Education level', value: (p['education_level'] ?? '—').toString()),
                    DetailPair(label: 'Monthly salary', value: (p['monthly_salary'] ?? '—').toString()),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              SectionCard(
                icon: Icons.personal_video_outlined,
                title: 'Astrology',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    DetailPair(label: 'Mangal Dosh', value: (p['mangal_dosh'] ?? '—').toString()),
                    DetailPair(label: 'Date of Birth', value: formatDob(p['date_of_birth'])),
                    DetailPair(label: 'Birth time', value: formatBirthTime(p['birth_time'])),
                    DetailPair(
                      label: 'Place of birth',
                      value: (p['birth_place'] ?? '—').toString(),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              SectionCard(
                icon: Icons.favorite_border,
                title: 'Preference',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    DetailPair(
                      label: 'Age limit',
                      value:
                          '${partner['age_min']?.toString() ?? '—'} - ${partner['age_max']?.toString() ?? '—'}',
                    ),
                    DetailPair(label: 'Location', value: partnerPref(partner, 'location')),
                    DetailPair(label: 'Height', value: partnerPref(partner, 'height')),
                    DetailPair(label: 'Diet', value: partnerPref(partner, 'diet')),
                    DetailPair(label: 'Marital status', value: partnerPref(partner, 'marital_status')),
                    DetailPair(label: 'Mother tongue', value: partnerPref(partner, 'mother_tongue')),
                    DetailPair(label: 'Mangal Dosh', value: partnerPref(partner, 'mangal_dosh')),
                    DetailPair(label: 'Occupation', value: partnerPref(partner, 'occupation')),
                    DetailPair(label: 'Monthly salary', value: partnerPref(partner, 'monthly_salary')),
                    DetailPair(label: 'Education level', value: partnerPref(partner, 'education_level')),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: FilledButton(
                      onPressed: () => _interaction('like'),
                      child: const Text('Like'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => _interaction('pass'),
                      child: const Text('Pass'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: FilledButton.tonal(
                      onPressed: () => _interaction('shortlist'),
                      child: const Text('Shortlist'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: FilledButton.tonal(
                      onPressed: _openChat,
                      child: const Text('Message'),
                    ),
                  ),
                ],
              ),
            ]),
          ),
        ),
      ],
    );
  }

  String _clipBio(String s, int maxChars) {
    if (s.length <= maxChars) return s;
    return '${s.substring(0, maxChars).trim()}…';
  }
}

class _ContactBar extends StatelessWidget {
  const _ContactBar({
    required this.onPhone,
    required this.onChat,
    required this.onWhatsApp,
  });

  final VoidCallback onPhone;
  final VoidCallback onChat;
  final VoidCallback onWhatsApp;

  @override
  Widget build(BuildContext context) {
    final accent = Theme.of(context).colorScheme.primary;
    return Material(
      elevation: 8,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              RichText(
                textAlign: TextAlign.center,
                text: TextSpan(
                  style: Theme.of(context).textTheme.bodySmall,
                  children: [
                    const TextSpan(text: 'Like this Profile? '),
                    TextSpan(
                      text: 'Contact Now',
                      style: TextStyle(
                        color: accent,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  IconButton(
                    style: IconButton.styleFrom(
                      side: BorderSide(color: Theme.of(context).dividerColor),
                    ),
                    onPressed: onPhone,
                    icon: const Icon(Icons.phone_outlined),
                  ),
                  const SizedBox(width: 8),
                  IconButton(
                    style: IconButton.styleFrom(
                      side: BorderSide(color: Theme.of(context).dividerColor),
                    ),
                    onPressed: onChat,
                    icon: const Icon(Icons.chat_bubble_outline),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: FilledButton.icon(
                      style: FilledButton.styleFrom(
                        backgroundColor: accent,
                        foregroundColor: Theme.of(context).colorScheme.onPrimary,
                      ),
                      onPressed: onWhatsApp,
                      icon: const Icon(Icons.chat),
                      label: const Text('WhatsApp'),
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

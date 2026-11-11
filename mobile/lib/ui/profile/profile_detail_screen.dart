import 'package:flutter/material.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../services/api_client.dart';
import '../core/mangalam_theme.dart';
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
    if (!mounted) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final json = await _api.get('/v1/profiles/${widget.profileId}') as Map<String, dynamic>;
      if (!mounted) return;
      setState(() {
        _data = json['profile'] as Map<String, dynamic>?;
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
            builder: (_) => ChatScreen(conversationId: cid, otherName: name.toString()),
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
    final wa = _data?['whatsapp_number'] as String?;
    final phone = _data?['phone'] as String?;
    final num = (wa != null && wa.isNotEmpty) ? wa : phone;
    if (num == null || num.length < 8) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('WhatsApp number not available.')),
        );
      }
      return;
    }
    final digits = num.replaceAll(RegExp(r'\D'), '');
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
          const SnackBar(content: Text('Phone number not available.')),
        );
      }
      return;
    }
    final uri = Uri.parse('tel:${phone.replaceAll(RegExp(r'\s'), '')}');
    if (await canLaunchUrl(uri)) await launchUrl(uri);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Iconsax.arrow_left),
          onPressed: () => Navigator.of(context).pop(),
        ),
        actions: [
          IconButton(
            icon: const Icon(Iconsax.heart),
            onPressed: () => _interaction('like'),
          ),
          PopupMenuButton<String>(
            icon: const Icon(Iconsax.more),
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
          ? const Center(child: CircularProgressIndicator(color: MangalamTheme.maroon))
          : _error != null
              ? MangalamEmptyState(
                  icon: Iconsax.warning_2,
                  title: 'Could not load profile',
                  subtitle: _error,
                  action: FilledButton(onPressed: _load, child: const Text('Retry')),
                )
              : _buildScroll(context),
      bottomNavigationBar: _data == null
          ? null
          : _ContactBar(
              profile: _data!,
              onPhone: _launchTel,
              onChat: _openChat,
              onWhatsApp: _launchWa,
            ),
    );
  }

  Widget _buildScroll(BuildContext context) {
    final p = _data!;
    final name = p['display_name']?.toString() ?? 'Member';
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
      (label: 'Profile for', value: (p['profile_for'] ?? '—').toString()),
      (label: 'Marital status', value: (p['marital_status'] ?? '—').toString()),
    ];

    final photoUrls = (p['photo_urls'] as List<dynamic>?)?.cast<String>() ?? const [];

    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(
          child: Stack(
            children: [
              AspectRatio(
                aspectRatio: 0.95,
                child: ProfilePhoto(name: name, photoUrls: photoUrls),
              ),
              // Bottom scrim for app bar readability
              Positioned(
                top: 0,
                left: 0,
                right: 0,
                height: 120,
                child: Container(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        Colors.black.withValues(alpha: 0.35),
                        Colors.transparent,
                      ],
                    ),
                  ),
                ),
              ),
              Positioned(
                top: MediaQuery.paddingOf(context).top + 8,
                right: 16,
                child: FloatingActionButton.small(
                  backgroundColor: Colors.white,
                  foregroundColor: MangalamTheme.maroon,
                  onPressed: () => _interaction('like'),
                  child: const Icon(Iconsax.heart),
                ),
              ),
              if (photoUrls.isNotEmpty)
                Positioned(
                  bottom: 12,
                  right: 12,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.45),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Iconsax.gallery, color: Colors.white, size: 13),
                        const SizedBox(width: 4),
                        Text(
                          '${photoUrls.length} photo${photoUrls.length == 1 ? '' : 's'}',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
        SliverPadding(
          padding: EdgeInsets.fromLTRB(16, 16, 16, MediaQuery.of(context).padding.bottom + 132),
          sliver: SliverList(
            delegate: SliverChildListDelegate([
              // Name + verified
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text(
                      name,
                      style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.4,
                          ),
                    ),
                  ),
                  if (verified)
                    Padding(
                      padding: const EdgeInsets.only(left: 6, top: 4),
                      child: const Icon(Iconsax.verify,
                          color: MangalamTheme.gold, size: 24),
                    ),
                ],
              ),
              if (activityLabel.isNotEmpty) ...[
                const SizedBox(height: 10),
                MangalamBadge(
                  label: activityLabel,
                  icon: Iconsax.info_circle,
                  color: const Color(0xFF2E7D32),
                ),
              ],
              if (bio != null && bio.isNotEmpty) ...[
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: MangalamTheme.cream,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Icon(Iconsax.text_block, size: 16, color: MangalamTheme.maroon),
                          SizedBox(width: 6),
                          Text('About',
                              style: TextStyle(fontWeight: FontWeight.w700, color: MangalamTheme.maroon)),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _bioExpanded ? bio : _clipBio(bio, 180),
                        style: const TextStyle(height: 1.45, fontSize: 14),
                      ),
                      if (bio.length > 180)
                        TextButton(
                          onPressed: () => setState(() => _bioExpanded = !_bioExpanded),
                          child: Text(_bioExpanded ? 'Show less' : 'Show more'),
                        ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 14),
              Row(
                children: [
                  const Icon(Iconsax.location, size: 18, color: MangalamTheme.muted),
                  const SizedBox(width: 6),
                  Expanded(child: Text('$city, $state')),
                ],
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  const Icon(Iconsax.calendar, size: 18, color: MangalamTheme.muted),
                  const SizedBox(width: 6),
                  Text(age != null ? '$age years' : '—'),
                ],
              ),
              const SizedBox(height: 20),
              DetailCardGrid(items: gridItems),
              const SizedBox(height: 20),
              SectionCard(
                icon: Iconsax.briefcase,
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
                icon: Iconsax.flash,
                title: 'Astrology',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    DetailPair(label: 'Mangal Dosh', value: (p['mangal_dosh'] ?? '—').toString()),
                    DetailPair(label: 'Date of Birth', value: formatDob(p['date_of_birth'])),
                    DetailPair(label: 'Birth time', value: formatBirthTime(p['birth_time'])),
                    DetailPair(label: 'Place of birth', value: (p['birth_place'] ?? '—').toString()),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              SectionCard(
                icon: Iconsax.heart,
                title: 'Partner preference',
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
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: () => _interaction('like'),
                      icon: const Icon(Iconsax.heart),
                      label: const Text('Like'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _interaction('pass'),
                      icon: const Icon(Iconsax.close_circle),
                      label: const Text('Pass'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: FilledButton.tonalIcon(
                      onPressed: () => _interaction('shortlist'),
                      icon: const Icon(Iconsax.star),
                      label: const Text('Shortlist'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: FilledButton.tonalIcon(
                      onPressed: _openChat,
                      icon: const Icon(Iconsax.message),
                      label: const Text('Message'),
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
    required this.profile,
    required this.onPhone,
    required this.onChat,
    required this.onWhatsApp,
  });

  final Map<String, dynamic> profile;
  final VoidCallback onPhone, onChat, onWhatsApp;

  @override
  Widget build(BuildContext context) {
    final contactVisible = profile['contact_visible'] == true;
    final locked = profile['contact_locked'] == true;
    final ownerDisabled = profile['contact_owner_disabled'] == true;

    return Material(
      elevation: 12,
      color: Colors.white,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
          child: contactVisible
              ? Row(
                  children: [
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: onWhatsApp,
                        icon: const Icon(Iconsax.message),
                        label: const Text('WhatsApp'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    IconButton.outlined(
                      onPressed: onChat,
                      icon: const Icon(Iconsax.message),
                      color: MangalamTheme.maroon,
                      tooltip: 'Message',
                    ),
                    const SizedBox(width: 8),
                    IconButton.outlined(
                      onPressed: onPhone,
                      icon: const Icon(Iconsax.call),
                      color: MangalamTheme.maroon,
                      tooltip: 'Call',
                    ),
                  ],
                )
              : _lockedRow(context, locked: locked, ownerDisabled: ownerDisabled),
        ),
      ),
    );
  }

  Widget _lockedRow(BuildContext context, {required bool locked, required bool ownerDisabled}) {
    final String message;
    final IconData icon;
    final Color tint;
    if (ownerDisabled) {
      message = 'This member hasn\'t shared contact details. Chat to request.';
      icon = Iconsax.message_question;
      tint = MangalamTheme.muted;
    } else if (locked) {
      message = 'Verify your identity & upgrade to Premium to view contact details.';
      icon = Iconsax.lock;
      tint = MangalamTheme.maroon;
    } else {
      message = 'Contact details are not available right now.';
      icon = Iconsax.info_circle;
      tint = MangalamTheme.muted;
    }
    return Row(
      children: [
        Icon(icon, color: tint, size: 22),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            message,
            style: TextStyle(fontSize: 12.5, color: tint, height: 1.35, fontWeight: FontWeight.w600),
          ),
        ),
        const SizedBox(width: 8),
        FilledButton.tonalIcon(
          onPressed: onChat,
          icon: const Icon(Iconsax.message, size: 18),
          label: const Text('Chat'),
        ),
      ],
    );
  }
}

import 'package:flutter/material.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../l10n/app_locale.dart';
import '../../services/api_client.dart';
import '../core/mangalam_theme.dart';
import '../core/photo_gallery.dart';
import '../messages/chat_screen.dart';
import 'profile_widgets.dart';
import 'report_user_screen.dart';

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
  bool _liking = false;
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
      final json =
          await _api.get('/v1/profiles/${widget.profileId}')
              as Map<String, dynamic>;
      if (!mounted) return;
      setState(() {
        _data = json['profile'] as Map<String, dynamic>?;
        _loading = false;
      });
      // Record this profile view so the other person sees us in their Views
      // tab. Fire-and-forget; skip own profile and never block the UI on it.
      final me = _api.currentUserId;
      if (me != null && me != widget.profileId) {
        _api
            .post('/v1/views', {'viewed_id': widget.profileId})
            .catchError((_) {});
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = userFacingError(e);
        _loading = false;
      });
    }
  }

  Future<void> _interaction(String action) async {
    if (_liking) return;
    setState(() => _liking = true);
    try {
      final res =
          await _api.post('/v1/interactions', {
                'to_profile_id': widget.profileId,
                'action': action,
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
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(tError(e))));
    } finally {
      if (mounted) setState(() => _liking = false);
    }
  }

  Future<void> _report() async {
    final name = _data?['display_name']?.toString() ?? t('Member');
    await Navigator.of(context).push<bool>(
      MaterialPageRoute<bool>(
        builder: (_) => ReportUserScreen(
          reportedProfileId: widget.profileId,
          reportedName: name,
        ),
      ),
    );
  }

  Future<void> _block() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(t('Block')),
        content: Text(t('Block this profile?')),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(t('Cancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(t('Block')),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await _api.post('/v1/blocks', {'blocked_id': widget.profileId});
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(t('Blocked'))));
        Navigator.of(context).pop();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(tError(e))));
      }
    }
  }

  Future<void> _openChat() async {
    try {
      final name = _data?['display_name'] ?? t('Member');
      final photoUrls =
          (_data?['photo_urls'] as List<dynamic>?)?.cast<String>() ?? const [];
      final res =
          await _api.post('/v1/conversations', {
                'other_profile_id': widget.profileId,
              })
              as Map<String, dynamic>;
      final cid = res['conversation_id'] as String?;
      if (cid != null && mounted) {
        await Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => ChatScreen(
              conversationId: cid,
              otherName: name.toString(),
              otherProfileId: widget.profileId,
              otherPhotoUrls: photoUrls,
              photosLocked: _data?['photos_locked'] == true,
              contactLocked: _data?['contact_locked'] == true,
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(tError(e))));
      }
    }
  }

  Future<void> _launchWa() async {
    final num = await _numberFor('whatsapp');
    if (num == null || !mounted) return;
    final digits = num.replaceAll(RegExp(r'\D'), '');
    final uri = Uri.parse('https://wa.me/$digits');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  Future<void> _launchTel() async {
    final phone = await _numberFor('phone');
    if (phone == null || !mounted) return;
    final uri = Uri.parse('tel:${phone.replaceAll(RegExp(r'\s'), '')}');
    if (await canLaunchUrl(uri)) await launchUrl(uri);
  }

  /// Returns a number the member has shared. Spends credits the first time.
  Future<String?> _numberFor(String channel) async {
    final key = channel == 'whatsapp' ? 'whatsapp_number' : 'phone';
    final revealedKey = channel == 'whatsapp' ? 'whatsapp_revealed' : 'phone_revealed';
    final existing = _data?[key]?.toString().trim() ?? '';
    if (existing.length >= 8 && _data?[revealedKey] == true) return existing;

    final costKey = channel == 'whatsapp' ? 'whatsapp_credit_cost' : 'phone_credit_cost';
    final cost = (_data?[costKey] as num?)?.toInt() ?? 1;
    if (!mounted) return null;
    if (cost > 0) {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(t('View this number?')),
        content: Text(tf('This uses {n} contact credits.', {'n': '$cost'})),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(t('Cancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(t('View number')),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return null;
    }
    try {
      final json = await _api.post(
        '/v1/profiles/${widget.profileId}/reveal-contact',
        {'channel': channel, 'confirm': true},
      ) as Map<String, dynamic>;
      final value = json['value']?.toString().trim() ?? '';
      if (value.isEmpty) return null;
      if (mounted) {
        setState(() {
          _data?[key] = value;
          _data?[revealedKey] = true;
        });
      }
      return value;
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(tError(e))),
        );
      }
      return null;
    }
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
          PopupMenuButton<String>(
            icon: const Icon(Iconsax.more),
            onSelected: (v) {
              if (v == 'report') _report();
              if (v == 'block') _block();
            },
            itemBuilder: (_) => [
              PopupMenuItem(value: 'report', child: Text(t('Report'))),
              PopupMenuItem(value: 'block', child: Text(t('Block'))),
            ],
          ),
        ],
      ),
      body: Stack(
        children: [
          Positioned.fill(
            child: _loading
                ? const Center(
                    child: CircularProgressIndicator(
                      color: MangalamTheme.maroon,
                    ),
                  )
                : _error != null
                ? MangalamEmptyState(
                    icon: Iconsax.warning_2,
                    title: 'Could not load profile',
                    subtitle: _error,
                    action: FilledButton(
                      onPressed: _load,
                      child: Text(t('Retry')),
                    ),
                  )
                : _buildScroll(context),
          ),
          if (_liking) ...[
            const Positioned.fill(
              child: AbsorbPointer(
                child: ColoredBox(color: Color(0xA6FFF8F3)),
              ),
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
        ],
      ),
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
    final name = p['display_name']?.toString() ?? t('Member');
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

    final photoUrls =
        (p['photo_urls'] as List<dynamic>?)?.cast<String>() ?? const [];

    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(
          child: Stack(
            children: [
              PhotoGallery(
                name: name,
                photoUrls: photoUrls,
                aspectRatio: 0.95,
                badgeTopInset: MediaQuery.paddingOf(context).top + 44,
                locked: p['photos_locked'] == true,
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
            ],
          ),
        ),
        SliverPadding(
          padding: EdgeInsets.fromLTRB(
            16,
            16,
            16,
            MediaQuery.of(context).padding.bottom + 132,
          ),
          sliver: SliverList(
            delegate: SliverChildListDelegate([
              // Name + verified badge, kept together on the left
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Flexible(
                    child: Text(
                      name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.headlineSmall
                          ?.copyWith(
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.4,
                          ),
                    ),
                  ),
                  if (verified) ...[
                    const SizedBox(width: 8),
                    const VerifiedBadge(),
                  ],
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
              if ((p['phone']?.toString().trim().isNotEmpty ?? false)) ...[
                const SizedBox(height: 12),
                Text(
                  '${t('Phone')}: ${p['phone']}',
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                ),
              ],
              if ((p['whatsapp_number']?.toString().trim().isNotEmpty ?? false) &&
                  p['whatsapp_number'] != p['phone']) ...[
                const SizedBox(height: 4),
                Text(
                  '${t('WhatsApp')}: ${p['whatsapp_number']}',
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                ),
              ],
              if (bio != null && bio.isNotEmpty) ...[
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: MangalamTheme.cream,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: Theme.of(context).colorScheme.outlineVariant,
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(
                            Iconsax.text_block,
                            size: 16,
                            color: MangalamTheme.maroon,
                          ),
                          SizedBox(width: 6),
                          Text(t('About'),
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              color: MangalamTheme.maroon,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _bioExpanded ? bio : _clipBio(bio, 180),
                        style: const TextStyle(height: 1.45, fontSize: 14),
                      ),
                      if (bio.length > 180)
                        TextButton(
                          onPressed: () =>
                              setState(() => _bioExpanded = !_bioExpanded),
                          child: Text(_bioExpanded ? 'Show less' : 'Show more'),
                        ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 14),
              Row(
                children: [
                  const Icon(
                    Iconsax.location,
                    size: 18,
                    color: MangalamTheme.muted,
                  ),
                  const SizedBox(width: 6),
                  Expanded(child: Text('$city, ${t(state)}')),
                ],
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  const Icon(
                    Iconsax.calendar,
                    size: 18,
                    color: MangalamTheme.muted,
                  ),
                  const SizedBox(width: 6),
                  Text(age != null ? '$age years' : '—'),
                ],
              ),
              const SizedBox(height: 12),
              DetailCardGrid(items: gridItems),
              const SizedBox(height: 20),
              SectionCard(
                icon: Iconsax.briefcase,
                title: 'Occupation',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    DetailPair(
                      label: 'Occupation',
                      value: (p['occupation'] ?? '—').toString(),
                    ),
                    DetailPair(
                      label: 'Education level',
                      value: (p['education_level'] ?? '—').toString(),
                    ),
                    DetailPair(
                      label: 'Monthly salary',
                      value: (p['monthly_salary'] ?? '—').toString(),
                    ),
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
                    DetailPair(
                      label: 'Mangal Dosh',
                      value: (p['mangal_dosh'] ?? '—').toString(),
                    ),
                    DetailPair(
                      label: 'Date of Birth',
                      value: formatDob(p['date_of_birth']),
                    ),
                    DetailPair(
                      label: 'Birth time',
                      value: formatBirthTime(p['birth_time']),
                    ),
                    DetailPair(
                      label: 'Place of birth',
                      value: (p['birth_place'] ?? '—').toString(),
                    ),
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
                      value: partnerAgeRange(partner),
                    ),
                    DetailPair(
                      label: 'Location',
                      value: partnerPref(partner, 'location'),
                    ),
                    DetailPair(
                      label: 'Height',
                      value: partnerPref(partner, 'height'),
                    ),
                    DetailPair(
                      label: 'Diet',
                      value: partnerPref(partner, 'diet'),
                    ),
                    DetailPair(
                      label: 'Marital status',
                      value: partnerPref(partner, 'marital_status'),
                    ),
                    DetailPair(
                      label: 'Mother tongue',
                      value: partnerPref(partner, 'mother_tongue'),
                    ),
                    DetailPair(
                      label: 'Mangal Dosh',
                      value: partnerPref(partner, 'mangal_dosh'),
                    ),
                    DetailPair(
                      label: 'Occupation',
                      value: partnerPref(partner, 'occupation'),
                    ),
                    DetailPair(
                      label: 'Monthly salary',
                      value: partnerPref(partner, 'monthly_salary'),
                    ),
                    DetailPair(
                      label: 'Education level',
                      value: partnerPref(partner, 'education_level'),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: _liking ? null : () => _interaction('like'),
                      icon: const Icon(Iconsax.heart),
                      label: Text(t('Like')),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: FilledButton.tonalIcon(
                      onPressed: _openChat,
                      icon: const Icon(Iconsax.message),
                      label: Text(t('Message')),
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
    final locked = profile['contact_locked'] == true;
    final ownerDisabled = profile['contact_owner_disabled'] == true;
    final canRequest = !locked &&
        !ownerDisabled &&
        (profile['phone_available'] == true ||
            profile['whatsapp_available'] == true);

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 12,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
          // Force a FINITE max width so the inner Row (and its Expanded /
          // button children) never receive unbounded constraints from the
          // bottomNavigationBar slot during layout. Bulletproof regardless
          // of what the parent passes down.
          child: ConstrainedBox(
            constraints: BoxConstraints(
              maxWidth: MediaQuery.sizeOf(context).width,
            ),
            child: canRequest
                ? Row(
                    children: [
                      if (profile['whatsapp_available'] == true)
                        Expanded(
                          child: FilledButton.icon(
                            onPressed: onWhatsApp,
                            icon: const Icon(Iconsax.message),
                            label: Text(t('WhatsApp')),
                          ),
                        ),
                      if (profile['whatsapp_available'] == true)
                        const SizedBox(width: 10),
                      IconButton.outlined(
                        onPressed: onChat,
                        icon: const Icon(Iconsax.message),
                        color: MangalamTheme.maroon,
                        tooltip: t('Message'),
                      ),
                      if (profile['phone_available'] == true) ...[
                        const SizedBox(width: 8),
                        IconButton.outlined(
                          onPressed: onPhone,
                          icon: const Icon(Iconsax.call),
                          color: MangalamTheme.maroon,
                          tooltip: t('Call'),
                        ),
                      ],
                    ],
                  )
                : _lockedRow(
                    context,
                    locked: locked,
                    ownerDisabled: ownerDisabled,
                  ),
          ),
        ),
      ),
    );
  }

  Widget _lockedRow(
    BuildContext context, {
    required bool locked,
    required bool ownerDisabled,
  }) {
    final String message;
    final IconData icon;
    final Color tint;
    if (ownerDisabled) {
      message = 'This member hasn\'t shared contact details. Chat to request.';
      icon = Iconsax.message_question;
      tint = MangalamTheme.muted;
    } else if (locked && profile['contact_needs_verification'] == true) {
      message = 'Verify your identity to view contact details.';
      icon = Iconsax.lock;
      tint = MangalamTheme.maroon;
    } else if (locked) {
      message =
          'Verify your identity & upgrade to Premium to view contact details.';
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
            t(message),
            style: TextStyle(
              fontSize: 12.5,
              color: tint,
              height: 1.35,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        const SizedBox(width: 8),
        IconButton.outlined(
          onPressed: onChat,
          icon: const Icon(Iconsax.message, size: 20),
          color: MangalamTheme.maroon,
          tooltip: t('Chat'),
        ),
      ],
    );
  }
}

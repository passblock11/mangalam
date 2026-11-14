import 'package:flutter/material.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';

import '../../services/api_client.dart';
import '../core/mangalam_theme.dart';
import '../core/photo_gallery.dart';
import 'profile_widgets.dart';
import '../../l10n/app_locale.dart';

/// Read-only preview of how the signed-in user's profile appears to other
/// members. No contact bar, no Like/Pass/Shortlist/Message actions — just the
/// public profile card. Loaded from /v1/me (the owner's full profile).
class ProfilePreviewScreen extends StatefulWidget {
  const ProfilePreviewScreen({super.key});

  @override
  State<ProfilePreviewScreen> createState() => _ProfilePreviewScreenState();
}

class _ProfilePreviewScreenState extends State<ProfilePreviewScreen> {
  final _api = ApiClient();
  Map<String, dynamic>? _data;
  String? _error;
  bool _loading = true;

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
      final json = await _api.get('/v1/me') as Map<String, dynamic>;
      if (!mounted) return;
      setState(() {
        _data = json['profile'] as Map<String, dynamic>?;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = userFacingError(e);
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(t('Preview public profile')),
        actions: [
          IconButton(
            onPressed: _loading ? null : _load,
            icon: const Icon(Iconsax.refresh),
            tooltip: t('Refresh'),
          ),
        ],
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: MangalamTheme.maroon),
            )
          : _error != null
          ? MangalamEmptyState(
              icon: Iconsax.warning_2,
              title: 'Could not load profile',
              subtitle: _error,
              action: FilledButton.icon(
                onPressed: _load,
                icon: const Icon(Iconsax.refresh),
                label: Text(t('Retry')),
              ),
            )
          : _data == null
          ? Center(child: Text(t('No profile yet.')))
          : _buildScroll(context),
    );
  }

  Widget _buildScroll(BuildContext context) {
    final p = _data!;
    final name = p['display_name']?.toString().isNotEmpty == true
        ? p['display_name'].toString()
        : 'Your name';
    final age = p['age'] ?? _ageFromDob(p['date_of_birth']);
    final community = p['community']?.toString() ?? '';
    final lang = p['mother_tongue']?.toString() ?? '';
    final city = p['city']?.toString() ?? '';
    final state = p['state']?.toString() ?? '';
    final bio = p['bio'] as String?;
    final verified = p['is_verified'] == true;
    final prefs = p['preferences'];
    final photosShared = prefs is! Map || prefs['photos_visible'] != false;
    final photoUrls =
        (p['photo_urls'] as List<dynamic>?)?.cast<String>() ?? const [];

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
                locked: !photosShared,
              ),
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
            MediaQuery.of(context).padding.bottom + 32,
          ),
          sliver: SliverList(
            delegate: SliverChildListDelegate([
              // Preview banner
              Container(
                padding: const EdgeInsets.all(12),
                margin: const EdgeInsets.only(bottom: 14),
                decoration: BoxDecoration(
                  color: MangalamTheme.gold.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: MangalamTheme.gold.withValues(alpha: 0.3),
                  ),
                ),
                child: Row(
                  children: [
                    Icon(Iconsax.eye, size: 18, color: MangalamTheme.gold),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(t('This is how your profile looks to other members.'),
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: MangalamTheme.ink,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
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
              const SizedBox(height: 12),
              Text(
                t('Your email stays private. Your phone number is hidden unless you choose to share it.'),
                style: const TextStyle(
                  color: MangalamTheme.muted,
                  fontSize: 13,
                  height: 1.4,
                ),
              ),
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
                        bio,
                        style: const TextStyle(height: 1.45, fontSize: 14),
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
                  Expanded(
                    child: Text(
                      '$city${state.isNotEmpty ? ', ${t(state)}' : ''}',
                    ),
                  ),
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
              const SizedBox(height: 24),
              OutlinedButton.icon(
                onPressed: () => Navigator.of(context).pop(),
                icon: const Icon(Iconsax.arrow_left),
                label: Text(t('Back to my profile')),
              ),
            ]),
          ),
        ),
      ],
    );
  }

  int? _ageFromDob(dynamic raw) {
    final s = raw?.toString();
    if (s == null || s.isEmpty) return null;
    final d = DateTime.tryParse(s);
    if (d == null) return null;
    return DateTime.now().difference(d).inDays ~/ 365;
  }
}

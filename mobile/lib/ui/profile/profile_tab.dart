import 'package:flutter/material.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../services/api_client.dart';
import '../../services/oauth_sign_in.dart';
import '../../services/razorpay_checkout.dart';
import '../core/mangalam_theme.dart';
import '../core/photo_picker_section.dart';
import 'edit_profile_screen.dart';
import 'legal_screen.dart';
import 'profile_preview_screen.dart';
import 'verification_screen.dart';

class ProfileTab extends StatefulWidget {
  const ProfileTab({super.key});

  @override
  State<ProfileTab> createState() => _ProfileTabState();
}

class _ProfileTabState extends State<ProfileTab> {
  final _api = ApiClient();
  final _razorpay = RazorpayCheckout();
  Map<String, dynamic>? _profile;
  Map<String, dynamic>? _wallet;
  Map<String, dynamic>? _appSettings;
  String? _error;
  bool _loading = true;
  bool _savingPhotos = false;

  String? get _supportEmail => _appSettings?['support_email'] as String?;
  String? get _supportPhone => _appSettings?['support_phone'] as String?;
  String? get _supportWhatsapp => _appSettings?['support_whatsapp'] as String?;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _razorpay.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final results = await Future.wait([
        _api.get('/v1/me'),
        _api.get('/v1/config').catchError((_) => null),
      ]);
      final json = results[0] as Map<String, dynamic>;
      final cfg = results[1] as Map<String, dynamic>?;
      if (!mounted) return;
      setState(() {
        _profile = json['profile'] as Map<String, dynamic>?;
        _wallet = json['wallet'] as Map<String, dynamic>?;
        _appSettings = cfg?['settings'] as Map<String, dynamic>?;
        _error = null;
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

  Future<void> _openSupport() async {
    final email = _supportEmail;
    final phone = _supportPhone;
    final wa = _supportWhatsapp;
    final choice = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Contact support',
                style: Theme.of(
                  ctx,
                ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 12),
              if (wa != null && wa.isNotEmpty)
                OutlinedButton.icon(
                  onPressed: () => Navigator.pop(ctx, 'whatsapp'),
                  icon: const Icon(Iconsax.message),
                  label: Text('WhatsApp: $wa'),
                ),
              if (email != null && email.isNotEmpty) ...[
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  onPressed: () => Navigator.pop(ctx, 'email'),
                  icon: const Icon(Iconsax.sms),
                  label: Text('Email: $email'),
                ),
              ],
              if (phone != null && phone.isNotEmpty) ...[
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  onPressed: () => Navigator.pop(ctx, 'call'),
                  icon: const Icon(Iconsax.call),
                  label: Text('Call: $phone'),
                ),
              ],
              if ((email == null || email.isEmpty) &&
                  (phone == null || phone.isEmpty) &&
                  (wa == null || wa.isEmpty)) ...[
                const SizedBox(height: 8),
                const Text(
                  'Support contact not configured yet. Please try again later.',
                  style: TextStyle(color: MangalamTheme.muted, fontSize: 13),
                ),
              ],
            ],
          ),
        ),
      ),
    );
    if (choice == null || !mounted) return;
    final uri = switch (choice) {
      'whatsapp' => Uri.parse(
        'https://wa.me/${wa!.replaceAll(RegExp(r'\D'), '')}',
      ),
      'email' => Uri.parse('mailto:$email'),
      'call' => Uri.parse('tel:${phone!.replaceAll(RegExp(r'\s'), '')}'),
      _ => null,
    };
    if (uri != null) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  Future<void> _changeLanguage() async {
    final langs = ['en', 'hi', 'mr', 'ta', 'te', 'kn', 'bn', 'gu', 'pa'];
    final current = _profile?['app_language']?.toString() ?? 'en';
    final choice = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'App language',
                style: Theme.of(
                  ctx,
                ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 12),
              ...langs.map((code) {
                return RadioListTile<String>(
                  value: code,
                  groupValue: current,
                  title: Text(code.toUpperCase()),
                  onChanged: (v) => Navigator.pop(ctx, v),
                );
              }),
            ],
          ),
        ),
      ),
    );
    if (choice == null || choice == current || !mounted) return;
    try {
      await _api.patch('/v1/me', {'app_language': choice});
      if (!mounted) return;
      setState(() => _profile?['app_language'] = choice);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Language set to ${choice.toUpperCase()}')),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(e.toString())));
      }
    }
  }

  Future<void> _savePhotos(List<String> urls) async {
    if (!mounted) return;
    setState(() => _savingPhotos = true);
    try {
      await _api.patch('/v1/me', {'photo_urls': urls});
      if (!mounted) return;
      setState(() => _profile?['photo_urls'] = urls);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Photos updated')));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(e.toString())));
      }
    } finally {
      if (mounted) setState(() => _savingPhotos = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = Supabase.instance.client.auth.currentUser;
    final email = user?.email ?? '';

    final community = _profile?['community']?.toString() ?? '';
    final lang = _profile?['mother_tongue']?.toString() ?? '';
    final city = _profile?['city']?.toString() ?? '';
    final state = _profile?['state']?.toString() ?? '';
    final diet = _profile?['diet']?.toString() ?? '';
    final occupation = _profile?['occupation']?.toString() ?? '';
    final verified = _profile?['is_verified'] == true;
    final photoUrls =
        (_profile?['photo_urls'] as List<dynamic>?)?.cast<String>() ?? const [];

    int? age;
    final dob = _profile?['date_of_birth']?.toString();
    if (dob != null && dob.isNotEmpty) {
      final d = DateTime.tryParse(dob);
      if (d != null) {
        age = DateTime.now().difference(d).inDays ~/ 365;
      }
    }

    final name = _profile?['display_name']?.toString() ?? 'Your name';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile'),
        actions: [
          IconButton(
            onPressed: () => OAuthSignIn.signOutCompletely(),
            icon: const Icon(Iconsax.logout),
            tooltip: 'Sign out',
          ),
        ],
      ),
      body: _loading && _profile == null && _error == null
          ? const Center(
              child: CircularProgressIndicator(color: MangalamTheme.maroon),
            )
          : _error != null && _profile == null
          ? MangalamEmptyState(
              icon: Iconsax.warning_2,
              title: 'Could not load profile',
              subtitle: _error,
              action: FilledButton.icon(
                onPressed: _load,
                icon: const Icon(Iconsax.refresh),
                label: const Text('Retry'),
              ),
            )
          : RefreshIndicator(
              color: MangalamTheme.maroon,
              onRefresh: _load,
              child: ListView(
                padding: EdgeInsets.fromLTRB(
                  20,
                  8,
                  20,
                  MediaQuery.of(context).padding.bottom + 132,
                ),
                children: [
                  // ── Hero photo + name ──
                  Center(
                    child: SizedBox(
                      width: 132,
                      height: 132,
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(66),
                            child: ProfilePhoto(
                              name: name,
                              photoUrls: photoUrls,
                            ),
                          ),
                          if (verified)
                            Positioned(
                              bottom: 2,
                              right: 2,
                              child: Container(
                                padding: const EdgeInsets.all(4),
                                decoration: const BoxDecoration(
                                  color: MangalamTheme.gold,
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(
                                  Iconsax.verify,
                                  color: Colors.white,
                                  size: 16,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  Text(
                    name,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.3,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    email,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: MangalamTheme.muted,
                      fontSize: 13,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    alignment: WrapAlignment.center,
                    children: [
                      if (age != null) _pill(Iconsax.cake, '$age yrs'),
                      if (community.isNotEmpty)
                        _pill(Iconsax.profile_2user, community),
                      if (lang.isNotEmpty) _pill(Iconsax.translate, lang),
                      if (diet.isNotEmpty) _pill(Iconsax.cup, diet),
                    ],
                  ),
                  if (city.isNotEmpty || state.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 10),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(
                            Iconsax.location,
                            size: 16,
                            color: MangalamTheme.muted,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            '$city, $state',
                            style: const TextStyle(
                              color: MangalamTheme.muted,
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ),
                    ),
                  if (occupation.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(
                            Iconsax.briefcase,
                            size: 16,
                            color: MangalamTheme.muted,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            occupation,
                            style: const TextStyle(
                              color: MangalamTheme.muted,
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ),
                    ),
                  const SizedBox(height: 20),
                  FilledButton.icon(
                    onPressed: () async {
                      final ok = await Navigator.of(context).push<bool>(
                        MaterialPageRoute(
                          builder: (_) => const EditProfileScreen(),
                        ),
                      );
                      if (ok == true && mounted) await _load();
                    },
                    icon: const Icon(Iconsax.edit),
                    label: const Text('Edit profile'),
                  ),
                  const SizedBox(height: 12),
                  _VerificationCard(
                    status: _profile?['verification_status']?.toString(),
                    note: _profile?['verification_note']?.toString(),
                    onChanged: _load,
                  ),
                  const SizedBox(height: 24),

                  // ── Photos section ──
                  MangalamSectionHeader(
                    title: 'Your photos',
                    icon: Iconsax.camera,
                  ),
                  const SizedBox(height: 12),
                  PhotoPickerSection(
                    photoUrls: photoUrls,
                    onChanged: _savePhotos,
                  ),
                  if (_savingPhotos) const SizedBox(height: 8),
                  const SizedBox(height: 24),

                  // ── Menu card ──
                  MangalamCard(
                    padding: EdgeInsets.zero,
                    child: Column(
                      children: [
                        _MenuTile(
                          icon: Iconsax.document_text,
                          title: 'Premium biodata',
                          subtitle: 'Export PDF (coming soon)',
                          trailing: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: MangalamTheme.gold.withValues(alpha: 0.18),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Text(
                              'FREE',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                color: MangalamTheme.gold,
                              ),
                            ),
                          ),
                          onTap: () {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text(
                                  'Biodata PDF export is coming soon',
                                ),
                              ),
                            );
                          },
                        ),
                        const Divider(height: 1, indent: 16),
                        _MenuTile(
                          icon: Iconsax.eye,
                          title: 'Preview public profile',
                          subtitle: 'See how others view your profile',
                          onTap: () => Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => const ProfilePreviewScreen(),
                            ),
                          ),
                        ),
                        const Divider(height: 1, indent: 16),
                        _MenuTile(
                          icon: Iconsax.info_circle,
                          title: 'Get help & support',
                          subtitle:
                              _supportEmail ??
                              _supportPhone ??
                              'Contact our team',
                          onTap: _openSupport,
                        ),
                        const Divider(height: 1, indent: 16),
                        _MenuTile(
                          icon: Iconsax.global,
                          title: 'App language',
                          trailing: Text(
                            _profile?['app_language']?.toString() ?? 'en',
                            style: const TextStyle(color: MangalamTheme.muted),
                          ),
                          onTap: _changeLanguage,
                        ),
                        const Divider(height: 1, indent: 16),
                        _MenuTile(
                          icon: Iconsax.setting,
                          title: 'Account settings',
                          onTap: () async {
                            final ok = await Navigator.of(context).push<bool>(
                              MaterialPageRoute(
                                builder: (_) => const EditProfileScreen(),
                              ),
                            );
                            if (ok == true && mounted) await _load();
                          },
                        ),
                        const Divider(height: 1, indent: 16),
                        _MenuTile(
                          icon: Iconsax.shield,
                          title: 'Privacy Policy',
                          onTap: () => Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => LegalScreen(
                                slug: 'privacy',
                                title: 'Privacy Policy',
                              ),
                            ),
                          ),
                        ),
                        const Divider(height: 1, indent: 16),
                        _MenuTile(
                          icon: Iconsax.document_text,
                          title: 'Terms of Service',
                          onTap: () => Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => LegalScreen(
                                slug: 'terms',
                                title: 'Terms of Service',
                              ),
                            ),
                          ),
                        ),
                        const Divider(height: 1, indent: 16),
                        _MenuTile(
                          icon: Iconsax.refresh_circle,
                          title: 'Refund & Cancellation',
                          onTap: () => Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => LegalScreen(
                                slug: 'refund',
                                title: 'Refund & Cancellation',
                              ),
                            ),
                          ),
                        ),
                        const Divider(height: 1, indent: 16),
                        _MenuTile(
                          icon: Iconsax.info_circle,
                          title: 'About Mangalam',
                          onTap: () => Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => LegalScreen(
                                slug: 'about',
                                title: 'About Mangalam',
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // ── Premium card ──
                  Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(20),
                      gradient: const LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [Color(0xFFFFF8E1), Color(0xFFFFE9B0)],
                      ),
                      border: Border.all(
                        color: MangalamTheme.gold.withValues(alpha: 0.4),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Row(
                          children: [
                            const Expanded(
                              child: Text(
                                'Premium',
                                style: TextStyle(
                                  fontWeight: FontWeight.w800,
                                  fontSize: 18,
                                ),
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.all(6),
                              decoration: const BoxDecoration(
                                color: MangalamTheme.gold,
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(
                                Iconsax.crown,
                                color: Colors.white,
                                size: 22,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        const Text(
                          'Unlock unlimited contacts, advanced filters & more.',
                          style: TextStyle(
                            color: MangalamTheme.muted,
                            fontSize: 13,
                            height: 1.4,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            const Icon(
                              Iconsax.wallet,
                              size: 18,
                              color: MangalamTheme.maroon,
                            ),
                            const SizedBox(width: 6),
                            Text(
                              'Contact balance: ${_wallet?['contact_credits'] ?? '—'}',
                              style: const TextStyle(
                                color: MangalamTheme.maroon,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        FilledButton.icon(
                          onPressed: () async {
                            final ok = await _razorpay.rechargeContactCredits(
                              context,
                            );
                            if (ok && mounted) await _load();
                          },
                          icon: const Icon(Iconsax.flash),
                          label: const Text('Recharge now'),
                        ),
                        if (_wallet?['premium_until'] != null) ...[
                          const SizedBox(height: 8),
                          Text(
                            'Valid till ${_wallet!['premium_until']}',
                            style: const TextStyle(
                              fontSize: 12,
                              color: MangalamTheme.muted,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _pill(IconData icon, String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: MangalamTheme.maroon.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: MangalamTheme.maroon),
          const SizedBox(width: 4),
          Text(
            text,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: MangalamTheme.maroon,
            ),
          ),
        ],
      ),
    );
  }
}

class _MenuTile extends StatelessWidget {
  const _MenuTile({
    required this.icon,
    required this.title,
    this.subtitle,
    this.trailing,
    this.onTap,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final Widget? trailing;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.all(Radius.circular(8)),
      ),
      leading: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: MangalamTheme.maroon.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(icon, size: 20, color: MangalamTheme.maroon),
      ),
      title: Text(
        title,
        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
      ),
      subtitle: subtitle != null
          ? Text(
              subtitle!,
              style: const TextStyle(
                fontSize: 12.5,
                color: MangalamTheme.muted,
              ),
            )
          : null,
      trailing:
          trailing ??
          const Icon(Iconsax.arrow_right, color: MangalamTheme.muted),
      onTap: onTap,
    );
  }
}

class _VerificationCard extends StatelessWidget {
  const _VerificationCard({
    required this.status,
    required this.note,
    required this.onChanged,
  });

  final String? status;
  final String? note;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final s = (status ?? 'none').toLowerCase();
    final isVerified = s == 'approved';
    final isPending = s == 'pending';
    final isRejected = s == 'rejected';

    final Color tint;
    final String title;
    final String subtitle;
    final IconData icon;
    if (isVerified) {
      tint = const Color(0xFF2E7D32);
      title = 'Verified';
      subtitle = 'Your identity has been confirmed.';
      icon = Iconsax.verify;
    } else if (isPending) {
      tint = MangalamTheme.gold;
      title = 'Verification in review';
      subtitle = 'Our team is checking your documents.';
      icon = Iconsax.clock;
    } else if (isRejected) {
      tint = MangalamTheme.maroon;
      title = 'Verification rejected';
      subtitle = note?.isNotEmpty == true
          ? note!
          : 'Please re-submit clear photos.';
      icon = Iconsax.warning_2;
    } else {
      tint = MangalamTheme.maroon;
      title = 'Get verified';
      subtitle = 'Required to view other members\' contact details.';
      icon = Iconsax.shield;
    }

    return InkWell(
      borderRadius: BorderRadius.circular(18),
      onTap: () async {
        await Navigator.of(
          context,
        ).push(MaterialPageRoute(builder: (_) => const VerificationScreen()));
        onChanged();
      },
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: tint.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: tint.withValues(alpha: 0.3)),
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: tint.withValues(alpha: 0.18),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: tint, size: 22),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 15,
                      color: tint,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: const TextStyle(
                      fontSize: 12.5,
                      color: MangalamTheme.muted,
                      height: 1.35,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(
              Iconsax.arrow_right,
              color: MangalamTheme.muted,
              size: 20,
            ),
          ],
        ),
      ),
    );
  }
}

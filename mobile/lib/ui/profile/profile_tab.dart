import 'package:flutter/material.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../services/api_client.dart';
import '../../services/oauth_sign_in.dart';
import '../../services/razorpay_checkout.dart';
import '../core/mangalam_theme.dart';
import '../core/photo_picker_section.dart';
import 'edit_profile_screen.dart';

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
  String? _error;
  bool _savingPhotos = false;

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
      final json = await _api.get('/v1/me') as Map<String, dynamic>;
      if (!mounted) return;
      setState(() {
        _profile = json['profile'] as Map<String, dynamic>?;
        _wallet = json['wallet'] as Map<String, dynamic>?;
        _error = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    }
  }

  Future<void> _savePhotos(List<String> urls) async {
    if (!mounted) return;
    setState(() => _savingPhotos = true);
    try {
      await _api.patch('/v1/me', {'photo_urls': urls});
      if (!mounted) return;
      setState(() => _profile?['photo_urls'] = urls);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Photos updated')),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
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
      body: _error != null
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
          : ListView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
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
                          child: ProfilePhoto(name: name, photoUrls: photoUrls),
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
                              child: const Icon(Iconsax.verify,
                                  color: Colors.white, size: 16),
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
                  style: const TextStyle(color: MangalamTheme.muted, fontSize: 13),
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  alignment: WrapAlignment.center,
                  children: [
                    if (age != null) _pill(Iconsax.cake, '$age yrs'),
                    if (community.isNotEmpty) _pill(Iconsax.profile_2user, community),
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
                        const Icon(Iconsax.location, size: 16, color: MangalamTheme.muted),
                        const SizedBox(width: 4),
                        Text(
                          '$city, $state',
                          style: const TextStyle(color: MangalamTheme.muted, fontSize: 13),
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
                        const Icon(Iconsax.briefcase, size: 16, color: MangalamTheme.muted),
                        const SizedBox(width: 4),
                        Text(
                          occupation,
                          style: const TextStyle(color: MangalamTheme.muted, fontSize: 13),
                        ),
                      ],
                    ),
                  ),
                const SizedBox(height: 20),
                FilledButton.icon(
                  onPressed: () async {
                    final ok = await Navigator.of(context).push<bool>(
                      MaterialPageRoute(builder: (_) => const EditProfileScreen()),
                    );
                    if (ok == true && mounted) await _load();
                  },
                  icon: const Icon(Iconsax.edit),
                  label: const Text('Edit profile'),
                ),
                const SizedBox(height: 24),

                // ── Photos section ──
                MangalamSectionHeader(title: 'Your photos', icon: Iconsax.camera),
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
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
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
                      ),
                      const Divider(height: 1, indent: 16),
                      _MenuTile(icon: Iconsax.info_circle, title: 'Get help'),
                      const Divider(height: 1, indent: 16),
                      _MenuTile(
                        icon: Iconsax.global,
                        title: 'App language',
                        trailing: Text(
                          _profile?['app_language']?.toString() ?? 'en',
                          style: const TextStyle(color: MangalamTheme.muted),
                        ),
                      ),
                      const Divider(height: 1, indent: 16),
                      _MenuTile(icon: Iconsax.setting, title: 'Account settings'),
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
                    border: Border.all(color: MangalamTheme.gold.withValues(alpha: 0.4)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        children: [
                          const Expanded(
                            child: Text(
                              'Premium',
                              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.all(6),
                            decoration: const BoxDecoration(
                              color: MangalamTheme.gold,
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Iconsax.crown, color: Colors.white, size: 22),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      const Text(
                        'Unlock unlimited contacts, advanced filters & more.',
                        style: TextStyle(color: MangalamTheme.muted, fontSize: 13, height: 1.4),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          const Icon(Iconsax.wallet, size: 18, color: MangalamTheme.maroon),
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
                          final ok = await _razorpay.rechargeContactCredits(context);
                          if (ok && mounted) await _load();
                        },
                        icon: const Icon(Iconsax.flash),
                        label: const Text('Recharge now'),
                      ),
                      if (_wallet?['premium_until'] != null) ...[
                        const SizedBox(height: 8),
                        Text(
                          'Valid till ${_wallet!['premium_until']}',
                          style: const TextStyle(fontSize: 12, color: MangalamTheme.muted),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
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
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(8))),
      leading: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: MangalamTheme.maroon.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(icon, size: 20, color: MangalamTheme.maroon),
      ),
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
      subtitle: subtitle != null
          ? Text(subtitle!, style: const TextStyle(fontSize: 12.5, color: MangalamTheme.muted))
          : null,
      trailing: trailing ?? const Icon(Iconsax.arrow_right, color: MangalamTheme.muted),
      onTap: onTap,
    );
  }
}

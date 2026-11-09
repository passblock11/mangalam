import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../services/api_client.dart';
import '../../services/razorpay_checkout.dart';
import 'edit_profile_screen.dart';

class ProfileTab extends StatefulWidget {
  const ProfileTab({super.key});

  @override
  State<ProfileTab> createState() => _ProfileTabState();
}

String _initial(String? name) {
  if (name == null || name.isEmpty) return '?';
  return name[0].toUpperCase();
}

class _ProfileTabState extends State<ProfileTab> {
  final _api = ApiClient();
  final _razorpay = RazorpayCheckout();
  Map<String, dynamic>? _profile;
  Map<String, dynamic>? _wallet;
  String? _error;

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
      setState(() {
        _profile = json['profile'] as Map<String, dynamic>?;
        _wallet = json['wallet'] as Map<String, dynamic>?;
        _error = null;
      });
    } catch (e) {
      setState(() => _error = e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = Supabase.instance.client.auth.currentUser;
    final cs = Theme.of(context).colorScheme;

    final community = _profile?['community'] ?? '';
    final lang = _profile?['mother_tongue'] ?? '';
    final city = _profile?['city'] ?? '';
    final state = _profile?['state'] ?? '';
    int? age;
    final dob = _profile?['date_of_birth']?.toString();
    if (dob != null && dob.isNotEmpty) {
      final d = DateTime.tryParse(dob);
      if (d != null) {
        age = DateTime.now().difference(d).inDays ~/ 365;
      }
    }

    return CustomScrollView(
      slivers: [
        SliverAppBar.large(
          title: const Text('Profile'),
          actions: [
            IconButton(
              onPressed: () => Supabase.instance.client.auth.signOut(),
              icon: const Icon(Icons.logout),
              tooltip: 'Sign out',
            ),
          ],
        ),
        if (_error != null)
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                _error!,
                style: TextStyle(color: cs.error),
              ),
            ),
          ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Column(
              children: [
                CircleAvatar(
                  radius: 48,
                  child: Text(_initial(_profile?['display_name']?.toString())),
                ),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      _profile?['display_name']?.toString() ?? 'Your name',
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    if (_profile?['is_verified'] == true) ...[
                      const SizedBox(width: 6),
                      Icon(Icons.verified, color: Colors.green.shade700),
                    ],
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  user?.phone ?? '',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: cs.onSurfaceVariant,
                      ),
                ),
                if (age != null || community.toString().isNotEmpty || lang.toString().isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(
                      [
                        if (age != null) '$age years',
                        if (community.toString().isNotEmpty) community,
                        if (lang.toString().isNotEmpty) lang,
                      ].join(' · '),
                      textAlign: TextAlign.center,
                    ),
                  ),
                if (city.toString().isNotEmpty || state.toString().isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      '$city, $state',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: cs.onSurfaceVariant),
                    ),
                  ),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton(
                    onPressed: () async {
                      final ok = await Navigator.of(context).push<bool>(
                        MaterialPageRoute(builder: (_) => const EditProfileScreen()),
                      );
                      if (ok == true) await _load();
                    },
                    child: const Text('Update profile'),
                  ),
                ),
                const SizedBox(height: 16),
                Card(
                  child: Column(
                    children: [
                      ListTile(
                        leading: const Icon(Icons.description_outlined),
                        title: const Text('Premium biodata'),
                        subtitle: const Text('Export PDF (coming soon)'),
                        trailing: Chip(
                          label: const Text('FREE'),
                          visualDensity: VisualDensity.compact,
                          backgroundColor: cs.errorContainer.withAlpha(80),
                        ),
                        onTap: () {},
                      ),
                      const Divider(height: 1),
                      ListTile(
                        leading: const Icon(Icons.help_outline),
                        title: const Text('Get help'),
                        onTap: () {},
                      ),
                      const Divider(height: 1),
                      ListTile(
                        leading: const Icon(Icons.language),
                        title: const Text('App language'),
                        subtitle: Text(_profile?['app_language']?.toString() ?? 'en'),
                        onTap: () {},
                      ),
                      const Divider(height: 1),
                      ListTile(
                        leading: const Icon(Icons.settings_outlined),
                        title: const Text('Account settings'),
                        onTap: () {},
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                Card(
                  color: const Color(0xFFFFF8E1),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Row(
                          children: [
                            const Expanded(
                              child: Text(
                                'Premium',
                                style: TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 18,
                                ),
                              ),
                            ),
                            Icon(Icons.workspace_premium, color: cs.primary),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Contact balance: ${_wallet?['contact_credits'] ?? '—'}',
                          style: TextStyle(
                            color: cs.error,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 12),
                        FilledButton(
                          onPressed: () async {
                            final ok = await _razorpay.rechargeContactCredits(context);
                            if (ok && mounted) await _load();
                          },
                          child: const Text('Recharge now'),
                        ),
                        if (_wallet?['premium_until'] != null) ...[
                          const SizedBox(height: 8),
                          Text(
                            'Valid till ${_wallet!['premium_until']}',
                            style: TextStyle(
                              fontSize: 12,
                              color: cs.onSurfaceVariant,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                TextButton.icon(
                  onPressed: _load,
                  icon: const Icon(Icons.refresh),
                  label: const Text('Refresh'),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

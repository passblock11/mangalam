import 'package:flutter/material.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';

import '../../l10n/app_locale.dart';
import '../../services/api_client.dart';
import '../../services/razorpay_checkout.dart';
import '../core/mangalam_theme.dart';
import 'sign_out_flow.dart';

/// Asks for a membership once, at the end of registration.
/// Returns true when the account may enter the app.
Future<bool> offerRegistrationMembership({
  required BuildContext context,
  required ApiClient api,
  required RazorpayCheckout checkout,
}) async {
  if (!context.mounted) return false;
  if (await femaleMembershipIsWaived(api)) return true;
  if (await membershipIsActive(api)) {
    await _clearPending(api);
    return true;
  }
  if (!context.mounted) return false;
  final paid = await checkout.buyMembership(context);
  if (!context.mounted) return false;
  if (paid || await membershipIsActive(api)) {
    await _clearPending(api);
    return true;
  }
  if (!await _membershipPlansExist(api)) {
    await _clearPending(api);
    return true;
  }
  return false;
}

/// Women skip membership only while the admin switch is on.
/// Profile, photos, verification, and contact rules still apply.
Future<bool> femaleMembershipIsWaived(ApiClient api) async {
  try {
    final me = await api.get('/v1/me') as Map<String, dynamic>;
    final profile = me['profile'];
    if (profile is! Map) return false;
    if (profile['gender']?.toString().toLowerCase() != 'female') return false;
    return await femaleMembershipWaiverEnabled(api) == true;
  } catch (_) {
    return false;
  }
}

/// True when women are free, false when the admin has turned that off,
/// and null when the switch is not on the server yet.
Future<bool?> femaleMembershipWaiverEnabled(ApiClient api) async {
  try {
    final config = await api.get('/v1/config') as Map<String, dynamic>;
    final settings = config['settings'];
    if (settings is! Map || !settings.containsKey('female_membership_free')) {
      return null;
    }
    return settings['female_membership_free'] == true;
  } catch (_) {
    return null;
  }
}

Future<bool> membershipIsActive(ApiClient api) async {
  try {
    final json = await api.get('/v1/payments/membership') as Map<String, dynamic>;
    final until = DateTime.tryParse(json['premium_until']?.toString() ?? '');
    if (until != null && until.isAfter(DateTime.now())) return true;
    final sub = json['subscription'];
    if (sub is Map) {
      final status = sub['status']?.toString() ?? '';
      return status == 'active' || status == 'authenticated';
    }
  } catch (_) {}
  return false;
}

Future<bool> _membershipPlansExist(ApiClient api) async {
  try {
    final res = await api.get('/v1/config/plans') as Map<String, dynamic>;
    final plans = res['plans'];
    if (plans is! List) return false;
    for (final item in plans) {
      if (item is! Map) continue;
      final type = item['plan_type']?.toString();
      if (type == 'subscription' || type == 'one_time') return true;
    }
    return false;
  } catch (_) {
    return true;
  }
}

Future<void> _clearPending(ApiClient api) async {
  try {
    await api.patch('/v1/me', {
      'preferences': {'membership_pending': false},
    });
  } catch (_) {}
}

bool membershipIsPending(Map<String, dynamic>? profile) {
  final prefs = profile?['preferences'];
  if (prefs is! Map) return false;
  return prefs['membership_pending'] == true;
}

/// Shown only when registration was saved but the membership was not chosen yet.
class RegistrationMembershipScreen extends StatefulWidget {
  const RegistrationMembershipScreen({super.key, required this.onFinished});

  final VoidCallback onFinished;

  @override
  State<RegistrationMembershipScreen> createState() =>
      _RegistrationMembershipScreenState();
}

class _RegistrationMembershipScreenState extends State<RegistrationMembershipScreen> {
  final _api = ApiClient();
  final _checkout = RazorpayCheckout();
  bool _busy = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _resumeIfAlreadySettled();
  }

  @override
  void dispose() {
    _checkout.dispose();
    super.dispose();
  }

  Future<void> _resumeIfAlreadySettled() async {
    final settled = await femaleMembershipIsWaived(_api) ||
        await membershipIsActive(_api) ||
        !await _membershipPlansExist(_api);
    if (!mounted) return;
    if (!settled) {
      setState(() => _busy = false);
      return;
    }
    await _clearPending(_api);
    if (mounted) widget.onFinished();
  }

  Future<void> _choose() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final ok = await offerRegistrationMembership(
      context: context,
      api: _api,
      checkout: _checkout,
    );
    if (!mounted) return;
    if (ok) {
      widget.onFinished();
      return;
    }
    setState(() {
      _busy = false;
      _error = 'Choose a membership to finish registration.';
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: MangalamTheme.cream,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 24, 24, 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Spacer(),
              Center(
                child: Container(
                  width: 84,
                  height: 84,
                  decoration: const BoxDecoration(
                    color: MangalamTheme.gold,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Iconsax.crown, color: Colors.white, size: 40),
                ),
              ),
              const SizedBox(height: 22),
              Text(
                t('Choose membership'),
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.w800,
                  color: MangalamTheme.ink,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                t('Pick a membership to finish creating your account. It renews by UPI or card, and you can cancel later from Membership.'),
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: MangalamTheme.muted,
                  fontSize: 15,
                  height: 1.4,
                ),
              ),
              if (_error != null) ...[
                const SizedBox(height: 16),
                Text(
                  t(_error!),
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: MangalamTheme.maroon, fontSize: 13),
                ),
              ],
              const Spacer(),
              FilledButton.icon(
                onPressed: _busy ? null : _choose,
                icon: _busy
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Icon(Iconsax.crown),
                label: Text(t('Choose membership')),
              ),
              const SizedBox(height: 8),
              TextButton(
                onPressed: _busy ? null : () => confirmAndSignOut(context),
                child: Text(t('Sign out')),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../services/api_client.dart'
    show ApiClient, ApiException, BannedException;
import '../core/mangalam_theme.dart';
import '../home/home_shell.dart';
import 'login_screen.dart';
import 'onboarding_screen.dart';

/// Routes: login → onboarding (if profile incomplete) → home.
class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  final _api = ApiClient();
  bool _checking = false;
  bool? _needsOnboarding;
  String? _banReason;
  bool _banned = false;

  @override
  void initState() {
    super.initState();
    Supabase.instance.client.auth.onAuthStateChange.listen((_) {
      if (!mounted) return;
      _needsOnboarding = null;
      _banned = false;
      _banReason = null;
      _evaluate();
    });
    _evaluate();
  }

  Future<void> _evaluate() async {
    final session = Supabase.instance.client.auth.currentSession;
    if (session == null) {
      if (mounted) setState(() => _needsOnboarding = null);
      return;
    }
    if (_checking) return;
    setState(() => _checking = true);
    try {
      final json = await _api.get('/v1/me') as Map<String, dynamic>;
      final p = json['profile'] as Map<String, dynamic>?;
      final needs = p == null || !_profileReady(p);
      if (mounted) setState(() => _needsOnboarding = needs);
    } on BannedException catch (e) {
      // User is banned — sign them out and show the ban screen.
      await Supabase.instance.client.auth.signOut();
      if (mounted) {
        setState(() {
          _banned = true;
          _banReason = e.reason;
        });
      }
    } on ApiException catch (e) {
      if (e.statusCode == 401 && mounted) {
        await Supabase.instance.client.auth.signOut();
      }
      if (mounted) setState(() => _needsOnboarding = true);
    } catch (_) {
      if (mounted) setState(() => _needsOnboarding = true);
    } finally {
      if (mounted) setState(() => _checking = false);
    }
  }

  static bool _profileReady(Map<String, dynamic> p) {
    final name = (p['display_name'] as String?)?.trim();
    final gender = p['gender'] as String?;
    final dob = p['date_of_birth'] as String?;
    final city = (p['city'] as String?)?.trim();
    final religion = p['religion'] as String?;
    final tongue = p['mother_tongue'] as String?;
    final diet = p['diet'] as String?;
    final marital = p['marital_status'] as String?;
    final profileFor = p['profile_for'] as String?;
    final photos = p['photo_urls'];
    final hasPhotos = photos is List && photos.isNotEmpty;
    return name != null &&
        name.isNotEmpty &&
        gender != null &&
        gender.isNotEmpty &&
        dob != null &&
        dob.isNotEmpty &&
        city != null &&
        city.isNotEmpty &&
        religion != null &&
        religion.isNotEmpty &&
        tongue != null &&
        tongue.isNotEmpty &&
        diet != null &&
        diet.isNotEmpty &&
        marital != null &&
        marital.isNotEmpty &&
        profileFor != null &&
        profileFor.isNotEmpty &&
        hasPhotos;
  }

  void _onOnboardingDone() {
    setState(() => _needsOnboarding = false);
  }

  @override
  Widget build(BuildContext context) {
    if (_banned) {
      return _BannedScreen(reason: _banReason);
    }
    final session = Supabase.instance.client.auth.currentSession;
    if (session == null) {
      return const LoginScreen();
    }
    if (_checking && _needsOnboarding == null) {
      return const Scaffold(
        body: Center(
          child: CircularProgressIndicator(color: MangalamTheme.maroon),
        ),
      );
    }
    if (_needsOnboarding == true) {
      return OnboardingScreen(onCompleted: _onOnboardingDone);
    }
    return const HomeShell();
  }
}

class _BannedScreen extends StatelessWidget {
  const _BannedScreen({this.reason});
  final String? reason;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: MangalamTheme.cream,
      body: Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 28),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Container(
                width: 84,
                height: 84,
                decoration: BoxDecoration(
                  color: MangalamTheme.maroon.withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Iconsax.shield_cross,
                  size: 42,
                  color: MangalamTheme.maroon,
                ),
              ),
              const SizedBox(height: 22),
              const Text(
                'Account suspended',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: MangalamTheme.maroon,
                ),
              ),
              const SizedBox(height: 10),
              const Text(
                'Your account has been banned by our review team for violating community guidelines.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 14,
                  color: MangalamTheme.muted,
                  height: 1.5,
                ),
              ),
              if (reason != null && reason!.isNotEmpty) ...[
                const SizedBox(height: 18),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: MangalamTheme.maroon.withValues(alpha: 0.2),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Reason',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: MangalamTheme.maroon,
                          letterSpacing: 0.4,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        reason!,
                        style: const TextStyle(
                          fontSize: 13.5,
                          color: MangalamTheme.ink,
                          height: 1.4,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 28),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: () async {
                    await Supabase.instance.client.auth.signOut();
                  },
                  icon: const Icon(Iconsax.logout),
                  label: const Text('Sign out'),
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'Contact support if you believe this is a mistake.',
                style: TextStyle(fontSize: 12, color: MangalamTheme.muted),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

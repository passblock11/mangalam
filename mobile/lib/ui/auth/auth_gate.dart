import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../l10n/app_locale.dart';
import '../../services/api_client.dart'
    show ApiClient, ApiException, BannedException;
import '../core/mangalam_theme.dart';
import '../home/home_shell.dart';
import 'login_screen.dart';
import 'onboarding_screen.dart';
import 'registration_membership.dart';

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
  bool _needsMembership = false;

  @override
  void initState() {
    super.initState();
    Supabase.instance.client.auth.onAuthStateChange.listen((_) {
      if (!mounted) return;
      _needsOnboarding = null;
      _needsMembership = false;
      _evaluate();
    });
    _evaluate();
  }

  Future<void> _evaluate() async {
    final session = Supabase.instance.client.auth.currentSession;
    if (session == null) {
      if (mounted) {
        setState(() {
          _needsOnboarding = null;
          _needsMembership = false;
        });
      }
      return;
    }
    if (_checking) return;
    setState(() => _checking = true);
    try {
      final json = await _api.get('/v1/me') as Map<String, dynamic>;
      final p = json['profile'] as Map<String, dynamic>?;
      final lang = p?['app_language']?.toString();
      if (lang != null && lang.isNotEmpty) {
        await AppLocale.instance.set(lang);
      }
      final needs = p == null || !_profileReady(p);
      var pending = !needs && membershipIsPending(p);
      if (!needs && p['gender']?.toString().toLowerCase() == 'female') {
        final waiver = await femaleMembershipWaiverEnabled(_api);
        if (waiver == true) {
          pending = false;
        } else if (waiver == false) {
          pending = !await membershipIsActive(_api);
        }
      }
      if (mounted) {
        setState(() {
          _needsOnboarding = needs;
          _needsMembership = pending;
        });
      }
    } on BannedException {
      // Every API response with a ban already signed this member out.
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
    if (_needsMembership) {
      return RegistrationMembershipScreen(onFinished: _evaluate);
    }
    return const HomeShell();
  }
}

import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../services/api_client.dart';
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

  @override
  void initState() {
    super.initState();
    Supabase.instance.client.auth.onAuthStateChange.listen((_) {
      _needsOnboarding = null;
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
    return name != null &&
        name.isNotEmpty &&
        gender != null &&
        gender.isNotEmpty &&
        dob != null &&
        dob.isNotEmpty &&
        city != null &&
        city.isNotEmpty;
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
        body: Center(child: CircularProgressIndicator()),
      );
    }
    if (_needsOnboarding == true) {
      return OnboardingScreen(onCompleted: _onOnboardingDone);
    }
    return const HomeShell();
  }
}

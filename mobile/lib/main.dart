import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'core/config.dart';
import 'core/google_auth_config.dart';
import 'services/oauth_sign_in.dart';
import 'ui/auth/auth_gate.dart';
import 'ui/core/mangalam_theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await GoogleAuthConfig.hydrate();

  if (AppConfig.hasSupabase) {
    await Supabase.initialize(
      url: AppConfig.supabaseUrl,
      publishableKey: AppConfig.supabasePublishableKey,
      authOptions: const FlutterAuthClientOptions(
        authFlowType: AuthFlowType.pkce,
      ),
    );
    await OAuthSignIn.ensureGoogleInitialized();
  }

  runApp(const MangalamApp());
}

class MangalamApp extends StatelessWidget {
  const MangalamApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Mangalam',
      debugShowCheckedModeBanner: false,
      theme: MangalamTheme.light(),
      home: const _Root(),
    );
  }
}

class _Root extends StatelessWidget {
  const _Root();

  @override
  Widget build(BuildContext context) {
    if (!AppConfig.hasSupabase) {
      return Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(
              'Missing compile-time Supabase config.\n\n'
              'Copy mobile/dart_defines.example.json to dart_defines.json '
              '(fill URL + anon/publishable key from Supabase → Project Settings → API), '
              'then run:\n\n'
              'flutter run --dart-define-from-file=dart_defines.json\n\n'
              'Or use the "Mangalam (mobile)" launch config in VS Code/Cursor.',
              textAlign: TextAlign.center,
            ),
          ),
        ),
      );
    }

    return const AuthGate();
  }
}

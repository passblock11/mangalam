import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'core/config.dart';
import 'ui/auth/login_screen.dart';
import 'ui/home/home_shell.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  if (AppConfig.hasSupabase) {
    await Supabase.initialize(
      url: AppConfig.supabaseUrl,
      publishableKey: AppConfig.supabasePublishableKey,
    );
  }

  runApp(const MangalamApp());
}

class MangalamApp extends StatelessWidget {
  const MangalamApp({super.key});

  @override
  Widget build(BuildContext context) {
    final colorScheme = ColorScheme.fromSeed(
      seedColor: const Color(0xFFC62828),
      brightness: Brightness.light,
    );

    return MaterialApp(
      title: 'Mangalam',
      theme: ThemeData(colorScheme: colorScheme, useMaterial3: true),
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

    return StreamBuilder<AuthState>(
      stream: Supabase.instance.client.auth.onAuthStateChange,
      builder: (context, snapshot) {
        final session = Supabase.instance.client.auth.currentSession;
        if (session != null) {
          return const HomeShell();
        }
        return const LoginScreen();
      },
    );
  }
}

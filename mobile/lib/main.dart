import 'package:flutter/material.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'core/config.dart';
import 'core/google_auth_config.dart';
import 'services/notification_service.dart';
import 'services/oauth_sign_in.dart';
import 'ui/auth/auth_gate.dart';
import 'ui/core/branded_splash.dart';
import 'ui/core/mangalam_theme.dart';
import 'ui/messages/chat_screen.dart';
import 'ui/notifications/notifications_screen.dart';
import 'ui/profile/profile_detail_screen.dart';

// Top-level background message handler (must be a top-level function).
@pragma('vm:entry-point')
Future<void> _firebaseBackgroundHandler(RemoteMessage message) =>
    firebaseMessagingBackgroundHandler(message);

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

    // Register the background isolate handler before initialising the service.
    FirebaseMessaging.onBackgroundMessage(_firebaseBackgroundHandler);
    await NotificationService.instance.init();
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
      navigatorKey: NotificationService.navigatorKey,
      onGenerateRoute: _onGenerateRoute,
      home: BrandedSplash(next: (_) => const _Root()),
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

/// Named routes for notification deep-linking. Existing push(MaterialPageRoute)
/// call sites keep working; this only adds the named-entry path.
Route<dynamic>? _onGenerateRoute(RouteSettings settings) {
  switch (settings.name) {
    case '/notifications':
      return MaterialPageRoute<void>(
        builder: (_) => const NotificationsScreen(),
      );
    case '/chat':
      final args = (settings.arguments as Map?)?.cast<String, dynamic>() ?? {};
      return MaterialPageRoute<void>(
        builder: (_) => ChatScreen(
          conversationId: args['conversation_id'] as String? ?? '',
          otherName: args['other_name'] as String? ?? 'Member',
        ),
      );
    case '/profile':
      final args = (settings.arguments as Map?)?.cast<String, dynamic>() ?? {};
      return MaterialPageRoute<void>(
        builder: (_) => ProfileDetailScreen(
          profileId: args['id'] as String? ?? '',
        ),
      );
    default:
      return null;
  }
}

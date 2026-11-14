import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'core/config.dart';
import 'core/google_auth_config.dart';
import 'l10n/app_locale.dart';
import 'services/app_branding.dart';
import 'services/ban_session.dart';
import 'services/device_integrity.dart';
import 'services/notification_service.dart';
import 'services/oauth_sign_in.dart';
import 'ui/auth/auth_gate.dart';
import 'ui/core/branded_splash.dart';
import 'ui/core/compromised_device_screen.dart';
import 'ui/core/mangalam_theme.dart';
import 'ui/messages/chat_screen.dart';
import 'ui/notifications/notifications_screen.dart';
import 'ui/profile/profile_detail_screen.dart';
import 'ui/profile/support_screen.dart';
import 'ui/profile/verification_screen.dart';

// Top-level background message handler (must be a top-level function).
@pragma('vm:entry-point')
Future<void> _firebaseBackgroundHandler(RemoteMessage message) =>
    firebaseMessagingBackgroundHandler(message);

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
  ]);
  final deviceBlocked = DeviceIntegrity.isBlocked();
  // Local only. The animated splash must be the first screen, so network and
  // plugin setup run while that splash is already showing.
  await Future.wait<void>([
    initializeDateFormatting(),
    AppLocale.instance.load(),
    AppBranding.instance.loadCached(),
  ]);
  if (AppConfig.hasSupabase) {
    FirebaseMessaging.onBackgroundMessage(_firebaseBackgroundHandler);
  }
  final ready = _openServices();
  runApp(MangalamApp(deviceBlocked: deviceBlocked, ready: ready));
}

/// Fonts, Supabase, and notifications. The splash waits for this before login.
Future<void> _openServices() async {
  unawaited(AppBranding.instance.refresh());
  try {
    await GoogleFonts.pendingFonts([
      GoogleFonts.notoSans(),
      GoogleFonts.notoSans(fontWeight: FontWeight.w600),
      GoogleFonts.notoSans(fontWeight: FontWeight.w700),
      GoogleFonts.notoSans(fontWeight: FontWeight.w800),
      GoogleFonts.notoSansDevanagari(),
      GoogleFonts.notoSansTamil(),
      GoogleFonts.notoSansTelugu(),
      GoogleFonts.notoSansKannada(),
      GoogleFonts.notoSansBengali(),
      GoogleFonts.notoSansGujarati(),
      GoogleFonts.notoSansGurmukhi(),
      GoogleFonts.notoSansMalayalam(),
    ]).timeout(const Duration(seconds: 6));
  } catch (_) {}

  await GoogleAuthConfig.hydrate();
  if (!AppConfig.hasSupabase) return;

  await Supabase.initialize(
    url: AppConfig.supabaseUrl,
    publishableKey: AppConfig.supabasePublishableKey,
    authOptions: const FlutterAuthClientOptions(
      authFlowType: AuthFlowType.pkce,
    ),
  );
  await OAuthSignIn.ensureGoogleInitialized();
  await NotificationService.instance.init();
}

class MangalamApp extends StatelessWidget {
  const MangalamApp({
    super.key,
    required this.deviceBlocked,
    required this.ready,
  });

  final Future<bool> deviceBlocked;
  final Future<void> ready;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Listenable.merge([AppLocale.instance, AppBranding.instance]),
      builder: (context, _) {
        return MaterialApp(
          scaffoldMessengerKey: rootMessengerKey,
          title: AppBranding.instance.look.nameOr('Mangalam'),
          debugShowCheckedModeBanner: false,
          theme: MangalamTheme.light(),
          locale: AppLocale.instance.locale,
          supportedLocales: AppLocale.supported,
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          navigatorKey: NotificationService.navigatorKey,
          onGenerateRoute: _onGenerateRoute,
          home: BrandedSplash(
            ready: ready,
            next: (_) => _Root(deviceBlocked: deviceBlocked),
          ),
        );
      },
    );
  }
}

class _Root extends StatelessWidget {
  const _Root({required this.deviceBlocked});

  final Future<bool> deviceBlocked;

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

    return FutureBuilder<bool>(
      future: deviceBlocked,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const ColoredBox(color: MangalamTheme.cream);
        }
        if (snapshot.data == true) return const CompromisedDeviceScreen();
        return const AuthGate();
      },
    );
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
          otherName: args['other_name'] as String? ?? t('Member'),
          otherProfileId: args['other_profile_id'] as String?,
        ),
      );
    case '/profile':
      final args = (settings.arguments as Map?)?.cast<String, dynamic>() ?? {};
      return MaterialPageRoute<void>(
        builder: (_) => ProfileDetailScreen(
          profileId: args['id'] as String? ?? '',
        ),
      );
    case '/verification':
      return MaterialPageRoute<void>(
        builder: (_) => const VerificationScreen(),
      );
    case '/support':
      return MaterialPageRoute<void>(
        builder: (_) => const SupportScreen(),
      );
    case '/support-ticket':
      final ticketArgs = (settings.arguments as Map?)?.cast<String, dynamic>() ?? {};
      final ticketId = ticketArgs['id']?.toString() ?? '';
      if (ticketId.isEmpty) {
        return MaterialPageRoute<void>(builder: (_) => const SupportScreen());
      }
      return MaterialPageRoute<void>(
        builder: (_) => SupportTicketScreen(ticketId: ticketId),
      );
    default:
      return null;
  }
}

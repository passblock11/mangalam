import 'dart:async';
import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/config.dart';
import 'api_client.dart';

/// Centralised push + in-app notification manager.
///
/// - Initialises Firebase Messaging (FCM) for background push delivery.
/// - Registers the device token with the backend (`/v1/notifications/token`).
/// - Shows a local notification when a push arrives in the foreground.
/// - Subscribes to Supabase Realtime on the `notifications` table so the
///   in-app unread badge updates live while the app is open.
/// - Exposes [unreadCount] (a [ValueNotifier<int>]) for the bell badge.
class NotificationService with ChangeNotifier {
  NotificationService._();
  static final NotificationService instance = NotificationService._();

  final _api = ApiClient();
  final _local = FlutterLocalNotificationsPlugin();
  RealtimeChannel? _notifChannel;

  /// Live unread notification count — listen to this for the bell badge.
  final ValueNotifier<int> unreadCount = ValueNotifier<int>(0);

  String? _fcmToken;
  bool _initialized = false;
  StreamSubscription<AuthState>? _authSub;

  /// Call once at app start (after Supabase is initialised). Safe to call
  /// multiple times — guards against double init. Gracefully degrades if
  /// Firebase native config (google-services.json / GoogleService-Info.plist)
  /// is missing: logs a warning and skips FCM, while Supabase Realtime still
  /// powers the in-app feed + badge.
  Future<void> init() async {
    if (_initialized) return;
    _initialized = true;

    // Firebase init — wrapped so a missing native config doesn't crash the app.
    FirebaseApp? app;
    try {
      app = Firebase.apps.isEmpty ? await Firebase.initializeApp() : Firebase.apps.first;
    } catch (e) {
      debugPrint('[NotificationService] Firebase init failed (push disabled): $e');
    }

    if (app != null) {
      await _setupLocalNotifications();
      await _setupFcm();
    }

    // Re-register token + (re)subscribe realtime on sign-in / sign-out.
    _authSub = Supabase.instance.client.auth.onAuthStateChange.listen((state) {
      final event = state.event;
      if (event == AuthChangeEvent.signedIn) {
        _registerToken();
        _subscribeRealtime();
        _refreshUnread();
      } else if (event == AuthChangeEvent.signedOut) {
        _unsubscribeRealtime();
        unreadCount.value = 0;
      }
    });

    // If already signed in at init time, wire up immediately.
    if (Supabase.instance.client.auth.currentSession != null) {
      await _registerToken();
      _subscribeRealtime();
      await _refreshUnread();
    }
  }

  // ─── Local notifications (foreground display) ──────────────────────────────
  Future<void> _setupLocalNotifications() async {
    const android = AndroidInitializationSettings('@mipmap/ic_launcher');
    const ios = DarwinInitializationSettings(
      requestAlertPermission: false,
      requestBadgePermission: false,
      requestSoundPermission: false,
    );
    await _local.initialize(
      const InitializationSettings(android: android, iOS: ios),
      onDidReceiveNotificationResponse: _onLocalTap,
    );
  }

  void _onLocalTap(NotificationResponse response) {
    final payload = response.payload;
    if (payload == null || payload.isEmpty) return;
    _deepLink(payload);
  }

  // ─── FCM ───────────────────────────────────────────────────────────────────
  Future<void> _setupFcm() async {
    final messaging = FirebaseMessaging.instance;

    // Request permission (iOS prompt; Android no-op until Android 13+).
    await messaging.requestPermission(alert: true, badge: true, sound: true);

    // Foreground message handler — show a local notification.
    FirebaseMessaging.onMessage.listen(_handleForegroundMessage);

    // Background/terminated tap → deep link.
    FirebaseMessaging.onMessageOpenedApp.listen(_handleTap);
    final initial = await messaging.getInitialMessage();
    if (initial != null) _handleTap(initial);

    // Track token refresh.
    messaging.onTokenRefresh.listen((token) {
      _fcmToken = token;
      _registerToken();
    });

    _fcmToken = await messaging.getToken();
  }

  Future<void> _registerToken() async {
    final token = _fcmToken;
    final uid = Supabase.instance.client.auth.currentUser?.id;
    if (token == null || uid == null) return;
    try {
      await _api.post('/v1/notifications/token', {
        'fcm_token': token,
        'platform': Platform.isIOS ? 'ios' : 'android',
      });
    } catch (e) {
      debugPrint('[NotificationService] token register failed: $e');
    }
  }

  void _handleForegroundMessage(RemoteMessage message) {
    final n = message.notification;
    final title = n?.title ?? message.data['title']?.toString() ?? 'Mangalam';
    final body = n?.body ?? message.data['body']?.toString() ?? '';
    _showLocal(title, body, _payloadFromData(message.data));
  }

  void _handleTap(RemoteMessage message) {
    _deepLink(_payloadFromData(message.data));
  }

  Future<void> _showLocal(String title, String body, String payload) async {
    const android = AndroidNotificationDetails(
      'mangalam_notifications',
      'Mangalam notifications',
      channelDescription: 'Likes, matches and messages',
      importance: Importance.high,
      priority: Priority.high,
      icon: '@mipmap/ic_launcher',
    );
    const ios = DarwinNotificationDetails();
    await _local.show(
      DateTime.now().millisecondsSinceEpoch.remainder(100000),
      title,
      body,
      const NotificationDetails(android: android, iOS: ios),
      payload: payload,
    );
  }

  String _payloadFromData(Map<String, dynamic> data) {
    // Encode the data map as JSON so the deep-link router can read it.
    if (data.isEmpty) return '';
    try {
      return data.entries
          .map((e) => '${e.key}=${Uri.encodeComponent(e.value.toString())}')
          .join('&');
    } catch (_) {
      return '';
    }
  }

  // ─── Deep link routing ─────────────────────────────────────────────────────
  /// Routes a notification tap to the correct screen. Uses a global navigator
  /// key set by the app (see [setNavigatorKey]).
  static final GlobalKey<NavigatorState> navigatorKey =
      GlobalKey<NavigatorState>();

  void _deepLink(String payload) {
    if (payload.isEmpty) return;
    final params = Uri.splitQueryString(payload);
    final type = params['type'];
    final ctx = navigatorKey.currentContext;
    if (ctx == null) return;
    final conversationId = params['conversation_id'];
    final fromProfileId = params['from_profile_id'];
    if (type == 'message' && conversationId != null && conversationId.isNotEmpty) {
      Navigator.of(ctx).pushNamed('/chat', arguments: {
        'conversation_id': conversationId,
        'other_name': params['title'] ?? 'Member',
      });
    } else if ((type == 'like' || type == 'match' || type == 'shortlist') &&
        fromProfileId != null &&
        fromProfileId.isNotEmpty) {
      Navigator.of(ctx).pushNamed('/profile', arguments: {'id': fromProfileId});
    } else {
      Navigator.of(ctx).pushNamed('/notifications');
    }
  }

  // ─── Supabase Realtime (in-app badge + feed) ────────────────────────────────
  void _subscribeRealtime() {
    final uid = Supabase.instance.client.auth.currentUser?.id;
    if (uid == null) return;
    _unsubscribeRealtime();
    _notifChannel = Supabase.instance.client.channel('notifications');
    _notifChannel!
        .onPostgresChanges(
          event: PostgresChangeEvent.insert,
          schema: 'public',
          table: 'notifications',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'profile_id',
            value: uid,
          ),
          callback: (payload) {
            // New notification for me — bump unread + maybe show banner.
            unreadCount.value = unreadCount.value + 1;
            final row = payload.newRecord;
            final title = row['title']?.toString() ?? 'Mangalam';
            final body = row['body']?.toString() ?? '';
            final type = row['type']?.toString() ?? 'system';
            final data = <String, dynamic>{};
            (row['data'] as Map?)?.forEach((k, v) => data[k.toString()] = v);
            data['type'] = type;
            if (row['conversation_id'] != null) {
              data['conversation_id'] = row['conversation_id'].toString();
            }
            if (row['from_profile_id'] != null) {
              data['from_profile_id'] = row['from_profile_id'].toString();
            }
            // If FCM push didn't fire (app in foreground), show local notification.
            _showLocal(title, body, _payloadFromData(data));
          },
        )
        .subscribe();
  }

  void _unsubscribeRealtime() {
    if (_notifChannel != null) {
      try {
        Supabase.instance.client.removeChannel(_notifChannel!);
      } catch (_) {}
      _notifChannel = null;
    }
  }

  /// Fetch the current unread count from the backend (e.g. on app resume).
  Future<void> _refreshUnread() async {
    try {
      final json =
          await _api.get('/v1/notifications/unread-count') as Map<String, dynamic>;
      final c = json['count'];
      if (c is int) unreadCount.value = c;
    } catch (e) {
      debugPrint('[NotificationService] unread-count failed: $e');
    }
  }

  /// Mark all notifications as read and reset the badge.
  Future<void> markAllRead() async {
    try {
      await _api.post('/v1/notifications/read-all', {});
      unreadCount.value = 0;
    } catch (e) {
      debugPrint('[NotificationService] markAllRead failed: $e');
    }
  }

  /// Mark a single notification read; decrement badge if it was unread.
  Future<void> markRead(String id, {bool wasUnread = true}) async {
    try {
      await _api.post('/v1/notifications/$id/read', {});
      if (wasUnread && unreadCount.value > 0) {
        unreadCount.value = unreadCount.value - 1;
      }
    } catch (e) {
      debugPrint('[NotificationService] markRead failed: $e');
    }
  }

  /// Called by the app lifecycle observer on resume.
  Future<void> onAppResumed() async => _refreshUnread();

  @override
  void dispose() {
    _authSub?.cancel();
    _unsubscribeRealtime();
    super.dispose();
  }
}

/// Top-level background isolate entry — must be a top-level function.
/// Handles messages that arrive while the app is terminated.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // Ensure Firebase is initialised in the background isolate.
  if (Firebase.apps.isEmpty) {
    try {
      await Firebase.initializeApp();
    } catch (_) {
      return;
    }
  }
  // The system displays the notification automatically for `notification`
  // payloads; nothing more to do here. Data-only messages would need a
  // local-notification show, but our backend always sends a notification block.
}

/// Suppress unused-import warning for AppConfig (kept for future deep-link base).
// ignore: unused_element
void _useConfig() => AppConfig.apiBaseUrl;

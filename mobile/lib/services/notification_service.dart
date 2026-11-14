import 'dart:async';
import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/config.dart';
import '../l10n/app_locale.dart';
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
  bool _localReady = false;
  StreamSubscription<AuthState>? _authSub;
  final Map<String, DateTime> _recent = {};

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

    // The notification bar works even when Firebase is not configured.
    await _setupLocalNotifications();
    // Ask only after a frame has drawn. A request made before the Android
    // activity is attached never shows a dialog, which is what the emulator
    // was doing.
    await _requestPlatformPermission();
    if (app != null) {
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
    const android = AndroidInitializationSettings('ic_stat_mangalam');
    const ios = DarwinInitializationSettings(
      requestAlertPermission: false,
      requestBadgePermission: false,
      requestSoundPermission: false,
    );
    try {
      await _local.initialize(
        const InitializationSettings(android: android, iOS: ios),
        onDidReceiveNotificationResponse: _onLocalTap,
      );
    } catch (e) {
      debugPrint('[NotificationService] local init failed: $e');
    }
    final androidPlugin = _local
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >();
    const channels = <AndroidNotificationChannel>[
      AndroidNotificationChannel(
        'mangalam_messages',
        'Messages',
        description: 'New chat messages',
        importance: Importance.high,
      ),
      AndroidNotificationChannel(
        'mangalam_activity',
        'Activity',
        description: 'Likes, matches, shortlists and profile views',
        importance: Importance.high,
      ),
      AndroidNotificationChannel(
        'mangalam_updates',
        'Updates',
        description: 'Verification, reports and announcements',
        importance: Importance.high,
      ),
    ];
    for (final channel in channels) {
      await androidPlugin?.createNotificationChannel(channel);
    }
    _localReady = true;
  }

  /// System notification prompt. Android only shows this from a visible
  /// activity, so this waits for the first frame and retries if the activity
  /// is not attached yet.
  Future<void> _requestPlatformPermission() async {
    final binding = WidgetsBinding.instance;
    final frame = Completer<void>();
    binding.addPostFrameCallback((_) {
      if (!frame.isCompleted) frame.complete();
    });
    await frame.future;
    await Future<void>.delayed(const Duration(milliseconds: 400));

    if (Platform.isAndroid) {
      final androidPlugin = _local
          .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin
          >();
      for (var attempt = 0; attempt < 4; attempt++) {
        try {
          final granted = await androidPlugin?.requestNotificationsPermission();
          debugPrint('[NotificationService] notification permission: $granted');
          return;
        } catch (e) {
          debugPrint('[NotificationService] permission request failed: $e');
          await Future<void>.delayed(const Duration(milliseconds: 400));
        }
      }
      return;
    }

    if (Platform.isIOS) {
      final iosPlugin = _local
          .resolvePlatformSpecificImplementation<
            IOSFlutterLocalNotificationsPlugin
          >();
      try {
        await iosPlugin?.requestPermissions(
          alert: true,
          badge: true,
          sound: true,
        );
      } catch (e) {
        debugPrint('[NotificationService] iOS permission request failed: $e');
      }
    }
  }

  void _onLocalTap(NotificationResponse response) {
    final payload = response.payload;
    if (payload == null || payload.isEmpty) return;
    _deepLink(payload);
  }

  // ─── FCM ───────────────────────────────────────────────────────────────────
  Future<void> _setupFcm() async {
    final messaging = FirebaseMessaging.instance;

    // Android already asked through the system dialog above. Asking again here
    // runs off the main thread and can swallow that dialog. iOS still needs
    // this call so FCM can register for alerts.
    if (!Platform.isAndroid) {
      await messaging.requestPermission(alert: true, badge: true, sound: true);
    }

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
    final data = Map<String, dynamic>.from(message.data);
    data['title'] ??= title;
    data['body'] ??= body;
    _showLocal(
      title,
      body,
      _payloadFromData(data),
      type: message.data['type']?.toString() ?? 'system',
    );
  }

  void _handleTap(RemoteMessage message) {
    final data = Map<String, dynamic>.from(message.data);
    data['title'] ??= message.notification?.title;
    data['body'] ??= message.notification?.body;
    _deepLink(_payloadFromData(data));
  }

  Future<void> _showLocal(
    String title,
    String body,
    String payload, {
    String type = 'system',
  }) async {
    if (!_localReady) return;
    final key = '$type|$title|$body';
    final now = DateTime.now();
    _recent.removeWhere(
      (_, at) => now.difference(at) > const Duration(seconds: 8),
    );
    if (_recent.containsKey(key)) return;
    _recent[key] = now;
    final channel = _channelFor(type);
    final android = AndroidNotificationDetails(
      channel.id,
      channel.name,
      channelDescription: channel.description,
      importance: Importance.high,
      priority: Priority.high,
      icon: 'ic_stat_mangalam',
      playSound: true,
      enableVibration: true,
      styleInformation: BigTextStyleInformation(body),
    );
    const ios = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );
    try {
      await _local.show(
        now.millisecondsSinceEpoch.remainder(100000),
        title,
        body,
        NotificationDetails(android: android, iOS: ios),
        payload: payload,
      );
    } catch (e) {
      debugPrint('[NotificationService] show failed: $e');
    }
  }

  ({String id, String name, String description}) _channelFor(String type) {
    switch (type) {
      case 'message':
        return (
          id: 'mangalam_messages',
          name: 'Messages',
          description: 'New chat messages',
        );
      case 'system':
      case 'verification':
      case 'report':
      case 'support':
        return (
          id: 'mangalam_updates',
          name: 'Updates',
          description: 'Verification, reports and announcements',
        );
      default:
        return (
          id: 'mangalam_activity',
          name: 'Activity',
          description: 'Likes, matches, shortlists and profile views',
        );
    }
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

  String? _pendingPayload;
  int _linkAttempts = 0;

  void _deepLink(String payload) {
    if (payload.isEmpty) return;
    _pendingPayload = payload;
    _linkAttempts = 0;
    _openPending();
  }

  void _openPending() {
    final payload = _pendingPayload;
    if (payload == null || payload.isEmpty) return;
    final ctx = navigatorKey.currentContext;
    if (ctx == null) {
      if (_linkAttempts++ > 40) return;
      WidgetsBinding.instance.addPostFrameCallback((_) => _openPending());
      return;
    }
    _pendingPayload = null;
    final params = Uri.splitQueryString(payload);
    openNotificationTarget(
      ctx,
      type: params['type'] ?? 'system',
      data: params,
      title: params['title'],
      body: params['body'],
    );
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
            data['title'] = title;
            data['body'] = body;
            if (row['conversation_id'] != null) {
              data['conversation_id'] = row['conversation_id'].toString();
            }
            if (row['from_profile_id'] != null) {
              data['from_profile_id'] = row['from_profile_id'].toString();
            }
            _showLocal(title, body, _payloadFromData(data), type: type);
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

/// Opens the screen a notification belongs to. Profile and chat taps include
/// the other member so the header can show their photo and open their profile.
void openNotificationTarget(
  BuildContext context, {
  required String type,
  Map<String, dynamic> data = const {},
  String? title,
  String? body,
}) {
  final conversationId = data['conversation_id']?.toString() ?? '';
  final fromProfileId = data['from_profile_id']?.toString() ?? '';
  final otherName = (data['other_name'] ?? title ?? t('Member')).toString();
  if (type == 'message' && conversationId.isNotEmpty) {
    Navigator.of(context).pushNamed('/chat', arguments: {
      'conversation_id': conversationId,
      'other_profile_id': fromProfileId,
      'other_name': otherName,
    });
    return;
  }
  if ((type == 'like' ||
          type == 'match' ||
          type == 'shortlist' ||
          type == 'view') &&
      fromProfileId.isNotEmpty) {
    Navigator.of(context).pushNamed('/profile', arguments: {'id': fromProfileId});
    return;
  }
  if (type == 'verification') {
    Navigator.of(context).pushNamed('/verification');
    return;
  }
  if (type == 'support') {
    final ticketId = data['ticket_id']?.toString() ?? '';
    if (ticketId.isNotEmpty) {
      Navigator.of(context).pushNamed('/support-ticket', arguments: {'id': ticketId});
    } else {
      Navigator.of(context).pushNamed('/support');
    }
    return;
  }
  final heading = (title ?? data['title']?.toString() ?? '').trim();
  final text = (body ?? data['body']?.toString() ?? '').trim();
  if (heading.isEmpty && text.isEmpty) {
    Navigator.of(context).pushNamed('/notifications');
    return;
  }
  showDialog<void>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(tNotice(heading.isEmpty ? 'Mangalam' : heading)),
      content: text.isEmpty ? null : Text(tNotice(text)),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(ctx).pop(),
          child: Text(t('OK')),
        ),
      ],
    ),
  );
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

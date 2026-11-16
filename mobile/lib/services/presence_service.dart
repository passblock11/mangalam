import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'api_client.dart';

/// Heartbeat while the app is open and the member is signed in.
/// A missing presence table is ignored so chat keeps working.
class PresenceService with WidgetsBindingObserver {
  PresenceService._();
  static final PresenceService instance = PresenceService._();

  Timer? _timer;
  bool _started = false;

  void start() {
    if (_started) return;
    _started = true;
    WidgetsBinding.instance.addObserver(this);
    Supabase.instance.client.auth.onAuthStateChange.listen((_) {
      _followSession();
    });
    _followSession();
  }

  Future<void> goOffline() => _send(false);

  void _followSession() {
    final signedIn = Supabase.instance.client.auth.currentSession != null;
    if (!signedIn) {
      _timer?.cancel();
      _timer = null;
      return;
    }
    final state = WidgetsBinding.instance.lifecycleState;
    final background = state == AppLifecycleState.paused ||
        state == AppLifecycleState.detached ||
        state == AppLifecycleState.hidden;
    if (background) {
      _timer?.cancel();
      _timer = null;
      unawaited(_send(false));
      return;
    }
    unawaited(_send(true));
    _timer ??= Timer.periodic(const Duration(seconds: 25), (_) => _send(true));
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.inactive) return;
    _followSession();
  }

  Future<void> _send(bool online) async {
    if (Supabase.instance.client.auth.currentSession == null) return;
    try {
      await ApiClient().post('/v1/presence', {'online': online});
    } catch (_) {}
  }
}

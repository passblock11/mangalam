import 'package:flutter/services.dart';

/// Blocks the app only on a real phone that is jailbroken or rooted.
///
/// The native check comes from `safe_device`. Emulators, simulators, and a
/// check that throws stay open, so a plugin problem cannot lock everyone out.
/// Mock-location watching stays off so launch does not ask for location.
class DeviceIntegrity {
  DeviceIntegrity._();

  static const _channel = MethodChannel('safe_device');

  static Future<bool> isBlocked() async {
    for (var attempt = 0; attempt < 3; attempt++) {
      try {
        await _channel.invokeMethod<void>('init', {
          'mockLocationCheckEnabled': false,
        }).timeout(const Duration(seconds: 3));
        final real = await _channel
            .invokeMethod<bool>('isRealDevice')
            .timeout(const Duration(seconds: 3));
        if (real != true) return false;
        final rooted = await _channel
            .invokeMethod<bool>('isJailBroken')
            .timeout(const Duration(seconds: 3));
        return rooted == true;
      } on MissingPluginException {
        await Future<void>.delayed(const Duration(milliseconds: 300));
      } catch (_) {
        return false;
      }
    }
    return false;
  }
}

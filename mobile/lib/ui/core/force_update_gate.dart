import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../services/api_client.dart';
import 'mangalam_theme.dart';

const _storeFallback =
    'https://play.google.com/store/apps/details?id=com.mangalam.matrimony';

/// Blocks Android when the admin has required a newer Play version.
/// Any failure leaves the app open.
class ForceUpdateGate extends StatefulWidget {
  const ForceUpdateGate({super.key, required this.child});

  final Widget child;

  @override
  State<ForceUpdateGate> createState() => _ForceUpdateGateState();
}

class _ForceUpdateGateState extends State<ForceUpdateGate>
    with WidgetsBindingObserver {
  bool _blocking = false;
  String _title = 'Update Mangalam';
  String _message = 'A new version of Mangalam is required to continue.';
  String _url = _storeFallback;
  String? _openError;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    unawaited(_check(quiet: false));
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) unawaited(_check(quiet: true));
  }

  Future<void> _check({required bool quiet}) async {
    if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) return;
    try {
      final release = await ApiClient()
          .getPublic('/v1/public/app-release')
          .timeout(const Duration(seconds: 8));
      final info = await PackageInfo.fromPlatform()
          .timeout(const Duration(seconds: 3));
      if (release is! Map) return;
      final build = int.tryParse(info.buildNumber) ?? 0;
      final minRaw = release['android_min_version_code'];
      final min = minRaw is int ? minRaw : int.tryParse('$minRaw') ?? 0;
      final block = release['force_update'] == true &&
          min >= 1 &&
          build > 0 &&
          build < min;
      if (!mounted) return;
      setState(() {
        _blocking = block;
        _openError = null;
        if (block) {
          final title = release['title']?.toString().trim() ?? '';
          final message = release['message']?.toString().trim() ?? '';
          final url = release['play_store_url']?.toString().trim() ?? '';
          if (title.isNotEmpty) _title = title;
          if (message.isNotEmpty) _message = message;
          if (url.startsWith('https://play.google.com/')) _url = url;
        }
      });
    } catch (_) {
      if (!mounted) return;
      if (!quiet || !_blocking) setState(() => _blocking = false);
    }
  }

  Future<void> _openStore() async {
    setState(() => _openError = null);
    final market = Uri.parse('market://details?id=com.mangalam.matrimony');
    try {
      final opened = await launchUrl(market, mode: LaunchMode.externalApplication);
      if (opened) return;
    } catch (_) {}
    try {
      final opened = await launchUrl(
        Uri.parse(_url),
        mode: LaunchMode.externalApplication,
      );
      if (opened) return;
    } catch (_) {}
    if (mounted) {
      setState(() => _openError = 'Could not open the Play Store. Try again.');
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_blocking) return widget.child;
    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: MangalamTheme.cream,
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(28, 48, 28, 28),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Spacer(),
                Text(
                  _title,
                  style: const TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.w800,
                    color: MangalamTheme.ink,
                    height: 1.15,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  _message,
                  style: const TextStyle(
                    fontSize: 16,
                    height: 1.45,
                    color: MangalamTheme.muted,
                  ),
                ),
                if (_openError != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    _openError!,
                    style: const TextStyle(color: MangalamTheme.maroon),
                  ),
                ],
                const Spacer(),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: _openStore,
                    style: FilledButton.styleFrom(
                      backgroundColor: MangalamTheme.maroon,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    child: const Text(
                      'Update',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

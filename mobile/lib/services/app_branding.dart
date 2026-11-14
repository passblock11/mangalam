import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api_client.dart';

/// Admin-controlled splash and login appearance.
/// An empty or default record keeps the design that ships with the app.
class AppBranding extends ChangeNotifier {
  AppBranding._();

  static final AppBranding instance = AppBranding._();
  static const _key = 'app_branding_v1';

  BrandLook look = BrandLook.builtin;

  Future<void> loadCached() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_key);
      if (raw == null || raw.isEmpty) return;
      final next = BrandLook.parse(jsonDecode(raw));
      if (!next.custom) return;
      look = next;
      notifyListeners();
    } catch (_) {}
  }

  /// Fetches the public config. A failure leaves the cached or built-in look.
  Future<void> refresh() async {
    try {
      final json = await ApiClient().getPublic('/v1/config');
      if (json is! Map) return;
      final branding = json['branding'];
      final next = BrandLook.parse(branding);
      look = next;
      final prefs = await SharedPreferences.getInstance();
      if (next.custom && branding != null) {
        await prefs.setString(_key, jsonEncode(branding));
      } else {
        await prefs.remove(_key);
      }
      notifyListeners();
    } catch (_) {}
  }
}

class BrandLook {
  const BrandLook({
    required this.custom,
    required this.appName,
    required this.tagline,
    required this.logoUrl,
    required this.animation,
    required this.durationMs,
    required this.splashStart,
    required this.splashEnd,
    required this.accent,
    required this.titleColor,
    required this.splashImageUrl,
    required this.showLoader,
    required this.headline,
    required this.subheadline,
    required this.welcomeTitle,
    required this.welcomeSubtitle,
    required this.loginImages,
    required this.sheetColor,
    required this.showMandala,
  });

  static const builtin = BrandLook(
    custom: false,
    appName: '',
    tagline: '',
    logoUrl: '',
    animation: 'scale_fade',
    durationMs: 3000,
    splashStart: Color(0xFFB71C1C),
    splashEnd: Color(0xFF7E0F0F),
    accent: Color(0xFFC9A227),
    titleColor: Colors.white,
    splashImageUrl: '',
    showLoader: true,
    headline: '',
    subheadline: '',
    welcomeTitle: '',
    welcomeSubtitle: '',
    loginImages: [],
    sheetColor: Color(0xFFFFF8F3),
    showMandala: true,
  );

  final bool custom;
  final String appName;
  final String tagline;
  final String logoUrl;
  final String animation;
  final int durationMs;
  final Color splashStart;
  final Color splashEnd;
  final Color accent;
  final Color titleColor;
  final String splashImageUrl;
  final bool showLoader;
  final String headline;
  final String subheadline;
  final String welcomeTitle;
  final String welcomeSubtitle;
  final List<String> loginImages;
  final Color sheetColor;
  final bool showMandala;

  Duration get hold => Duration(milliseconds: custom ? durationMs : 3000);

  String nameOr(String fallback) {
    final name = appName.trim();
    return name.isEmpty ? fallback : name;
  }

  static BrandLook parse(dynamic raw) {
    if (raw is! Map) return builtin;
    final appName = _clip(raw['app_name'], 40);
    final logoUrl = _https(raw['logo_url']);
    if (raw['active']?.toString() != 'custom') {
      if (appName.isEmpty && logoUrl.isEmpty) return builtin;
      return BrandLook(
        custom: false,
        appName: appName,
        tagline: '',
        logoUrl: logoUrl,
        animation: builtin.animation,
        durationMs: builtin.durationMs,
        splashStart: builtin.splashStart,
        splashEnd: builtin.splashEnd,
        accent: builtin.accent,
        titleColor: builtin.titleColor,
        splashImageUrl: '',
        showLoader: builtin.showLoader,
        headline: '',
        subheadline: '',
        welcomeTitle: '',
        welcomeSubtitle: '',
        loginImages: const [],
        sheetColor: builtin.sheetColor,
        showMandala: builtin.showMandala,
      );
    }
    final splash = raw['splash'] is Map ? raw['splash'] as Map : const {};
    final login = raw['login'] is Map ? raw['login'] as Map : const {};
    final images = <String>[];
    final listed = login['background_images'];
    if (listed is List) {
      for (final item in listed) {
        final url = _https(item);
        if (url.isEmpty || images.contains(url)) continue;
        images.add(url);
        if (images.length == 5) break;
      }
    }
    final animation = splash['animation']?.toString() ?? '';
    return BrandLook(
      custom: true,
      appName: appName,
      tagline: _clip(raw['tagline'], 80),
      logoUrl: logoUrl,
      animation: animation == 'fade' || animation == 'rise' ? animation : 'scale_fade',
      durationMs: _clamp(splash['duration_ms'], 1500, 8000, 3000),
      splashStart: _color(splash['background_start'], const Color(0xFFB71C1C)),
      splashEnd: _color(splash['background_end'], const Color(0xFF7E0F0F)),
      accent: _color(splash['accent'], const Color(0xFFC9A227)),
      titleColor: _color(splash['title_color'], Colors.white),
      splashImageUrl: _https(splash['background_image_url']),
      showLoader: splash['show_loader'] != false,
      headline: _clip(login['headline'], 80),
      subheadline: _clip(login['subheadline'], 180),
      welcomeTitle: _clip(login['welcome_title'], 40),
      welcomeSubtitle: _clip(login['welcome_subtitle'], 120),
      loginImages: images,
      sheetColor: _color(login['sheet_color'], const Color(0xFFFFF8F3)),
      showMandala: login['show_mandala'] != false,
    );
  }

  static String _clip(dynamic value, int max) {
    if (value is! String) return '';
    final text = value.trim();
    return text.length <= max ? text : text.substring(0, max);
  }

  static String _https(dynamic value) {
    if (value is! String) return '';
    final text = value.trim();
    if (text.isEmpty || text.length > 800) return '';
    final uri = Uri.tryParse(text);
    if (uri == null || uri.scheme != 'https' || uri.host.isEmpty) return '';
    return text;
  }

  static int _clamp(dynamic value, int min, int max, int fallback) {
    final n = value is num ? value.round() : int.tryParse('$value');
    if (n == null) return fallback;
    if (n < min) return min;
    if (n > max) return max;
    return n;
  }

  static Color _color(dynamic value, Color fallback) {
    if (value is! String) return fallback;
    var hex = value.trim();
    if (hex.startsWith('#')) hex = hex.substring(1);
    if (hex.length != 6) return fallback;
    final parsed = int.tryParse(hex, radix: 16);
    if (parsed == null) return fallback;
    return Color(0xFF000000 | parsed);
  }
}

import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'translations.dart';

/// The language the signed-in member chose. English strings stay the source
/// of truth everywhere else (saved profile values, API payloads). [t] only
/// changes what is drawn on screen.
class AppLocale extends ChangeNotifier {
  AppLocale._();

  static final AppLocale instance = AppLocale._();

  static const supportedCodes = [
    'en',
    'hi',
    'mr',
    'ta',
    'te',
    'kn',
    'bn',
    'gu',
    'pa',
    'ml',
  ];

  static const _prefsKey = 'app_language';

  String code = 'en';

  Locale get locale => Locale(code);

  static List<Locale> get supported =>
      supportedCodes.map(Locale.new).toList(growable: false);

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(_prefsKey);
    if (saved != null && supportedCodes.contains(saved)) {
      code = saved;
    }
  }

  /// Persists [value] and rebuilds the app when it actually changes.
  Future<void> set(String value) async {
    final next = supportedCodes.contains(value) ? value : 'en';
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefsKey, next);
    if (next == code) return;
    code = next;
    notifyListeners();
  }
}

/// Translates a fixed English UI string. Unknown text (names, bios, cities,
/// phone numbers) is returned unchanged, so English stays the default.
String t(String english) {
  if (english.isEmpty) return english;
  final code = AppLocale.instance.code;
  if (code == 'en') return english;
  return kTranslations[english]?[code] ?? english;
}

/// Translates admin plan copy. A full phrase is used when it exists.
/// Numbered packs such as "5 Contact Number" use a `{n}` template.
String tCatalog(String english) {
  final text = english.trim();
  if (text.isEmpty) return english;
  final direct = t(text);
  if (direct != text || AppLocale.instance.code == 'en') return direct;
  const patterns = <(String, String)>[
    (r'^(\d+)\s+Contact Numbers?$', '{n} Contact Number'),
    (r'^Get\s+(\d+)\s+Contact access$', 'Get {n} Contact access'),
    (r'^(\d+)\s+credits each renewal$', '{n} credits each renewal'),
    (r'^(\d+)\s+credits$', '{n} credits'),
    (r'^(\d+)\s+days premium$', '{n} days premium'),
  ];
  for (final (source, template) in patterns) {
    final match = RegExp(source, caseSensitive: false).firstMatch(text);
    if (match != null) return tf(template, {'n': match.group(1)!});
  }
  return text;
}

/// Like [t], but `{name}` style placeholders are filled after translation.
String tf(String english, Map<String, String> params) {
  var out = t(english);
  params.forEach((key, value) {
    out = out.replaceAll('{$key}', value);
  });
  return out;
}

/// Translates a stored option, or each comma-separated option in a list.
/// Free text that is not a known phrase is left as the member wrote it.
String tValue(String value) {
  if (value.isEmpty || value == '—') return value;
  final direct = t(value);
  if (direct != value || AppLocale.instance.code == 'en') return direct;
  if (!value.contains(',')) return value;
  return value
      .split(',')
      .map((part) => t(part.trim()))
      .join(', ');
}

/// Notification copy is stored in English, sometimes with a member's name.
String tNotice(String text) {
  if (text.isEmpty || AppLocale.instance.code == 'en') return text;
  final exact = t(text);
  if (exact != text) return exact;
  final likeBack = RegExp(r'^(.*) liked you back\. You can now chat\.$');
  final liked = RegExp(r'^(.*) liked your profile\.$');
  final back = likeBack.firstMatch(text);
  if (back != null) {
    return tf('{name} liked you back. You can now chat.', {
      'name': back.group(1)!,
    });
  }
  final one = liked.firstMatch(text);
  if (one != null) {
    return tf('{name} liked your profile.', {'name': one.group(1)!});
  }
  return text;
}

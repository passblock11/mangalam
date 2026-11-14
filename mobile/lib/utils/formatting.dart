import 'package:intl/intl.dart';

import '../l10n/app_locale.dart';

String formatRelativeTime(String? iso) {
  if (iso == null || iso.isEmpty) return '';
  final parsed = DateTime.tryParse(iso);
  if (parsed == null) return '';
  final now = DateTime.now();
  final diff = now.difference(parsed);
  if (diff.inMinutes < 1) return t('Just now');
  if (diff.inMinutes < 60) {
    return tf('{n}m ago', {'n': '${diff.inMinutes}'});
  }
  if (diff.inHours < 24) {
    return tf('{n}h ago', {'n': '${diff.inHours}'});
  }
  if (diff.inDays < 7) return tf('{n}d ago', {'n': '${diff.inDays}'});
  return DateFormat.MMMd(AppLocale.instance.code).format(parsed);
}

/// Human-readable calendar date, e.g. "Jan 11, 2027". Accepts ISO 8601
/// timestamps (with time/offset) or plain dates. Never returns a raw
/// technical timestamp. Returns '' if unparseable.
String formatDate(Object? value) {
  if (value == null) return '';
  final iso = value.toString().trim();
  if (iso.isEmpty) return '';
  final t = DateTime.tryParse(iso);
  if (t == null) return '';
  return DateFormat('MMM d, yyyy', AppLocale.instance.code).format(t.toLocal());
}

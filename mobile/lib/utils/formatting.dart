import 'package:intl/intl.dart';

String formatRelativeTime(String? iso) {
  if (iso == null || iso.isEmpty) return '';
  final t = DateTime.tryParse(iso);
  if (t == null) return '';
  final now = DateTime.now();
  final diff = now.difference(t);
  if (diff.inMinutes < 1) return 'Just now';
  if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
  if (diff.inHours < 24) return '${diff.inHours}h ago';
  if (diff.inDays < 7) return '${diff.inDays}d ago';
  return DateFormat.MMMd().format(t);
}

/// Human-readable calendar date, e.g. "11 Jan 2027". Accepts ISO 8601
/// timestamps (with time/offset) or plain dates. Returns '' if unparseable.
String formatDate(String? iso) {
  if (iso == null || iso.isEmpty) return '';
  final t = DateTime.tryParse(iso);
  if (t == null) return '';
  return DateFormat('d MMM yyyy').format(t);
}

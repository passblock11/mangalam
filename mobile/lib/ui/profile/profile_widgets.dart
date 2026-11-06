import 'package:flutter/material.dart';

Color _accent(BuildContext context) =>
    Theme.of(context).colorScheme.primary;

/// Label (grey) + value (red) in reference style.
class DetailPair extends StatelessWidget {
  const DetailPair({super.key, required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w600,
              color: _accent(context),
            ),
          ),
        ],
      ),
    );
  }
}

/// 2-column grid of small cards (caste, language, etc.)
class DetailCardGrid extends StatelessWidget {
  const DetailCardGrid({super.key, required this.items});

  final List<({String label, String value})> items;

  @override
  Widget build(BuildContext context) {
    final accent = _accent(context);
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 10,
      crossAxisSpacing: 10,
      childAspectRatio: 1.35,
      children: items.map((e) {
        return Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: accent.withValues(alpha: 0.35),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                e.label,
                style: TextStyle(
                  fontSize: 11,
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                e.value,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: accent,
                ),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }
}

class SectionCard extends StatelessWidget {
  const SectionCard({
    super.key,
    required this.icon,
    required this.title,
    required this.child,
  });

  final IconData icon;
  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final accent = _accent(context);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: accent.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: accent, size: 22),
              const SizedBox(width: 8),
              Text(
                title,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}

String heightHuman(dynamic heightCm) {
  if (heightCm == null) return '—';
  final cm = heightCm is int ? heightCm : int.tryParse(heightCm.toString());
  if (cm == null) return '—';
  final totalIn = (cm / 2.54).round();
  final ft = totalIn ~/ 12;
  final inch = totalIn % 12;
  return '${ft}ft ${inch}in';
}

String formatDob(dynamic raw) {
  if (raw == null) return '—';
  final d = DateTime.tryParse(raw.toString());
  if (d == null) return raw.toString();
  return '${d.day.toString().padLeft(2, '0')} / ${d.month.toString().padLeft(2, '0')} / ${d.year}';
}

String formatBirthTime(dynamic raw) {
  if (raw == null) return '—';
  final s = raw.toString();
  // Postgres time may be "14:05:00"
  final parts = s.split(':');
  if (parts.length >= 2) {
    final h = int.tryParse(parts[0]) ?? 0;
    final m = int.tryParse(parts[1]) ?? 0;
    final dt = DateTime(2000, 1, 1, h, m);
    final h12 = dt.hour > 12 ? dt.hour - 12 : (dt.hour == 0 ? 12 : dt.hour);
    final am = dt.hour >= 12 ? 'PM' : 'AM';
    return '$h12:${m.toString().padLeft(2, '0')} $am';
  }
  return s;
}

String partnerPref(Map<String, dynamic>? pp, String key) {
  if (pp == null) return '—';
  final v = pp[key];
  if (v == null) return '—';
  if (v is List) return v.join(', ');
  return v.toString();
}

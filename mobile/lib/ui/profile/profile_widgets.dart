import 'package:flutter/material.dart';

import '../core/mangalam_theme.dart';

/// Label (muted) + value (maroon) in reference style.
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
            style: const TextStyle(fontSize: 12, color: MangalamTheme.muted),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: MangalamTheme.maroon,
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
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 10,
      crossAxisSpacing: 10,
      childAspectRatio: 1.5,
      children: items.map((e) {
        return Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: MangalamTheme.cream,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: MangalamTheme.maroon.withValues(alpha: 0.18)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                e.label,
                style: const TextStyle(fontSize: 11, color: MangalamTheme.muted),
              ),
              const SizedBox(height: 6),
              Text(
                e.value,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: MangalamTheme.maroon,
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
  const SectionCard({super.key, required this.icon, required this.title, required this.child});

  final IconData icon;
  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
        boxShadow: [
          BoxShadow(
            color: MangalamTheme.maroon.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: MangalamTheme.maroon.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, color: MangalamTheme.maroon, size: 18),
              ),
              const SizedBox(width: 10),
              Text(
                title,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
              ),
            ],
          ),
          const SizedBox(height: 14),
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

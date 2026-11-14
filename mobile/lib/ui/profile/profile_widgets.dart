import 'package:flutter/material.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';

import '../../l10n/app_locale.dart';
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
            t(label),
            style: const TextStyle(fontSize: 12, color: MangalamTheme.muted),
          ),
          const SizedBox(height: 2),
          Text(
            tValue(value),
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
      primary: false,
      padding: EdgeInsets.zero,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 10,
      crossAxisSpacing: 10,
      childAspectRatio: 2.15,
      children: items.map((e) {
        return Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: MangalamTheme.cream,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: MangalamTheme.maroon.withValues(alpha: 0.18),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                t(e.label),
                style: const TextStyle(
                  fontSize: 11,
                  color: MangalamTheme.muted,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                tValue(e.value),
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
                t(title),
                style: Theme.of(
                  context,
                ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
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
  if (pp == null) return 'All Ok';
  final v = pp[key];
  if (v == null) return 'All Ok';
  if (v is List) {
    final text = v
        .map((item) => item.toString().trim())
        .where((item) => item.isNotEmpty)
        .join(', ');
    return text.isEmpty ? 'All Ok' : text;
  }
  final text = v.toString().trim();
  if (text.isEmpty || text == '—' || text == '-') return 'All Ok';
  return v.toString();
}

String partnerAgeRange(Map<String, dynamic>? pp) {
  final min = pp?['age_min']?.toString().trim();
  final max = pp?['age_max']?.toString().trim();
  final hasMin = min != null && min.isNotEmpty;
  final hasMax = max != null && max.isNotEmpty;
  if (hasMin && hasMax) return '$min - $max';
  if (hasMin) return min;
  if (hasMax) return max;
  return 'All Ok';
}

/// Gold pill shown immediately beside a member's name.
class VerifiedBadge extends StatelessWidget {
  const VerifiedBadge({super.key, this.compact = false});

  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 6 : 8,
        vertical: compact ? 2 : 3,
      ),
      decoration: BoxDecoration(
        color: MangalamTheme.gold.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: MangalamTheme.gold.withValues(alpha: 0.7),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Iconsax.verify,
            size: compact ? 12 : 14,
            color: const Color(0xFF8A6B1F),
          ),
          const SizedBox(width: 3),
          Text(
            t('Verified'),
            style: TextStyle(
              fontSize: compact ? 10.5 : 12,
              fontWeight: FontWeight.w700,
              color: const Color(0xFF8A6B1F),
              height: 1.1,
            ),
          ),
        ],
      ),
    );
  }
}

/// Phone and email, always shown on profile detail surfaces.
class ContactFacts extends StatelessWidget {
  const ContactFacts({
    super.key,
    this.phone,
    this.email,
    this.compact = false,
    this.locked = false,
  });

  final String? phone;
  final String? email;
  final bool compact;
  final bool locked;

  @override
  Widget build(BuildContext context) {
    if (locked) {
      return Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            Iconsax.lock,
            size: compact ? 13 : 15,
            color: MangalamTheme.maroon,
          ),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              t('Verify your identity and upgrade to Premium to view phone and email.'),
              style: TextStyle(
                fontSize: compact ? 11.5 : 12.5,
                color: MangalamTheme.maroon,
                fontWeight: FontWeight.w600,
                height: 1.3,
              ),
            ),
          ),
        ],
      );
    }
    final phoneText = (phone ?? '').trim().isEmpty
        ? t('Not added')
        : phone!.trim();
    final emailText = (email ?? '').trim().isEmpty
        ? t('Not added')
        : email!.trim();
    final style = TextStyle(
      fontSize: compact ? 12.5 : 14,
      color: MangalamTheme.ink,
      fontWeight: FontWeight.w600,
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _line(Iconsax.call, 'Phone', phoneText, style),
        const SizedBox(height: 4),
        _line(Iconsax.sms, 'Email', emailText, style),
      ],
    );
  }

  Widget _line(IconData icon, String label, String value, TextStyle style) {
    return Row(
      children: [
        Icon(icon, size: 14, color: MangalamTheme.maroon),
        const SizedBox(width: 6),
        Text('${t(label)}: ', style: const TextStyle(fontSize: 12.5, color: MangalamTheme.muted)),
        Expanded(
          child: Text(value, style: style, maxLines: 1, overflow: TextOverflow.ellipsis),
        ),
      ],
    );
  }
}

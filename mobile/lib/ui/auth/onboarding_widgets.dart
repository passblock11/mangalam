import 'package:flutter/material.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';

import '../../l10n/app_locale.dart';
import '../core/mangalam_theme.dart';

/// Selectable card with icon + label. Used for single-choice onboarding steps.
class OptionCard extends StatelessWidget {
  const OptionCard({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
    this.icon,
    this.subtitle,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final IconData? icon;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Material(
      color: selected
          ? MangalamTheme.maroon.withValues(alpha: 0.06)
          : Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(
          color: selected ? MangalamTheme.maroon : cs.outlineVariant,
          width: selected ? 2 : 1,
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: [
              if (icon != null) ...[
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: selected
                        ? MangalamTheme.maroon.withValues(alpha: 0.12)
                        : const Color(0xFFF3E9DF),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    icon,
                    size: 20,
                    color: selected
                        ? MangalamTheme.maroon
                        : MangalamTheme.muted,
                  ),
                ),
                const SizedBox(width: 12),
              ],
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      t(label),
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: selected
                            ? FontWeight.w700
                            : FontWeight.w600,
                      ),
                    ),
                    if (subtitle != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        t(subtitle!),
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: MangalamTheme.muted,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              if (selected)
                Container(
                  width: 24,
                  height: 24,
                  decoration: const BoxDecoration(
                    color: MangalamTheme.maroon,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Iconsax.tick_circle,
                    color: Colors.white,
                    size: 16,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Section header for each onboarding step.
class StepHeader extends StatelessWidget {
  const StepHeader({super.key, required this.title, this.subtitle, this.emoji});

  final String title;
  final String? subtitle;
  final String? emoji;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (emoji != null) ...[
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: MangalamTheme.maroon.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(18),
            ),
            alignment: Alignment.center,
            child: Text(emoji!, style: const TextStyle(fontSize: 28)),
          ),
          const SizedBox(height: 16),
        ],
        Text(
          t(title),
          style: theme.textTheme.headlineSmall?.copyWith(
            fontWeight: FontWeight.w800,
            letterSpacing: -0.4,
            height: 1.15,
          ),
        ),
        if (subtitle != null) ...[
          const SizedBox(height: 8),
          Text(
            t(subtitle!),
            style: theme.textTheme.bodyMedium?.copyWith(
              color: MangalamTheme.muted,
              height: 1.45,
            ),
          ),
        ],
      ],
    );
  }
}

/// Segmented progress indicator with step counter + back button slot.
class OnboardingProgress extends StatelessWidget {
  const OnboardingProgress({
    super.key,
    required this.current,
    required this.total,
    this.onBack,
  });

  final int current;
  final int total;
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        if (current > 0 && onBack != null)
          IconButton(
            onPressed: onBack,
            icon: const Icon(Iconsax.arrow_left),
            style: IconButton.styleFrom(
              backgroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(
                  color: Theme.of(context).colorScheme.outlineVariant,
                ),
              ),
            ),
          )
        else
          const SizedBox(width: 48),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    tf('Step {current} of {total}', {
                      'current': '${current + 1}',
                      'total': '$total',
                    }),
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: MangalamTheme.muted,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(
                    '${(((current + 1) / total) * 100).round()}%',
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: MangalamTheme.maroon,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: List.generate(total, (i) {
                  final done = i <= current;
                  return Expanded(
                    child: Container(
                      margin: EdgeInsets.only(right: i == total - 1 ? 0 : 4),
                      height: 5,
                      decoration: BoxDecoration(
                        color: done
                            ? MangalamTheme.maroon
                            : const Color(0xFFE8DDCF),
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                  );
                }),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

import 'package:flutter/material.dart';

/// Central design system for Mangalam.
///
/// Palette inspired by Indian matrimonial aesthetics:
///   - Maroon (primary)   : trust, tradition, wedding red
///   - Gold (accent)      : auspicious, premium
///   - Cream/surface       : warm, soft background
class MangalamTheme {
  MangalamTheme._();

  // ── Brand colors ────────────────────────────────────────────────
  static const Color maroon = Color(0xFFB71C1C);
  static const Color maroonDark = Color(0xFF7F0000);
  static const Color maroonLight = Color(0xFFE53935);
  static const Color gold = Color(0xFFC9A227);
  static const Color goldLight = Color(0xFFF4E5B2);
  static const Color cream = Color(0xFFFFF8F3);
  static const Color ink = Color(0xFF1F1B16);
  static const Color muted = Color(0xFF6B6258);

  // ── Gradients ───────────────────────────────────────────────────
  static const LinearGradient brandGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [maroonLight, maroon, maroonDark],
  );

  static const LinearGradient heroGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [Color(0xFF8E1B1B), Color(0xFFB71C1C), Color(0xFF4A0E0E)],
  );

  static const LinearGradient goldGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFE6C468), gold, Color(0xFF8A6B1F)],
  );

  // Avatar gradient palette — deterministic per initial.
  static const List<List<Color>> avatarGradients = [
    [Color(0xFFE53935), Color(0xFFB71C1C)],
    [Color(0xFFD81B60), Color(0xFF880E4F)],
    [Color(0xFF8E24AA), Color(0xFF4A148C)],
    [Color(0xFF5E35B1), Color(0xFF311B92)],
    [Color(0xFF3949AB), Color(0xFF1A237E)],
    [Color(0xFF1E88E5), Color(0xFF0D47A1)],
    [Color(0xFF039BE5), Color(0xFF01579B)],
    [Color(0xFF00ACC1), Color(0xFF006064)],
    [Color(0xFF00897B), Color(0xFF004D40)],
    [Color(0xFF43A047), Color(0xFF1B5E20)],
    [Color(0xFF7CB342), Color(0xFF33691E)],
    [Color(0xFFC0CA33), Color(0xFF827717)],
    [Color(0xFFFDD835), Color(0xFFF57F17)],
    [Color(0xFFFFB300), Color(0xFFFF6F00)],
    [Color(0xFFFB8C00), Color(0xFFE65100)],
    [Color(0xFFF4511E), Color(0xFFBF360C)],
  ];

  static List<Color> gradientFor(String key) {
    if (key.isEmpty) return avatarGradients.first;
    final code = key.codeUnitAt(0);
    return avatarGradients[code % avatarGradients.length];
  }

  // ── Theme construction ─────────────────────────────────────────
  static ThemeData light() {
    final scheme =
        ColorScheme.fromSeed(
          seedColor: maroon,
          brightness: Brightness.light,
          primary: maroon,
          onPrimary: Colors.white,
          secondary: gold,
          onSecondary: ink,
          surface: cream,
          onSurface: ink,
          surfaceContainerHighest: const Color(0xFFF3E9DF),
          error: const Color(0xFFC62828),
        ).copyWith(
          outline: const Color(0xFFD7C8B8),
          outlineVariant: const Color(0xFFE8DDCF),
        );

    final base = ThemeData(
      colorScheme: scheme,
      useMaterial3: true,
      scaffoldBackgroundColor: cream,
      splashFactory: InkRipple.splashFactory,
    );

    return base.copyWith(
      textTheme: _buildText(base.textTheme),
      appBarTheme: AppBarTheme(
        backgroundColor: cream,
        foregroundColor: ink,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: base.textTheme.titleLarge?.copyWith(
          fontWeight: FontWeight.w700,
          color: ink,
          letterSpacing: -0.3,
        ),
      ),
      cardTheme: CardThemeData(
        color: Colors.white,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: BorderSide(color: scheme.outlineVariant),
        ),
        margin: EdgeInsets.zero,
      ),
      inputDecorationTheme: _inputDecoration(scheme),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: maroon,
          foregroundColor: Colors.white,
          minimumSize: const Size.fromHeight(52),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: maroon,
          minimumSize: const Size.fromHeight(52),
          side: BorderSide(color: scheme.outline),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: maroon,
          textStyle: const TextStyle(fontWeight: FontWeight.w600),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: const Color(0xFFF3E9DF),
        selectedColor: goldLight,
        labelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
        side: BorderSide.none,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      ),
      tabBarTheme: TabBarThemeData(
        labelColor: maroon,
        unselectedLabelColor: muted,
        labelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
        unselectedLabelStyle: const TextStyle(
          fontWeight: FontWeight.w500,
          fontSize: 14,
        ),
        indicatorSize: TabBarIndicatorSize.label,
        indicator: const UnderlineTabIndicator(
          borderSide: BorderSide(width: 2.5, color: maroon),
          insets: EdgeInsets.symmetric(horizontal: -16),
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: ink,
        contentTextStyle: const TextStyle(color: Colors.white),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
      dividerTheme: DividerThemeData(
        color: scheme.outlineVariant,
        thickness: 1,
        space: 1,
      ),
    );
  }

  static TextTheme _buildText(TextTheme base) {
    return base.copyWith(
      displayLarge: base.displayLarge?.copyWith(
        fontWeight: FontWeight.w800,
        letterSpacing: -1.2,
      ),
      displayMedium: base.displayMedium?.copyWith(
        fontWeight: FontWeight.w800,
        letterSpacing: -1,
      ),
      headlineLarge: base.headlineLarge?.copyWith(
        fontWeight: FontWeight.w800,
        letterSpacing: -0.8,
      ),
      headlineMedium: base.headlineMedium?.copyWith(
        fontWeight: FontWeight.w700,
        letterSpacing: -0.5,
      ),
      headlineSmall: base.headlineSmall?.copyWith(
        fontWeight: FontWeight.w700,
        letterSpacing: -0.4,
      ),
      titleLarge: base.titleLarge?.copyWith(
        fontWeight: FontWeight.w700,
        letterSpacing: -0.3,
      ),
      titleMedium: base.titleMedium?.copyWith(fontWeight: FontWeight.w700),
      titleSmall: base.titleSmall?.copyWith(fontWeight: FontWeight.w600),
      bodyLarge: base.bodyLarge?.copyWith(height: 1.45, color: ink),
      bodyMedium: base.bodyMedium?.copyWith(height: 1.45, color: ink),
      bodySmall: base.bodySmall?.copyWith(color: muted),
      labelLarge: base.labelLarge?.copyWith(fontWeight: FontWeight.w700),
      labelMedium: base.labelMedium?.copyWith(fontWeight: FontWeight.w600),
    );
  }

  static InputDecorationTheme _inputDecoration(ColorScheme scheme) {
    final border = OutlineInputBorder(
      borderRadius: BorderRadius.circular(14),
      borderSide: BorderSide(color: scheme.outline),
    );
    return InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: border,
      enabledBorder: border,
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: maroon, width: 1.5),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: scheme.error),
      ),
      labelStyle: const TextStyle(color: muted, fontWeight: FontWeight.w500),
      hintStyle: const TextStyle(color: Color(0xFFA99F92)),
      floatingLabelStyle: const TextStyle(
        color: maroon,
        fontWeight: FontWeight.w600,
      ),
    );
  }
}

/// Avatar with a deterministic gradient + initial.
class MangalamAvatar extends StatelessWidget {
  const MangalamAvatar({
    super.key,
    required this.name,
    this.size = 48,
    this.radius,
    this.fontSize,
  });

  final String name;
  final double size;
  final double? radius;
  final double? fontSize;

  String get _initial {
    final trimmed = name.trim();
    if (trimmed.isEmpty) return '?';
    return trimmed[0].toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final r = radius ?? size / 2;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: MangalamTheme.gradientFor(name),
        ),
        borderRadius: BorderRadius.circular(r),
        boxShadow: [
          BoxShadow(
            color: MangalamTheme.maroon.withValues(alpha: 0.15),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      alignment: Alignment.center,
      child: Text(
        _initial,
        style: TextStyle(
          color: Colors.white,
          fontSize: fontSize ?? size * 0.42,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

/// Pill badge used in profile cards / detail header.
class MangalamBadge extends StatelessWidget {
  const MangalamBadge({
    super.key,
    required this.label,
    this.icon,
    this.color = MangalamTheme.gold,
    this.background,
    this.foreground,
  });

  final String label;
  final IconData? icon;
  final Color color;
  final Color? background;
  final Color? foreground;

  @override
  Widget build(BuildContext context) {
    final bg = background ?? color.withValues(alpha: 0.12);
    final fg = foreground ?? color;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.25), width: 1),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 13, color: fg),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: fg,
            ),
          ),
        ],
      ),
    );
  }
}

/// Section header used inside screens (not onboarding).
class MangalamSectionHeader extends StatelessWidget {
  const MangalamSectionHeader({
    super.key,
    required this.title,
    this.icon,
    this.action,
  });

  final String title;
  final IconData? icon;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        if (icon != null) ...[
          Icon(icon, size: 18, color: MangalamTheme.maroon),
          const SizedBox(width: 8),
        ],
        Expanded(
          child: Text(
            title,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w800,
              letterSpacing: -0.2,
            ),
          ),
        ),
        if (action != null) action!,
      ],
    );
  }
}

/// Rounded card wrapper with consistent elevation + radius.
class MangalamCard extends StatelessWidget {
  const MangalamCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.color,
    this.borderColor,
    this.radius = 18,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final Color? color;
  final Color? borderColor;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: color ?? Colors.white,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(
          color: borderColor ?? Theme.of(context).colorScheme.outlineVariant,
        ),
        boxShadow: [
          BoxShadow(
            color: MangalamTheme.maroon.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: child,
    );
  }
}

/// Empty state with icon + message + optional action.
class MangalamEmptyState extends StatelessWidget {
  const MangalamEmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
    this.action,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 88,
              height: 88,
              decoration: BoxDecoration(
                color: MangalamTheme.maroon.withValues(alpha: 0.08),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 40, color: MangalamTheme.maroon),
            ),
            const SizedBox(height: 20),
            Text(
              title,
              textAlign: TextAlign.center,
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
            ),
            if (subtitle != null) ...[
              const SizedBox(height: 8),
              Text(
                subtitle!,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: MangalamTheme.muted,
                  height: 1.4,
                ),
              ),
            ],
            if (action != null) ...[const SizedBox(height: 20), action!],
          ],
        ),
      ),
    );
  }
}

/// Displays the first photo from [photoUrls] if available, else a
/// deterministic gradient + initial fallback. Works for any profile.
class ProfilePhoto extends StatelessWidget {
  const ProfilePhoto({
    super.key,
    required this.name,
    this.photoUrls = const [],
    this.index = 0,
    this.fit = BoxFit.cover,
    this.borderRadius,
  });

  final String name;
  final List<String> photoUrls;
  final int index;
  final BoxFit fit;
  final double? borderRadius;

  @override
  Widget build(BuildContext context) {
    final url = (photoUrls.isNotEmpty && index < photoUrls.length)
        ? photoUrls[index]
        : null;
    final r = borderRadius ?? 0;
    return ClipRRect(
      borderRadius: BorderRadius.circular(r),
      child: url != null
          ? Image.network(
              url,
              fit: fit,
              loadingBuilder: (context, child, progress) {
                if (progress == null) return child;
                return Container(
                  color: const Color(0xFFF3E9DF),
                  alignment: Alignment.center,
                  child: const CircularProgressIndicator(
                    strokeWidth: 2,
                    color: MangalamTheme.maroon,
                  ),
                );
              },
              errorBuilder: (_, __, ___) => _fallback(name),
            )
          : _fallback(name),
    );
  }

  Widget _fallback(String name) {
    final initial = name.trim().isEmpty ? '?' : name.trim()[0].toUpperCase();
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: MangalamTheme.gradientFor(name),
        ),
      ),
      alignment: Alignment.center,
      child: Text(
        initial,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 64,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

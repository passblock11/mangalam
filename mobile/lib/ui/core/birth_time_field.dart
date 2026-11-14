import 'package:flutter/material.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';

import '../../l10n/app_locale.dart';
import '../profile/profile_widgets.dart';
import 'mangalam_theme.dart';

/// Read-only birth time. The member picks a clock time; the stored value
/// stays `HH:mm` so existing profile and biodata formatting still works.
class BirthTimeField extends StatefulWidget {
  const BirthTimeField({
    super.key,
    required this.controller,
    required this.label,
  });

  final TextEditingController controller;
  final String label;

  @override
  State<BirthTimeField> createState() => _BirthTimeFieldState();
}

class _BirthTimeFieldState extends State<BirthTimeField> {
  late final TextEditingController _display;

  @override
  void initState() {
    super.initState();
    _display = TextEditingController(text: _shown(widget.controller.text));
    widget.controller.addListener(_sync);
  }

  @override
  void didUpdateWidget(BirthTimeField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.controller != widget.controller) {
      oldWidget.controller.removeListener(_sync);
      widget.controller.addListener(_sync);
      _sync();
    }
  }

  @override
  void dispose() {
    widget.controller.removeListener(_sync);
    _display.dispose();
    super.dispose();
  }

  void _sync() {
    final next = _shown(widget.controller.text);
    if (_display.text == next) return;
    _display.text = next;
  }

  String _shown(String raw) {
    final parsed = parseBirthTime(raw);
    if (parsed == null) return raw;
    final hh = parsed.hour.toString().padLeft(2, '0');
    final mm = parsed.minute.toString().padLeft(2, '0');
    return formatBirthTime('$hh:$mm');
  }

  Future<void> _pick() async {
    FocusManager.instance.primaryFocus?.unfocus();
    final initial = parseBirthTime(widget.controller.text) ?? TimeOfDay.now();
    final picked = await showTimePicker(
      context: context,
      initialTime: initial,
      builder: (context, child) {
        final theme = Theme.of(context);
        return MediaQuery(
          data: MediaQuery.of(context).copyWith(alwaysUse24HourFormat: false),
          child: Theme(
            data: theme.copyWith(
              colorScheme: theme.colorScheme.copyWith(
                primary: MangalamTheme.maroon,
                onPrimary: Colors.white,
              ),
            ),
            child: child!,
          ),
        );
      },
    );
    if (picked == null || !mounted) return;
    final hh = picked.hour.toString().padLeft(2, '0');
    final mm = picked.minute.toString().padLeft(2, '0');
    widget.controller.text = '$hh:$mm';
  }

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: _display,
      readOnly: true,
      showCursor: false,
      enableInteractiveSelection: false,
      onTap: _pick,
      decoration: InputDecoration(
        labelText: t(widget.label),
        prefixIcon: const Icon(Iconsax.clock),
      ),
    );
  }
}

/// Reads `18:55` and `6:55 pm`. Returns null when the text is not a time.
TimeOfDay? parseBirthTime(String raw) {
  final match = RegExp(
    r'^(\d{1,2})\s*:\s*(\d{2})(?:\s*([AaPp][Mm]))?',
  ).firstMatch(raw.trim());
  if (match == null) return null;
  var hour = int.tryParse(match.group(1)!);
  final minute = int.tryParse(match.group(2)!);
  if (hour == null || minute == null || minute > 59 || hour > 23) return null;
  final suffix = match.group(3)?.toLowerCase();
  if (suffix == 'pm' && hour < 12) hour += 12;
  if (suffix == 'am' && hour == 12) hour = 0;
  if (hour > 23) return null;
  return TimeOfDay(hour: hour, minute: minute);
}

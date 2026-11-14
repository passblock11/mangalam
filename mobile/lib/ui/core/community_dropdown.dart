import 'package:flutter/material.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';

import '../../l10n/app_locale.dart';
import '../auth/indian_communities.dart';
import 'mangalam_theme.dart';

/// Searchable community field. A normal dropdown of 500+ rows builds every
/// menu item at once and can crash, so this opens a list that only builds
/// the rows on screen.
class CommunityDropdown extends StatelessWidget {
  const CommunityDropdown({
    super.key,
    required this.value,
    required this.onChanged,
    this.label = 'Community / Caste (optional)',
    this.placeholder = 'Not specified',
  });

  final String? value;
  final ValueChanged<String?> onChanged;
  final String label;
  final String placeholder;

  Future<void> _open(BuildContext context) async {
    final picked = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) => _CommunitySheet(
        selected: value,
        placeholder: placeholder,
      ),
    );
    if (!context.mounted || picked == null) return;
    onChanged(picked.isEmpty ? null : picked);
  }

  @override
  Widget build(BuildContext context) {
    final selected = value?.trim() ?? '';
    final hasValue = selected.isNotEmpty;
    return InkWell(
      onTap: () => _open(context),
      borderRadius: BorderRadius.circular(14),
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: t(label),
          prefixIcon: const Icon(Iconsax.people),
          suffixIcon: const Icon(Iconsax.arrow_down_1),
        ),
        child: Text(
          hasValue ? selected : t(placeholder),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: hasValue ? MangalamTheme.ink : MangalamTheme.muted,
            fontSize: 16,
          ),
        ),
      ),
    );
  }
}

class _CommunitySheet extends StatefulWidget {
  const _CommunitySheet({required this.selected, required this.placeholder});

  final String? selected;
  final String placeholder;

  @override
  State<_CommunitySheet> createState() => _CommunitySheetState();
}

class _CommunitySheetState extends State<_CommunitySheet> {
  final _search = TextEditingController();
  String _query = '';
  late final List<String> _options;

  @override
  void initState() {
    super.initState();
    final current = widget.selected?.trim() ?? '';
    final known = indianCommunities.any(
      (name) => name.toLowerCase() == current.toLowerCase(),
    );
    _options = current.isEmpty || known
        ? indianCommunities
        : <String>[current, ...indianCommunities];
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final view = MediaQuery.of(context);
    final available = view.size.height - view.viewInsets.bottom;
    final height = (available * 0.86).clamp(180.0, available);
    final query = _query.trim().toLowerCase();
    final matches = query.isEmpty
        ? _options
        : _options
            .where((name) => name.toLowerCase().contains(query))
            .toList(growable: false);

    return Padding(
      padding: EdgeInsets.only(bottom: view.viewInsets.bottom),
      child: SizedBox(
        height: height,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: TextField(
                controller: _search,
                textInputAction: TextInputAction.search,
                decoration: InputDecoration(
                  labelText: t('Search community'),
                  prefixIcon: const Icon(Iconsax.search_normal),
                ),
                onChanged: (v) => setState(() => _query = v),
              ),
            ),
            Expanded(
              child: ListView.builder(
                keyboardDismissBehavior:
                    ScrollViewKeyboardDismissBehavior.onDrag,
                itemCount: matches.isEmpty ? 2 : matches.length + 1,
                itemBuilder: (context, index) {
                  if (index == 0) {
                    return ListTile(
                      title: Text(
                        t(widget.placeholder),
                        style: const TextStyle(color: MangalamTheme.muted),
                      ),
                      onTap: () => Navigator.of(context).pop(''),
                    );
                  }
                  if (matches.isEmpty) {
                    return Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text(
                        t('No matching community'),
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: MangalamTheme.muted),
                      ),
                    );
                  }
                  final name = matches[index - 1];
                  final selected =
                      name.toLowerCase() ==
                      (widget.selected?.trim().toLowerCase() ?? '');
                  return ListTile(
                    title: Text(name, maxLines: 1, overflow: TextOverflow.ellipsis),
                    trailing: selected
                        ? const Icon(Iconsax.tick_circle, color: MangalamTheme.maroon)
                        : null,
                    onTap: () => Navigator.of(context).pop(name),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

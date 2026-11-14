import 'package:flutter/material.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';

import '../../services/city_search_service.dart';
import '../core/mangalam_theme.dart';
import '../../l10n/app_locale.dart';

/// A text field that autocomplete-suggests Indian cities as the user types,
/// using the free OpenStreetMap Nominatim API (no key required).
///
/// When the user picks a suggestion, [onSelected] is called with the city
/// name and (optionally) the state, so the caller can also auto-fill the
/// State dropdown.
class CitySearchField extends StatefulWidget {
  const CitySearchField({
    super.key,
    required this.onSelected,
    this.initialCity,
    this.onStateSelected,
    this.label = 'City',
    this.icon = Iconsax.building,
    this.includeStateInValue = false,
  });

  /// Called whenever the city changes (typing or picking a suggestion).
  final ValueChanged<String> onSelected;

  /// Optional: if the suggestion includes a state, this is called too so
  /// the caller can auto-fill their State dropdown.
  final void Function(String state)? onStateSelected;

  /// Initial city value (for edit-profile).
  final String? initialCity;

  /// Translation key for the field label. Defaults to the living-city field.
  final String label;

  final IconData icon;

  /// When true, a picked suggestion is saved as "City, State".
  /// The living-city field leaves this off and fills State separately.
  final bool includeStateInValue;

  @override
  State<CitySearchField> createState() => _CitySearchFieldState();
}

class _CitySearchFieldState extends State<CitySearchField> {
  final _ctrl = TextEditingController();
  final _focus = FocusNode();
  final _link = LayerLink();
  List<CityResult> _results = [];
  bool _loading = false;
  OverlayEntry? _overlayEntry;

  @override
  void initState() {
    super.initState();
    _ctrl.text = widget.initialCity ?? '';
    _focus.addListener(_onFocusChange);
  }

  @override
  void dispose() {
    CitySearchService.cancel(this);
    _removeOverlay();
    _ctrl.dispose();
    _focus.removeListener(_onFocusChange);
    _focus.dispose();
    super.dispose();
  }

  void _onFocusChange() {
    if (_focus.hasFocus && _results.isNotEmpty) {
      _showOverlay();
    } else if (!_focus.hasFocus) {
      // Delay hiding so a tap on a suggestion registers.
      Future<void>.delayed(const Duration(milliseconds: 150), _removeOverlay);
    }
  }

  void _showOverlay() {
    _removeOverlay();
    _overlayEntry = OverlayEntry(builder: (_) => _buildOverlay());
    Overlay.of(context).insert(_overlayEntry!);
  }

  void _removeOverlay() {
    _overlayEntry?.remove();
    _overlayEntry = null;
  }

  void _onChanged(String value) {
    widget.onSelected(value);
    CitySearchService.search(
      value,
      owner: this,
      onLoading: (l) {
        if (mounted) setState(() => _loading = l);
      },
      onResults: (results) {
        if (!mounted) return;
        setState(() => _results = results);
        if (results.isNotEmpty && _focus.hasFocus) {
          _showOverlay();
        } else {
          _removeOverlay();
        }
      },
    );
  }

  void _pick(CityResult r) {
    final text = widget.includeStateInValue && r.state.isNotEmpty
        ? '${r.city}, ${r.state}'
        : r.city;
    _ctrl.text = text;
    widget.onSelected(text);
    if (!widget.includeStateInValue &&
        r.state.isNotEmpty &&
        widget.onStateSelected != null) {
      widget.onStateSelected!(r.state);
    }
    _removeOverlay();
    _focus.unfocus();
  }

  @override
  Widget build(BuildContext context) {
    return CompositedTransformTarget(
      link: _link,
      child: TextField(
        controller: _ctrl,
        focusNode: _focus,
        textCapitalization: TextCapitalization.words,
        decoration: InputDecoration(
          labelText: t(widget.label),
          prefixIcon: Icon(widget.icon),
          suffixIcon: _loading
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: Padding(
                    padding: EdgeInsets.all(10),
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: MangalamTheme.maroon,
                    ),
                  ),
                )
              : null,
        ),
        onChanged: _onChanged,
      ),
    );
  }

  Widget _buildOverlay() {
    final renderBox = context.findRenderObject() as RenderBox?;
    final width = renderBox?.size.width ?? 280;
    return Positioned(
      width: width,
      child: CompositedTransformFollower(
        link: _link,
        showWhenUnlinked: false,
        offset: const Offset(0, 56),
        child: Material(
          elevation: 6,
          borderRadius: BorderRadius.circular(12),
          color: Colors.white,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxHeight: 260),
            child: ListView.separated(
              shrinkWrap: true,
              padding: EdgeInsets.zero,
              itemCount: _results.length,
              separatorBuilder: (_, __) => const Divider(height: 1, indent: 12),
              itemBuilder: (_, i) {
                final r = _results[i];
                return ListTile(
                  dense: true,
                  leading: const Icon(
                    Iconsax.location,
                    size: 18,
                    color: MangalamTheme.maroon,
                  ),
                  title: Text(
                    r.city,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  subtitle: Text(
                    r.state.isNotEmpty ? r.state : r.displayName,
                    style: const TextStyle(
                      fontSize: 11,
                      color: MangalamTheme.muted,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  onTap: () => _pick(r),
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}

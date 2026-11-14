import 'package:flutter/material.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';

import '../../l10n/app_locale.dart';
import '../auth/onboarding_data.dart';
import '../core/city_search_field.dart';
import '../core/community_dropdown.dart';
import '../core/mangalam_theme.dart';

/// Discover view filters. Empty means the server returns the usual list.
class DiscoverFilters {
  const DiscoverFilters({
    this.ageMin,
    this.ageMax,
    this.heightMin,
    this.heightMax,
    this.state,
    this.city,
    this.religion,
    this.community,
    this.motherTongue,
    this.diet,
    this.marital,
    this.education,
    this.occupation,
    this.salary,
    this.mangal,
    this.verifiedOnly = false,
  });

  final int? ageMin;
  final int? ageMax;
  final int? heightMin;
  final int? heightMax;
  final String? state;
  final String? city;
  final String? religion;
  final String? community;
  final String? motherTongue;
  final String? diet;
  final String? marital;
  final String? education;
  final String? occupation;
  final String? salary;
  final String? mangal;
  final bool verifiedOnly;

  bool get active =>
      ageMin != null ||
      ageMax != null ||
      heightMin != null ||
      heightMax != null ||
      verifiedOnly ||
      _filled(state) ||
      _filled(city) ||
      _filled(religion) ||
      _filled(community) ||
      _filled(motherTongue) ||
      _filled(diet) ||
      _filled(marital) ||
      _filled(education) ||
      _filled(occupation) ||
      _filled(salary) ||
      _filled(mangal);

  Map<String, String> toQuery() {
    final q = <String, String>{};
    if (ageMin != null) q['age_min'] = '$ageMin';
    if (ageMax != null) q['age_max'] = '$ageMax';
    if (heightMin != null) q['height_min'] = '$heightMin';
    if (heightMax != null) q['height_max'] = '$heightMax';
    _put(q, 'state', state);
    _put(q, 'city', city);
    _put(q, 'religion', religion);
    _put(q, 'community', community);
    _put(q, 'mother_tongue', motherTongue);
    _put(q, 'diet', diet);
    _put(q, 'marital_status', marital);
    _put(q, 'education_level', education);
    _put(q, 'occupation', occupation);
    _put(q, 'monthly_salary', salary);
    _put(q, 'mangal_dosh', mangal);
    if (verifiedOnly) q['verified'] = '1';
    return q;
  }

  static bool _filled(String? value) => value != null && value.trim().isNotEmpty;

  static void _put(Map<String, String> q, String key, String? value) {
    final text = value?.trim() ?? '';
    if (text.isNotEmpty) q[key] = text;
  }
}

Future<DiscoverFilters?> showDiscoverFilters(
  BuildContext context,
  DiscoverFilters current,
) {
  return showModalBottomSheet<DiscoverFilters>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    backgroundColor: Colors.white,
    builder: (ctx) {
      final inset = MediaQuery.viewInsetsOf(ctx).bottom;
      final maxHeight = MediaQuery.sizeOf(ctx).height * 0.9;
      final height = (maxHeight - inset).clamp(320.0, maxHeight);
      return Padding(
        padding: EdgeInsets.only(bottom: inset),
        child: SizedBox(
          height: height,
          child: _FilterSheet(initial: current),
        ),
      );
    },
  );
}

class _FilterSheet extends StatefulWidget {
  const _FilterSheet({required this.initial});

  final DiscoverFilters initial;

  @override
  State<_FilterSheet> createState() => _FilterSheetState();
}

class _FilterSheetState extends State<_FilterSheet> {
  late int? _ageMin;
  late int? _ageMax;
  late int? _heightMin;
  late int? _heightMax;
  late String? _state;
  late String? _religion;
  late String? _motherTongue;
  late String? _diet;
  late String? _marital;
  late String? _education;
  late String? _occupation;
  late String? _salary;
  late String? _mangal;
  late bool _verifiedOnly;
  late String _city;
  late String? _community;

  @override
  void initState() {
    super.initState();
    final f = widget.initial;
    _ageMin = f.ageMin;
    _ageMax = f.ageMax;
    _heightMin = f.heightMin;
    _heightMax = f.heightMax;
    _state = f.state;
    _religion = f.religion;
    _motherTongue = f.motherTongue;
    _diet = f.diet;
    _marital = f.marital;
    _education = f.education;
    _occupation = f.occupation;
    _salary = f.salary;
    _mangal = f.mangal;
    _verifiedOnly = f.verifiedOnly;
    _city = f.city ?? '';
    _community = f.community;
  }

  DiscoverFilters _draft() {
    var ageMin = _ageMin;
    var ageMax = _ageMax;
    if (ageMin != null && ageMax != null && ageMin > ageMax) {
      final swap = ageMin;
      ageMin = ageMax;
      ageMax = swap;
    }
    var heightMin = _heightMin;
    var heightMax = _heightMax;
    if (heightMin != null && heightMax != null && heightMin > heightMax) {
      final swap = heightMin;
      heightMin = heightMax;
      heightMax = swap;
    }
    final city = _city.trim();
    return DiscoverFilters(
      ageMin: ageMin,
      ageMax: ageMax,
      heightMin: heightMin,
      heightMax: heightMax,
      state: _blank(_state),
      city: city.isEmpty ? null : city,
      religion: _blank(_religion),
      community: _blank(_community),
      motherTongue: _blank(_motherTongue),
      diet: _blank(_diet),
      marital: _blank(_marital),
      education: _blank(_education),
      occupation: _blank(_occupation),
      salary: _blank(_salary),
      mangal: _blank(_mangal),
      verifiedOnly: _verifiedOnly,
    );
  }

  String? _blank(String? value) {
    final text = value?.trim() ?? '';
    return text.isEmpty ? null : text;
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 12, 8),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  t('Filters'),
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              TextButton(
                onPressed: () =>
                    Navigator.of(context).pop(const DiscoverFilters()),
                child: Text(t('Clear filters')),
              ),
            ],
          ),
        ),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
            children: [
              _rangeLabel('Age'),
              Row(
                children: [
                  Expanded(
                    child: _intChoice(
                      label: 'From',
                      value: _ageMin,
                      options: OnboardingData.ageOptions,
                      onChanged: (v) => setState(() => _ageMin = v),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _intChoice(
                      label: 'To',
                      value: _ageMax,
                      options: OnboardingData.ageOptions,
                      onChanged: (v) => setState(() => _ageMax = v),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              _rangeLabel('Height'),
              Row(
                children: [
                  Expanded(
                    child: _intChoice(
                      label: 'From',
                      value: _heightMin,
                      options: OnboardingData.heightOptionsCm
                          .map(int.parse)
                          .toList(),
                      display: (n) => OnboardingData.heightLabel('$n'),
                      onChanged: (v) => setState(() => _heightMin = v),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _intChoice(
                      label: 'To',
                      value: _heightMax,
                      options: OnboardingData.heightOptionsCm
                          .map(int.parse)
                          .toList(),
                      display: (n) => OnboardingData.heightLabel('$n'),
                      onChanged: (v) => setState(() => _heightMax = v),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              _choice(
                key: ValueKey('filter-state-${_state ?? ''}'),
                label: 'State',
                value: _state,
                options: OnboardingData.indianStates,
                icon: Iconsax.location,
                onChanged: (v) => setState(() => _state = v),
              ),
              const SizedBox(height: 12),
              CitySearchField(
                initialCity: widget.initial.city,
                onSelected: (v) => _city = v,
                onStateSelected: (stateName) {
                  final wanted = stateName.toLowerCase();
                  String? match;
                  for (final name in OnboardingData.indianStates) {
                    if (name.toLowerCase() == wanted) {
                      match = name;
                      break;
                    }
                  }
                  if (match != null && match != _state && mounted) {
                    setState(() => _state = match);
                  }
                },
              ),
              const SizedBox(height: 12),
              _choice(
                label: 'Religion',
                value: _religion,
                options: OnboardingData.religions,
                icon: Iconsax.moon,
                onChanged: (v) => setState(() => _religion = v),
              ),
              const SizedBox(height: 12),
              CommunityDropdown(
                label: 'Community',
                placeholder: 'Any',
                value: _community,
                onChanged: (v) => setState(() => _community = v),
              ),
              const SizedBox(height: 12),
              _choice(
                label: 'Mother tongue',
                value: _motherTongue,
                options: OnboardingData.motherTongues,
                icon: Iconsax.language_square,
                onChanged: (v) => setState(() => _motherTongue = v),
              ),
              const SizedBox(height: 12),
              _choice(
                label: 'Diet',
                value: _diet,
                options: OnboardingData.diets,
                icon: Iconsax.cake,
                onChanged: (v) => setState(() => _diet = v),
              ),
              const SizedBox(height: 12),
              _choice(
                label: 'Marital status',
                value: _marital,
                options: OnboardingData.maritalStatuses,
                icon: Iconsax.heart,
                onChanged: (v) => setState(() => _marital = v),
              ),
              const SizedBox(height: 12),
              _choice(
                label: 'Education level',
                value: _education,
                options: OnboardingData.educationLevels,
                icon: Iconsax.teacher,
                onChanged: (v) => setState(() => _education = v),
              ),
              const SizedBox(height: 12),
              _choice(
                label: 'Occupation',
                value: _occupation,
                options: OnboardingData.occupations,
                icon: Iconsax.briefcase,
                onChanged: (v) => setState(() => _occupation = v),
              ),
              const SizedBox(height: 12),
              _choice(
                label: 'Monthly salary',
                value: _salary,
                options: OnboardingData.salaryRanges,
                icon: Iconsax.wallet_2,
                onChanged: (v) => setState(() => _salary = v),
              ),
              const SizedBox(height: 12),
              _choice(
                label: 'Mangal Dosh',
                value: _mangal,
                options: OnboardingData.mangalDoshOptions,
                icon: Iconsax.star,
                onChanged: (v) => setState(() => _mangal = v),
              ),
              const SizedBox(height: 4),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                activeThumbColor: MangalamTheme.maroon,
                title: Text(t('Verified only')),
                value: _verifiedOnly,
                onChanged: (v) => setState(() => _verifiedOnly = v),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
          child: SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: () => Navigator.of(context).pop(_draft()),
              child: Text(t('Apply')),
            ),
          ),
        ),
      ],
    );
  }

  Widget _rangeLabel(String label) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        t(label),
        style: Theme.of(context).textTheme.titleSmall?.copyWith(
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }

  Widget _intChoice({
    required String label,
    required int? value,
    required List<int> options,
    required ValueChanged<int?> onChanged,
    String Function(int)? display,
  }) {
    final current = value != null && options.contains(value) ? value : 0;
    return DropdownButtonFormField<int>(
      initialValue: current,
      isExpanded: true,
      decoration: InputDecoration(labelText: t(label)),
      items: [
        DropdownMenuItem(value: 0, child: Text(t('Any'))),
        ...options.map(
          (n) => DropdownMenuItem(
            value: n,
            child: Text(
              display != null ? display(n) : '$n',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ),
      ],
      onChanged: (v) => onChanged(v == null || v == 0 ? null : v),
    );
  }

  Widget _choice({
    Key? key,
    required String label,
    required String? value,
    required List<String> options,
    required IconData icon,
    required ValueChanged<String?> onChanged,
  }) {
    final current = value != null && options.contains(value) ? value : '';
    return DropdownButtonFormField<String>(
      key: key,
      initialValue: current,
      isExpanded: true,
      decoration: InputDecoration(
        labelText: t(label),
        prefixIcon: Icon(icon),
      ),
      items: [
        DropdownMenuItem(
          value: '',
          child: Text(
            t('Any'),
            style: const TextStyle(color: MangalamTheme.muted),
          ),
        ),
        ...options.map(
          (o) => DropdownMenuItem(
            value: o,
            child: Text(t(o), maxLines: 1, overflow: TextOverflow.ellipsis),
          ),
        ),
      ],
      onChanged: (v) => onChanged(v == null || v.isEmpty ? null : v),
    );
  }
}

import 'package:flutter/material.dart';

import '../../services/api_client.dart';
import 'onboarding_data.dart';
import 'onboarding_widgets.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key, required this.onCompleted});

  final VoidCallback onCompleted;

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _api = ApiClient();
  final _controller = PageController();
  static const _totalSteps = 7;
  int _step = 0;
  bool _saving = false;
  String? _error;

  // Step 1: Profile for
  String? _profileFor;

  // Step 2: Basic
  String? _gender;
  DateTime? _dob;
  final _name = TextEditingController();

  // Step 3: Religion
  String? _religion;
  final _community = TextEditingController();
  String? _motherTongue;
  String? _diet;

  // Step 4: Location
  final _city = TextEditingController();
  String? _state;

  // Step 5: Physical & Career
  String? _height;
  String? _maritalStatus;
  String? _education;
  String? _occupation;
  String? _salary;

  // Step 6: Astrology
  String? _mangalDosh;
  final _birthTime = TextEditingController();
  final _birthPlace = TextEditingController();

  // Step 7: Partner preferences
  final _pAgeMin = TextEditingController();
  final _pAgeMax = TextEditingController();
  String? _pDiet;
  String? _pMotherTongue;

  @override
  void dispose() {
    _name.dispose();
    _community.dispose();
    _city.dispose();
    _birthTime.dispose();
    _birthPlace.dispose();
    _pAgeMin.dispose();
    _pAgeMax.dispose();
    _controller.dispose();
    super.dispose();
  }

  bool get _canContinue {
    switch (_step) {
      case 0:
        return _profileFor != null;
      case 1:
        return _gender != null && _dob != null && _name.text.trim().isNotEmpty;
      case 2:
        return _religion != null && _motherTongue != null && _diet != null;
      case 3:
        return _city.text.trim().isNotEmpty && _state != null;
      case 4:
        return _height != null && _maritalStatus != null;
      case 5:
        return _mangalDosh != null;
      case 6:
        return true;
      default:
        return false;
    }
  }

  void _next() {
    if (!_canContinue) {
      setState(() => _error = 'Please fill in the required fields.');
      return;
    }
    setState(() => _error = null);
    if (_step < _totalSteps - 1) {
      _controller.nextPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOutCubic,
      );
    } else {
      _save();
    }
  }

  void _back() {
    if (_step > 0) {
      _controller.previousPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOutCubic,
      );
    }
  }

  Future<void> _save() async {
    if (!mounted) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final body = <String, dynamic>{
        'display_name': _name.text.trim(),
        'gender': _gender,
        'date_of_birth': _dob!.toIso8601String().split('T').first,
        'profile_for': _profileFor,
        'religion': _religion,
        'community': _community.text.trim(),
        'mother_tongue': _motherTongue,
        'diet': _diet,
        'city': _city.text.trim(),
        'state': _state,
        'country': 'India',
        'height_cm': int.tryParse(_height ?? ''),
        'marital_status': _maritalStatus,
        'education_level': _education,
        'occupation': _occupation,
        'monthly_salary': _salary,
        'mangal_dosh': _mangalDosh,
        'birth_time': _birthTime.text.trim(),
        'birth_place': _birthPlace.text.trim(),
      };
      final pp = <String, dynamic>{};
      final amin = int.tryParse(_pAgeMin.text.trim());
      final amax = int.tryParse(_pAgeMax.text.trim());
      if (amin != null) pp['age_min'] = amin;
      if (amax != null) pp['age_max'] = amax;
      if (_pDiet != null) pp['diet'] = _pDiet;
      if (_pMotherTongue != null) pp['mother_tongue'] = _pMotherTongue;
      if (pp.isNotEmpty) body['partner_preferences'] = pp;
      body.removeWhere((k, v) => v == null || v == '');
      await _api.patch('/v1/me', body);
      widget.onCompleted();
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _pickDob() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime(now.year - 25, now.month, now.day),
      firstDate: DateTime(now.year - 80),
      lastDate: DateTime(now.year - 18, now.month, now.day),
    );
    if (picked != null) setState(() => _dob = picked);
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
              child: OnboardingProgress(current: _step, total: _totalSteps),
            ),
            Expanded(
              child: PageView(
                controller: _controller,
                physics: const NeverScrollableScrollPhysics(),
                onPageChanged: (i) => setState(() => _step = i),
                children: [
                  _stepProfileFor(),
                  _stepBasic(),
                  _stepReligion(),
                  _stepLocation(),
                  _stepPhysical(),
                  _stepAstrology(),
                  _stepPreferences(),
                ],
              ),
            ),
            _bottomBar(cs),
          ],
        ),
      ),
    );
  }

  Widget _bottomBar(ColorScheme cs) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
      decoration: BoxDecoration(
        color: cs.surface,
        border: Border(top: BorderSide(color: cs.outlineVariant)),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (_error != null) ...[
              Text(_error!, style: TextStyle(color: cs.error, fontSize: 13)),
              const SizedBox(height: 8),
            ],
            Row(
              children: [
                if (_step > 0)
                  OutlinedButton(
                    onPressed: _saving ? null : _back,
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size(56, 52),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: const Text('Back'),
                  ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton(
                    onPressed: _saving ? null : _next,
                    style: FilledButton.styleFrom(
                      minimumSize: const Size.fromHeight(52),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: _saving
                        ? const SizedBox(height: 22, width: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : Text(_step == _totalSteps - 1 ? 'Finish' : 'Continue'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _stepContent({required String title, String? subtitle, required List<Widget> children}) {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          StepHeader(title: title, subtitle: subtitle),
          const SizedBox(height: 24),
          ...children,
        ],
      ),
    );
  }

  Widget _stepProfileFor() {
    return _stepContent(
      title: 'Who is this profile for?',
      subtitle: 'Tell us whose profile you\'re creating.',
      children: [
        ...OnboardingData.profileForOptions.map((o) => Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: OptionCard(
            label: o,
            selected: _profileFor == o,
            onTap: () => setState(() => _profileFor = o),
            icon: o == 'Self' ? Icons.person : Icons.group,
          ),
        )),
      ],
    );
  }

  Widget _stepBasic() {
    return _stepContent(
      title: 'Basic details',
      subtitle: 'Let\'s start with the essentials.',
      children: [
        TextField(
          controller: _name,
          textCapitalization: TextCapitalization.words,
          decoration: const InputDecoration(labelText: 'Full name', border: OutlineInputBorder()),
        ),
        const SizedBox(height: 16),
        _dropdown('Gender', _gender, OnboardingData.genders, (v) => setState(() => _gender = v)),
        const SizedBox(height: 16),
        OutlinedButton.icon(
          onPressed: _pickDob,
          icon: const Icon(Icons.calendar_today_outlined),
          label: Text(_dob == null ? 'Date of birth' : 'Born ${_dob!.toIso8601String().split('T').first}'),
          style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(56), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
        ),
      ],
    );
  }

  Widget _stepReligion() {
    return _stepContent(
      title: 'Religion & community',
      subtitle: 'Helps us find matches within your community.',
      children: [
        _dropdown('Religion', _religion, OnboardingData.religions, (v) => setState(() => _religion = v)),
        const SizedBox(height: 16),
        TextField(
          controller: _community,
          decoration: const InputDecoration(labelText: 'Community / Caste (optional)', border: OutlineInputBorder()),
        ),
        const SizedBox(height: 16),
        _dropdown('Mother tongue', _motherTongue, OnboardingData.motherTongues, (v) => setState(() => _motherTongue = v)),
        const SizedBox(height: 16),
        _dropdown('Diet', _diet, OnboardingData.diets, (v) => setState(() => _diet = v)),
      ],
    );
  }

  Widget _stepLocation() {
    return _stepContent(
      title: 'Where do you live?',
      subtitle: 'So we can show nearby matches.',
      children: [
        TextField(
          controller: _city,
          textCapitalization: TextCapitalization.words,
          decoration: const InputDecoration(labelText: 'City', border: OutlineInputBorder()),
        ),
        const SizedBox(height: 16),
        _dropdown('State', _state, OnboardingData.indianStates, (v) => setState(() => _state = v)),
      ],
    );
  }

  Widget _stepPhysical() {
    return _stepContent(
      title: 'About you',
      subtitle: 'A few more details about you.',
      children: [
        _dropdown(
          'Height',
          _height,
          OnboardingData.heightOptionsCm,
          (v) => setState(() => _height = v),
          labelFor: OnboardingData.heightLabel,
        ),
        const SizedBox(height: 16),
        _dropdown('Marital status', _maritalStatus, OnboardingData.maritalStatuses, (v) => setState(() => _maritalStatus = v)),
        const SizedBox(height: 16),
        _dropdown('Education', _education, OnboardingData.educationLevels, (v) => setState(() => _education = v)),
        const SizedBox(height: 16),
        _dropdown('Occupation', _occupation, OnboardingData.occupations, (v) => setState(() => _occupation = v)),
        const SizedBox(height: 16),
        _dropdown('Monthly income', _salary, OnboardingData.salaryRanges, (v) => setState(() => _salary = v)),
      ],
    );
  }

  Widget _stepAstrology() {
    return _stepContent(
      title: 'Astrology details',
      subtitle: 'Important for family matching in Indian matrimony.',
      children: [
        _dropdown('Mangal Dosh', _mangalDosh, OnboardingData.mangalDoshOptions, (v) => setState(() => _mangalDosh = v)),
        const SizedBox(height: 16),
        TextField(
          controller: _birthTime,
          decoration: const InputDecoration(labelText: 'Birth time (HH:MM, optional)', border: OutlineInputBorder()),
        ),
        const SizedBox(height: 16),
        TextField(
          controller: _birthPlace,
          decoration: const InputDecoration(labelText: 'Birth place (optional)', border: OutlineInputBorder()),
        ),
      ],
    );
  }

  Widget _stepPreferences() {
    return _stepContent(
      title: 'Partner preferences',
      subtitle: 'What are you looking for? (optional)',
      children: [
        Row(
          children: [
            Expanded(child: TextField(controller: _pAgeMin, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Min age', border: OutlineInputBorder()))),
            const SizedBox(width: 12),
            Expanded(child: TextField(controller: _pAgeMax, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Max age', border: OutlineInputBorder()))),
          ],
        ),
        const SizedBox(height: 16),
        _dropdown('Preferred diet', _pDiet, OnboardingData.diets, (v) => setState(() => _pDiet = v)),
        const SizedBox(height: 16),
        _dropdown('Preferred mother tongue', _pMotherTongue, OnboardingData.motherTongues, (v) => setState(() => _pMotherTongue = v)),
      ],
    );
  }

  Widget _dropdown(String label, String? value, List<String> items, ValueChanged<String?> onChanged, {String Function(String)? labelFor}) {
    return DropdownButtonFormField<String>(
      initialValue: value,
      decoration: InputDecoration(labelText: label, border: const OutlineInputBorder()),
      items: items
          .map((e) => DropdownMenuItem(value: e, child: Text(labelFor != null ? labelFor(e) : e)))
          .toList(),
      onChanged: onChanged,
    );
  }
}

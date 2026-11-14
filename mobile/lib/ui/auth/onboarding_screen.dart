import 'package:flutter/material.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';

import '../../l10n/app_locale.dart';
import '../../services/api_client.dart';
import '../../services/razorpay_checkout.dart';
import 'registration_membership.dart';
import 'sign_out_flow.dart';
import '../core/birth_time_field.dart';
import '../core/city_search_field.dart';
import '../core/community_dropdown.dart';
import '../core/mangalam_theme.dart';
import '../core/photo_picker_section.dart';
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
  final _checkout = RazorpayCheckout();
  final _controller = PageController();
  static const _totalSteps = 8;
  int _step = 0;
  bool _saving = false;
  String? _error;

  // Step 0: Photos
  List<String> _photoUrls = [];

  // Step 1: Profile for
  String? _profileFor;

  // Step 2: Basic
  String? _gender;
  DateTime? _dob;
  final _name = TextEditingController();

  // Step 3: Religion
  String? _religion;
  String? _community;
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

  // Step 2b: Contact (phone + whatsapp)
  final _phone = TextEditingController();
  final _whatsapp = TextEditingController();
  bool _phoneVisible = false;
  bool _photosVisible = true;

  // Step 6: Astrology
  String? _mangalDosh;
  final _birthTime = TextEditingController();
  final _birthPlace = TextEditingController();

  // Step 7: Partner preferences
  int? _pAgeMin;
  int? _pAgeMax;
  String? _pDiet;
  String? _pMotherTongue;

  // App language (asked during onboarding, saved to profiles.app_language)
  String _appLanguage = AppLocale.instance.code;

  @override
  void dispose() {
    _name.dispose();
    _city.dispose();
    _birthTime.dispose();
    _birthPlace.dispose();
    _phone.dispose();
    _whatsapp.dispose();
    _checkout.dispose();
    _controller.dispose();
    super.dispose();
  }

  bool get _canContinue {
    switch (_step) {
      case 0:
        return _photoUrls.isNotEmpty;
      case 1:
        return _profileFor != null;
      case 2:
        final digits = _phone.text.replaceAll(RegExp(r'\D'), '');
        return _gender != null &&
            _dob != null &&
            _name.text.trim().isNotEmpty &&
            digits.length >= 10;
      case 3:
        return _religion != null && _motherTongue != null && _diet != null;
      case 4:
        return _city.text.trim().isNotEmpty && _state != null;
      case 5:
        return _height != null && _maritalStatus != null;
      case 6:
        return _mangalDosh != null;
      case 7:
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
        duration: const Duration(milliseconds: 320),
        curve: Curves.easeOutCubic,
      );
    } else {
      _save();
    }
  }

  void _back() {
    if (_step > 0) {
      _controller.previousPage(
        duration: const Duration(milliseconds: 320),
        curve: Curves.easeOutCubic,
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
        'community': _community,
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
        'photo_urls': _photoUrls,
        'phone': '+91${_phone.text.replaceAll(RegExp(r'\D'), '')}',
        'whatsapp_number': _whatsapp.text.trim().isEmpty
            ? null
            : _whatsapp.text.trim(),
        'phone_visible': _phoneVisible,
        'preferences': {
          'photos_visible': _photosVisible,
          'membership_pending': true,
        },
      };
      final pp = <String, dynamic>{};
      if (_pAgeMin != null) pp['age_min'] = _pAgeMin;
      if (_pAgeMax != null) pp['age_max'] = _pAgeMax;
      if (_pDiet != null) pp['diet'] = _pDiet;
      if (_pMotherTongue != null) pp['mother_tongue'] = _pMotherTongue;
      if (pp.isNotEmpty) body['partner_preferences'] = pp;
      body['app_language'] = _appLanguage;
      body.removeWhere((k, v) => v == null || v == '');
      await _api.patch('/v1/me', body);
      if (!mounted) return;
      final joined = await offerRegistrationMembership(
        context: context,
        api: _api,
        checkout: _checkout,
      );
      if (!mounted) return;
      if (!joined) {
        setState(() {
          _error = 'Choose a membership to finish registration.';
        });
        return;
      }
      widget.onCompleted();
    } catch (e) {
      if (mounted) setState(() => _error = userFacingError(e));
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
      builder: (context, child) {
        final theme = Theme.of(context);
        return Theme(
          data: theme.copyWith(
            colorScheme: theme.colorScheme.copyWith(
              primary: MangalamTheme.maroon,
              onPrimary: Colors.white,
            ),
          ),
          child: child!,
        );
      },
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
              padding: const EdgeInsets.fromLTRB(16, 8, 8, 12),
              child: Row(
                children: [
                  Expanded(
                    child: OnboardingProgress(
                      current: _step,
                      total: _totalSteps,
                      onBack: _back,
                    ),
                  ),
                  TextButton(
                    onPressed: _saving ? null : () => confirmAndSignOut(context),
                    child: Text(t('Sign out')),
                  ),
                ],
              ),
            ),
            Expanded(
              child: PageView(
                controller: _controller,
                physics: const NeverScrollableScrollPhysics(),
                onPageChanged: (i) => setState(() => _step = i),
                children: [
                  _stepPhotos(),
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
        color: Colors.white,
        border: Border(top: BorderSide(color: cs.outlineVariant)),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (_error != null) ...[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: MangalamTheme.maroon.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  t(_error!),
                  style: const TextStyle(
                    color: MangalamTheme.maroon,
                    fontSize: 13,
                  ),
                ),
              ),
              const SizedBox(height: 10),
            ],
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _saving ? null : _next,
                child: _saving
                    ? const SizedBox(
                        height: 22,
                        width: 22,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : Text(
                        _step == _totalSteps - 1
                            ? t('Choose membership')
                            : 'Continue',
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _stepContent({
    required String title,
    String? subtitle,
    String? emoji,
    required List<Widget> children,
  }) {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          StepHeader(title: title, subtitle: subtitle, emoji: emoji),
          const SizedBox(height: 24),
          ...children,
        ],
      ),
    );
  }

  Widget _stepPhotos() {
    return _stepContent(
      title: 'Add your photos',
      subtitle:
          'Profiles with photos get up to 10× more interest. Add at least one.',
      emoji: '📸',
      children: [
        // Language selection (asked first during onboarding)
        DropdownButtonFormField<String>(
          initialValue: _appLanguage,
          decoration: InputDecoration(
            labelText: t('App language'),
            prefixIcon: Icon(Iconsax.global),
          ),
          items: OnboardingData.appLanguages
              .map((l) => DropdownMenuItem(value: l.code, child: Text(l.name)))
              .toList(),
          onChanged: (v) {
            final code = v ?? 'en';
            setState(() => _appLanguage = code);
            AppLocale.instance.set(code);
          },
        ),
        const SizedBox(height: 18),
        PhotoPickerSection(
          photoUrls: _photoUrls,
          onChanged: (urls) => setState(() => _photoUrls = urls),
        ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          value: _photosVisible,
          onChanged: (v) => setState(() => _photosVisible = v),
          title: Text(
            t('Share my photos'),
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
          ),
          subtitle: Text(
            t('If this is off, other members only see a blurred photo. They can ask you in chat.'),
            style: const TextStyle(fontSize: 12, color: MangalamTheme.muted, height: 1.35),
          ),
        ),
      ],
    );
  }

  Widget _stepProfileFor() {
    return _stepContent(
      title: 'Who is this profile for?',
      subtitle:
          'Tell us whose profile you\'re creating so we can personalize the experience.',
      emoji: '👤',
      children: [
        ...OnboardingData.profileForOptions.map(
          (o) => Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: OptionCard(
              label: o,
              selected: _profileFor == o,
              onTap: () => setState(() => _profileFor = o),
              icon: o == 'Self' ? Iconsax.user : Iconsax.profile_2user,
            ),
          ),
        ),
      ],
    );
  }

  Widget _stepBasic() {
    return _stepContent(
      title: 'Basic details',
      subtitle: 'Let\'s start with the essentials.',
      emoji: '📝',
      children: [
        TextField(
          controller: _name,
          textCapitalization: TextCapitalization.words,
          decoration: InputDecoration(
            labelText: t('Full name'),
            prefixIcon: Icon(Iconsax.user),
          ),
        ),
        const SizedBox(height: 14),
        _dropdown(
          'Gender',
          _gender,
          OnboardingData.genders,
          (v) => setState(() => _gender = v),
          icon: Iconsax.user,
        ),
        const SizedBox(height: 14),
        InkWell(
          onTap: _pickDob,
          borderRadius: BorderRadius.circular(14),
          child: IgnorePointer(
            child: InputDecorator(
              decoration: InputDecoration(
                labelText: t('Date of birth'),
                prefixIcon: const Icon(Iconsax.calendar),
                suffixIcon: _dob != null
                    ? const Icon(
                        Iconsax.tick_circle,
                        color: MangalamTheme.maroon,
                      )
                    : null,
              ),
              child: Text(
                _dob == null
                    ? t('Select date')
                    : '${_dob!.day.toString().padLeft(2, '0')} / ${_dob!.month.toString().padLeft(2, '0')} / ${_dob!.year}',
                style: TextStyle(
                  color: _dob == null ? MangalamTheme.muted : MangalamTheme.ink,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 14),
        TextField(
          controller: _phone,
          keyboardType: TextInputType.phone,
          decoration: InputDecoration(
            labelText: t('Phone number *'),
            prefixText: '+91 ',
            prefixIcon: Icon(Iconsax.call),
            helperText: t('Required. Other members cannot see this number unless you turn sharing on.'),
          ),
        ),
        const SizedBox(height: 14),
        TextField(
          controller: _whatsapp,
          keyboardType: TextInputType.phone,
          decoration: InputDecoration(
            labelText: t('WhatsApp number (optional)'),
            prefixText: '+91 ',
            prefixIcon: Icon(Iconsax.message),
          ),
        ),
        const SizedBox(height: 12),
        SwitchListTile(
          value: _phoneVisible,
          onChanged: (v) => setState(() => _phoneVisible = v),
          contentPadding: EdgeInsets.zero,
          title: Text(t('Share my phone number'),
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
          ),
          subtitle: Text(t('If this is off, other members can only ask for your number in chat.'),
            style: TextStyle(
              fontSize: 12,
              color: MangalamTheme.muted,
              height: 1.35,
            ),
          ),
          activeColor: MangalamTheme.maroon,
        ),
      ],
    );
  }

  Widget _stepReligion() {
    return _stepContent(
      title: 'Religion & community',
      subtitle: 'Helps us find matches within your community.',
      emoji: '🪔',
      children: [
        _dropdown(
          'Religion',
          _religion,
          OnboardingData.religions,
          (v) => setState(() => _religion = v),
          icon: Iconsax.book_1,
        ),
        const SizedBox(height: 14),
        CommunityDropdown(
          value: _community,
          onChanged: (v) => setState(() => _community = v),
        ),
        const SizedBox(height: 14),
        _dropdown(
          'Mother tongue',
          _motherTongue,
          OnboardingData.motherTongues,
          (v) => setState(() => _motherTongue = v),
          icon: Iconsax.translate,
        ),
        const SizedBox(height: 14),
        _dropdown(
          'Diet',
          _diet,
          OnboardingData.diets,
          (v) => setState(() => _diet = v),
          icon: Iconsax.cup,
        ),
      ],
    );
  }

  Widget _stepLocation() {
    return _stepContent(
      title: 'Where do you live?',
      subtitle: 'So we can show nearby matches first.',
      emoji: '📍',
      children: [
        CitySearchField(
          initialCity: _city.text,
          onSelected: (v) => setState(() => _city.text = v),
          onStateSelected: (stateName) {
            // Auto-fill the State dropdown if it matches a known state
            final match = OnboardingData.indianStates.firstWhere(
              (s) => s.toLowerCase() == stateName.toLowerCase(),
              orElse: () => '',
            );
            if (match.isNotEmpty) setState(() => _state = match);
          },
        ),
        const SizedBox(height: 14),
        _dropdown(
          'State',
          _state,
          OnboardingData.indianStates,
          (v) => setState(() => _state = v),
          icon: Iconsax.map,
        ),
      ],
    );
  }

  Widget _stepPhysical() {
    return _stepContent(
      title: 'About you',
      subtitle: 'A few more details to complete your profile.',
      emoji: '💼',
      children: [
        _dropdown(
          'Height',
          _height,
          OnboardingData.heightOptionsCm,
          (v) => setState(() => _height = v),
          labelFor: OnboardingData.heightLabel,
          icon: Iconsax.arrow_swap,
        ),
        const SizedBox(height: 14),
        _dropdown(
          'Marital status',
          _maritalStatus,
          OnboardingData.maritalStatuses,
          (v) => setState(() => _maritalStatus = v),
          icon: Iconsax.heart,
        ),
        const SizedBox(height: 14),
        _dropdown(
          'Education',
          _education,
          OnboardingData.educationLevels,
          (v) => setState(() => _education = v),
          icon: Iconsax.book_saved,
        ),
        const SizedBox(height: 14),
        _dropdown(
          'Occupation',
          _occupation,
          OnboardingData.occupations,
          (v) => setState(() => _occupation = v),
          icon: Iconsax.briefcase,
        ),
        const SizedBox(height: 14),
        _dropdown(
          'Monthly income',
          _salary,
          OnboardingData.salaryRanges,
          (v) => setState(() => _salary = v),
          icon: Iconsax.wallet,
        ),
      ],
    );
  }

  Widget _stepAstrology() {
    return _stepContent(
      title: 'Astrology details',
      subtitle: 'Important for family matching in Indian matrimony.',
      emoji: '🪐',
      children: [
        _dropdown(
          'Mangal Dosh',
          _mangalDosh,
          OnboardingData.mangalDoshOptions,
          (v) => setState(() => _mangalDosh = v),
          icon: Iconsax.flash,
        ),
        const SizedBox(height: 14),
        BirthTimeField(
          controller: _birthTime,
          label: 'Birth time (optional)',
        ),
        const SizedBox(height: 14),
        CitySearchField(
          label: 'Birth place (optional)',
          icon: Iconsax.location,
          includeStateInValue: true,
          initialCity: _birthPlace.text,
          onSelected: (v) => setState(() => _birthPlace.text = v),
        ),
      ],
    );
  }

  Widget _stepPreferences() {
    return _stepContent(
      title: 'Partner preferences',
      subtitle: 'What are you looking for? (optional)',
      emoji: '💞',
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: DropdownButtonFormField<int>(
                initialValue: _pAgeMin,
                isExpanded: true,
                decoration: InputDecoration(
                  labelText: t('Min age'),
                  prefixIcon: Icon(Iconsax.arrow_up),
                ),
                items: OnboardingData.ageOptions
                    .map(
                      (a) =>
                          DropdownMenuItem(
                            value: a,
                            child: Text(tf('{n} years', {'n': '$a'})),
                          ),
                    )
                    .toList(),
                onChanged: (v) => setState(() => _pAgeMin = v),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: DropdownButtonFormField<int>(
                initialValue: _pAgeMax,
                isExpanded: true,
                decoration: InputDecoration(
                  labelText: t('Max age'),
                  prefixIcon: Icon(Iconsax.arrow_down),
                ),
                items: OnboardingData.ageOptions
                    .where((a) => _pAgeMin == null || a >= _pAgeMin!)
                    .map(
                      (a) =>
                          DropdownMenuItem(
                            value: a,
                            child: Text(tf('{n} years', {'n': '$a'})),
                          ),
                    )
                    .toList(),
                onChanged: (v) => setState(() => _pAgeMax = v),
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),
        _dropdown(
          'Preferred diet',
          _pDiet,
          OnboardingData.diets,
          (v) => setState(() => _pDiet = v),
          icon: Iconsax.cup,
        ),
        const SizedBox(height: 14),
        _dropdown(
          'Preferred mother tongue',
          _pMotherTongue,
          OnboardingData.motherTongues,
          (v) => setState(() => _pMotherTongue = v),
          icon: Iconsax.translate,
        ),
      ],
    );
  }

  Widget _dropdown(
    String label,
    String? value,
    List<String> items,
    ValueChanged<String?> onChanged, {
    String Function(String)? labelFor,
    IconData? icon,
  }) {
    return DropdownButtonFormField<String>(
      initialValue: value,
      isExpanded: true,
      menuMaxHeight: 320,
      decoration: InputDecoration(
        labelText: t(label),
        prefixIcon: icon != null ? Icon(icon) : null,
      ),
      items: items
          .map(
            (e) => DropdownMenuItem(
              value: e,
              child: Text(
                t(labelFor != null ? labelFor(e) : e),
                overflow: TextOverflow.ellipsis,
                maxLines: 1,
                softWrap: false,
              ),
            ),
          )
          .toList(),
      onChanged: onChanged,
    );
  }
}

import 'package:flutter/material.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../l10n/app_locale.dart';
import '../../services/api_client.dart';
import '../auth/onboarding_data.dart';
import '../core/birth_time_field.dart';
import '../core/city_search_field.dart';
import '../core/community_dropdown.dart';
import '../core/mangalam_theme.dart'
    show MangalamCard, MangalamSectionHeader, MangalamTheme;
import '../core/photo_picker_section.dart';

/// Digits of an Indian mobile, without +91 or a leading 0.
String nationalMobile(String raw) {
  var digits = raw.replaceAll(RegExp(r'\D'), '');
  if (digits.length == 12 && digits.startsWith('91')) {
    digits = digits.substring(2);
  } else if (digits.length == 11 && digits.startsWith('0')) {
    digits = digits.substring(1);
  }
  return digits;
}

class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({super.key});

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  final _api = ApiClient();
  final _name = TextEditingController();
  final _city = TextEditingController();
  final _state = TextEditingController();
  final _community = TextEditingController();
  final _motherTongue = TextEditingController();
  final _diet = TextEditingController();
  final _height = TextEditingController();
  final _profileFor = TextEditingController();
  final _marital = TextEditingController();
  final _bio = TextEditingController();
  final _occupation = TextEditingController();
  final _education = TextEditingController();
  final _salary = TextEditingController();
  final _phone = TextEditingController();
  final _whatsapp = TextEditingController();
  final _mangal = TextEditingController();
  final _birthTime = TextEditingController();
  final _birthPlace = TextEditingController();
  final _dob = TextEditingController();

  int? _pAgeMin;
  int? _pAgeMax;
  final _pLocation = TextEditingController();
  final _pHeight = TextEditingController();
  final _pDiet = TextEditingController();
  final _pMarital = TextEditingController();
  final _pTongue = TextEditingController();
  final _pMangal = TextEditingController();
  final _pOccupation = TextEditingController();
  final _pSalary = TextEditingController();
  final _pEducation = TextEditingController();

  String? _gender;
  bool _phoneVisible = false;
  bool _photosVisible = true;
  Map<String, dynamic> _preferences = {};
  bool _loading = true;
  bool _saving = false;
  List<String> _photoUrls = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _name.dispose();
    _city.dispose();
    _state.dispose();
    _community.dispose();
    _motherTongue.dispose();
    _diet.dispose();
    _height.dispose();
    _profileFor.dispose();
    _marital.dispose();
    _bio.dispose();
    _occupation.dispose();
    _education.dispose();
    _salary.dispose();
    _phone.dispose();
    _whatsapp.dispose();
    _mangal.dispose();
    _birthTime.dispose();
    _birthPlace.dispose();
    _dob.dispose();
    _pLocation.dispose();
    _pHeight.dispose();
    _pDiet.dispose();
    _pMarital.dispose();
    _pTongue.dispose();
    _pMangal.dispose();
    _pOccupation.dispose();
    _pSalary.dispose();
    _pEducation.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    if (!mounted) return;
    setState(() => _loading = true);
    try {
      final json = await _api.get('/v1/me') as Map<String, dynamic>;
      final p = json['profile'] as Map<String, dynamic>? ?? {};
      _name.text = p['display_name']?.toString() ?? '';
      _city.text = p['city']?.toString() ?? '';
      _state.text = p['state']?.toString() ?? '';
      _community.text = p['community']?.toString() ?? '';
      _motherTongue.text = p['mother_tongue']?.toString() ?? '';
      _diet.text = p['diet']?.toString() ?? '';
      _height.text = p['height_cm']?.toString() ?? '';
      _profileFor.text = p['profile_for']?.toString() ?? '';
      _marital.text = p['marital_status']?.toString() ?? '';
      _bio.text = p['bio']?.toString() ?? '';
      _gender = p['gender'] as String?;
      _phoneVisible = p['phone_visible'] == true;
      final prefs = p['preferences'];
      _preferences = prefs is Map
          ? prefs.map((key, value) => MapEntry(key.toString(), value))
          : {};
      _photosVisible = _preferences['photos_visible'] != false;
      _occupation.text = p['occupation']?.toString() ?? '';
      _education.text = p['education_level']?.toString() ?? '';
      _salary.text = p['monthly_salary']?.toString() ?? '';
      _phone.text = nationalMobile(p['phone']?.toString() ?? '');
      _whatsapp.text = p['whatsapp_number']?.toString() ?? '';
      _mangal.text = p['mangal_dosh']?.toString() ?? '';
      _birthTime.text = p['birth_time']?.toString() ?? '';
      _birthPlace.text = p['birth_place']?.toString() ?? '';
      _photoUrls =
          (p['photo_urls'] as List<dynamic>?)?.cast<String>() ?? const [];
      if (p['date_of_birth'] != null) {
        _dob.text = p['date_of_birth'].toString().split('T').first;
      }
      final pp = p['partner_preferences'];
      if (pp is Map) {
        _pAgeMin = (pp['age_min'] is int)
            ? pp['age_min'] as int
            : int.tryParse(pp['age_min']?.toString() ?? '');
        _pAgeMax = (pp['age_max'] is int)
            ? pp['age_max'] as int
            : int.tryParse(pp['age_max']?.toString() ?? '');
        _pLocation.text = pp['location']?.toString() ?? '';
        _pHeight.text = pp['height']?.toString() ?? '';
        _pDiet.text = pp['diet']?.toString() ?? '';
        _pMarital.text = pp['marital_status']?.toString() ?? '';
        _pTongue.text = pp['mother_tongue']?.toString() ?? '';
        _pMangal.text = pp['mangal_dosh']?.toString() ?? '';
        _pOccupation.text = pp['occupation']?.toString() ?? '';
        _pSalary.text = pp['monthly_salary']?.toString() ?? '';
        _pEducation.text = pp['education_level']?.toString() ?? '';
      }
    } catch (_) {
      /* snack from save */
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    if (!mounted) return;
    final phone = nationalMobile(_phone.text);
    if (phone.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(t('Phone number is required.'))),
      );
      return;
    }
    if (phone.length != 10) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(t('Enter a 10-digit mobile number.'))),
      );
      return;
    }
    setState(() => _saving = true);
    try {
      final h = int.tryParse(_height.text.trim());
      final body = <String, dynamic>{'display_name': _name.text.trim()};
      final city = _city.text.trim();
      final state = _state.text.trim();
      final community = _community.text.trim();
      final tongue = _motherTongue.text.trim();
      final diet = _diet.text.trim();
      final profileFor = _profileFor.text.trim();
      final marital = _marital.text.trim();
      final bio = _bio.text.trim();
      if (city.isNotEmpty) body['city'] = city;
      if (state.isNotEmpty) body['state'] = state;
      if (community.isNotEmpty) body['community'] = community;
      if (tongue.isNotEmpty) body['mother_tongue'] = tongue;
      if (diet.isNotEmpty) body['diet'] = diet;
      if (h != null && h >= 100 && h <= 250) body['height_cm'] = h;
      if (profileFor.isNotEmpty) body['profile_for'] = profileFor;
      if (marital.isNotEmpty) body['marital_status'] = marital;
      if (bio.isNotEmpty) body['bio'] = bio;
      if (_gender != null) body['gender'] = _gender;
      body['phone_visible'] = _phoneVisible;
      body['preferences'] = {
        ..._preferences,
        'photos_visible': _photosVisible,
      };
      final whatsapp = _whatsapp.text.trim();
      body['phone'] = '+91$phone';
      if (whatsapp.isNotEmpty) body['whatsapp_number'] = whatsapp;
      if (_photoUrls.isNotEmpty) body['photo_urls'] = _photoUrls;

      final occ = _occupation.text.trim();
      final edu = _education.text.trim();
      final sal = _salary.text.trim();
      final mangal = _mangal.text.trim();
      final bt = _birthTime.text.trim();
      final bp = _birthPlace.text.trim();
      if (occ.isNotEmpty) body['occupation'] = occ;
      if (edu.isNotEmpty) body['education_level'] = edu;
      if (sal.isNotEmpty) body['monthly_salary'] = sal;
      if (mangal.isNotEmpty) body['mangal_dosh'] = mangal;
      if (bt.isNotEmpty) body['birth_time'] = bt;
      if (bp.isNotEmpty) body['birth_place'] = bp;
      final dob = _dob.text.trim();
      if (dob.isNotEmpty) body['date_of_birth'] = dob;

      final pp = <String, dynamic>{};
      void put(String k, String v) {
        if (v.isNotEmpty) pp[k] = v;
      }

      if (_pAgeMin != null) pp['age_min'] = _pAgeMin;
      if (_pAgeMax != null) pp['age_max'] = _pAgeMax;
      put('location', _pLocation.text.trim());
      put('height', _pHeight.text.trim());
      put('diet', _pDiet.text.trim());
      put('marital_status', _pMarital.text.trim());
      put('mother_tongue', _pTongue.text.trim());
      put('mangal_dosh', _pMangal.text.trim());
      put('occupation', _pOccupation.text.trim());
      put('monthly_salary', _pSalary.text.trim());
      put('education_level', _pEducation.text.trim());
      if (pp.isNotEmpty) body['partner_preferences'] = pp;

      await _api.patch('/v1/me', body);
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(t('Saved'))));
        Navigator.of(context).pop(true);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(t(userFacingError(e)))));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(t('Edit profile'))),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: MangalamTheme.maroon),
            )
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
              children: [
                _section(
                  icon: Iconsax.camera,
                  title: 'Photos',
                  children: [
                    PhotoPickerSection(
                      photoUrls: _photoUrls,
                      onChanged: (urls) => setState(() => _photoUrls = urls),
                    ),
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(t('Share my photos')),
                      subtitle: Text(
                        t('If this is off, other members only see a blurred photo. They can ask you in chat.'),
                        style: const TextStyle(fontSize: 12, color: MangalamTheme.muted),
                      ),
                      value: _photosVisible,
                      onChanged: (v) => setState(() => _photosVisible = v),
                    ),
                  ],
                ),
                _section(
                  icon: Iconsax.user,
                  title: 'Basic',
                  children: [
                    _field(_name, 'Display name', icon: Iconsax.user),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      initialValue: _gender,
                      decoration: InputDecoration(
                        labelText: t('Gender'),
                        prefixIcon: Icon(Iconsax.user),
                      ),
                      items: [
                        DropdownMenuItem(value: 'male', child: Text(t('Male'))),
                        DropdownMenuItem(
                          value: 'female',
                          child: Text(t('Female')),
                        ),
                        DropdownMenuItem(value: 'other', child: Text(t('Other'))),
                      ],
                      onChanged: (v) => setState(() => _gender = v),
                    ),
                    const SizedBox(height: 12),
                    _field(
                      _dob,
                      'Date of birth (YYYY-MM-DD)',
                      icon: Iconsax.calendar,
                    ),
                  ],
                ),
                _section(
                  icon: Iconsax.book_1,
                  title: 'Community',
                  children: [
                    CommunityDropdown(
                      label: 'Community',
                      value: _community.text.trim().isEmpty
                          ? null
                          : _community.text.trim(),
                      onChanged: (v) =>
                          setState(() => _community.text = v ?? ''),
                    ),
                    const SizedBox(height: 12),
                    _dropdown(
                      label: 'Mother tongue',
                      icon: Iconsax.translate,
                      options: OnboardingData.motherTongues,
                      controller: _motherTongue,
                    ),
                    const SizedBox(height: 12),
                    _dropdown(
                      label: 'Diet',
                      icon: Iconsax.cup,
                      options: OnboardingData.diets,
                      controller: _diet,
                    ),
                  ],
                ),
                _section(
                  icon: Iconsax.building,
                  title: 'Location',
                  children: [
                    CitySearchField(
                      initialCity: _city.text,
                      onSelected: (v) => setState(() => _city.text = v),
                      onStateSelected: (stateName) =>
                          setState(() => _state.text = stateName),
                    ),
                    const SizedBox(height: 12),
                    _field(_state, 'State', icon: Iconsax.map),
                  ],
                ),
                _section(
                  icon: Iconsax.arrow_swap,
                  title: 'Personal',
                  children: [
                    _dropdown(
                      label: 'Height',
                      icon: Iconsax.arrow_swap,
                      options: OnboardingData.heightOptionsCm,
                      controller: _height,
                      display: OnboardingData.heightLabel,
                    ),
                    const SizedBox(height: 12),
                    _dropdown(
                      label: 'Profile for',
                      icon: Iconsax.profile_2user,
                      options: OnboardingData.profileForOptions,
                      controller: _profileFor,
                    ),
                    const SizedBox(height: 12),
                    _dropdown(
                      label: 'Marital status',
                      icon: Iconsax.heart,
                      options: OnboardingData.maritalStatuses,
                      controller: _marital,
                    ),
                    const SizedBox(height: 12),
                    _field(
                      _bio,
                      'Bio',
                      icon: Iconsax.document_text,
                      maxLines: 4,
                    ),
                  ],
                ),
                _section(
                  icon: Iconsax.briefcase,
                  title: 'Career',
                  children: [
                    _dropdown(
                      label: 'Occupation',
                      icon: Iconsax.briefcase,
                      options: OnboardingData.occupations,
                      controller: _occupation,
                    ),
                    const SizedBox(height: 12),
                    _dropdown(
                      label: 'Education level',
                      icon: Iconsax.book_saved,
                      options: OnboardingData.educationLevels,
                      controller: _education,
                    ),
                    const SizedBox(height: 12),
                    _dropdown(
                      label: 'Monthly salary',
                      icon: Iconsax.wallet,
                      options: OnboardingData.salaryRanges,
                      controller: _salary,
                    ),
                  ],
                ),
                _section(
                  icon: Iconsax.flash,
                  title: 'Astrology',
                  children: [
                    _dropdown(
                      label: 'Mangal Dosh',
                      icon: Iconsax.flash,
                      options: OnboardingData.mangalDoshOptions,
                      controller: _mangal,
                    ),
                    const SizedBox(height: 12),
                    BirthTimeField(
                      controller: _birthTime,
                      label: 'Birth time',
                    ),
                    const SizedBox(height: 12),
                    CitySearchField(
                      label: 'Place of birth',
                      icon: Iconsax.location,
                      includeStateInValue: true,
                      initialCity: _birthPlace.text,
                      onSelected: (v) => setState(() => _birthPlace.text = v),
                    ),
                  ],
                ),
                _section(
                  icon: Iconsax.heart,
                  title: 'Partner preference',
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: DropdownButtonFormField<int>(
                            initialValue: _pAgeMin,
                            isExpanded: true,
                            decoration: InputDecoration(
                              labelText: t('Age min'),
                              prefixIcon: Icon(Iconsax.arrow_up),
                            ),
                            items: OnboardingData.ageOptions
                                .map(
                                  (a) => DropdownMenuItem(
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
                              labelText: t('Age max'),
                              prefixIcon: Icon(Iconsax.arrow_down),
                            ),
                            items: OnboardingData.ageOptions
                                .where(
                                  (a) => _pAgeMin == null || a >= _pAgeMin!,
                                )
                                .map(
                                  (a) => DropdownMenuItem(
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
                    const SizedBox(height: 12),
                    CitySearchField(
                      initialCity: _pLocation.text,
                      onSelected: (v) => setState(() => _pLocation.text = v),
                    ),
                    const SizedBox(height: 12),
                    _dropdown(
                      label: 'Height pref',
                      icon: Iconsax.arrow_swap,
                      options: OnboardingData.heightOptionsCm,
                      controller: _pHeight,
                      display: OnboardingData.heightLabel,
                      placeholder: 'No preference',
                    ),
                    const SizedBox(height: 12),
                    _dropdown(
                      label: 'Diet pref',
                      icon: Iconsax.cup,
                      options: OnboardingData.diets,
                      controller: _pDiet,
                      placeholder: 'No preference',
                    ),
                    const SizedBox(height: 12),
                    _dropdown(
                      label: 'Marital status pref',
                      icon: Iconsax.heart,
                      options: OnboardingData.maritalStatuses,
                      controller: _pMarital,
                      placeholder: 'No preference',
                    ),
                    const SizedBox(height: 12),
                    _dropdown(
                      label: 'Mother tongue pref',
                      icon: Iconsax.translate,
                      options: OnboardingData.motherTongues,
                      controller: _pTongue,
                      placeholder: 'No preference',
                    ),
                    const SizedBox(height: 12),
                    _dropdown(
                      label: 'Mangal Dosh pref',
                      icon: Iconsax.flash,
                      options: OnboardingData.mangalDoshOptions,
                      controller: _pMangal,
                      placeholder: 'No preference',
                    ),
                    const SizedBox(height: 12),
                    _dropdown(
                      label: 'Occupation pref',
                      icon: Iconsax.briefcase,
                      options: OnboardingData.occupations,
                      controller: _pOccupation,
                      placeholder: 'No preference',
                    ),
                    const SizedBox(height: 12),
                    _dropdown(
                      label: 'Salary pref',
                      icon: Iconsax.wallet,
                      options: OnboardingData.salaryRanges,
                      controller: _pSalary,
                      placeholder: 'No preference',
                    ),
                    const SizedBox(height: 12),
                    _dropdown(
                      label: 'Education pref',
                      icon: Iconsax.book_saved,
                      options: OnboardingData.educationLevels,
                      controller: _pEducation,
                      placeholder: 'No preference',
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                _section(
                  icon: Iconsax.call,
                  title: 'Contact details',
                  children: [
                    Text(
                      '${t('Email')}: ${Supabase.instance.client.auth.currentUser?.email ?? t('Not added')}',
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _phone,
                      keyboardType: TextInputType.phone,
                      decoration: InputDecoration(
                        labelText: t('Phone number *'),
                        prefixText: '+91 ',
                        prefixIcon: const Icon(Iconsax.call),
                      ),
                    ),
                    const SizedBox(height: 12),
                    _field(
                      _whatsapp,
                      'WhatsApp number (optional)',
                      icon: Iconsax.message,
                    ),
                    const SizedBox(height: 4),
                    Text(t('Your number stays hidden until you turn sharing on. Your email is never shown to other members.'),
                      style: TextStyle(
                        fontSize: 12,
                        color: MangalamTheme.muted,
                        height: 1.35,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                SwitchListTile(
                  title: Text(t('Share my phone number'),
                  ),
                  subtitle: Text(t('If this is off, other members can only ask for your number in chat.'),
                    style: TextStyle(fontSize: 12, color: MangalamTheme.muted),
                  ),
                  value: _phoneVisible,
                  onChanged: (v) => setState(() => _phoneVisible = v),
                ),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: _saving ? null : _save,
                  child: _saving
                      ? const SizedBox(
                          height: 22,
                          width: 22,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : Text(t('Save changes')),
                ),
              ],
            ),
    );
  }

  Widget _section({
    required IconData icon,
    required String title,
    required List<Widget> children,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: MangalamCard(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            MangalamSectionHeader(title: title, icon: icon),
            const SizedBox(height: 14),
            ...children,
          ],
        ),
      ),
    );
  }

  Widget _field(
    TextEditingController c,
    String label, {
    IconData? icon,
    bool number = false,
    int maxLines = 1,
  }) {
    return TextField(
      controller: c,
      keyboardType: number ? TextInputType.number : null,
      maxLines: maxLines,
      decoration: InputDecoration(
        labelText: t(label),
        prefixIcon: icon != null ? Icon(icon) : null,
      ),
    );
  }

  /// A dropdown backed by a [TextEditingController]. The controller's current
  /// text is used as the selection; picking an option writes the option string
  /// back into the controller so load/save logic is unchanged. A blank
  /// placeholder option (value '') lets the user clear the field. If the
  /// stored value does not match any option (e.g. legacy free text), the
  /// dropdown renders with no selection instead of asserting.
  Widget _dropdown({
    required String label,
    required IconData icon,
    required List<String> options,
    required TextEditingController controller,
    String placeholder = 'Not specified',
    String Function(String)? display,
  }) {
    final current = controller.text.isEmpty
        ? ''
        : (options.contains(controller.text) ? controller.text : null);
    return DropdownButtonFormField<String>(
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
            t(placeholder),
            style: const TextStyle(color: MangalamTheme.muted),
          ),
        ),
        ...options.map(
          (o) => DropdownMenuItem(
            value: o,
            child: Text(t(display != null ? display(o) : o)),
          ),
        ),
      ],
      onChanged: (v) => setState(() => controller.text = v ?? ''),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';

import '../../services/api_client.dart';
import '../core/mangalam_theme.dart' show MangalamCard, MangalamSectionHeader, MangalamTheme;
import '../core/photo_picker_section.dart';

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

  final _pAgeMin = TextEditingController();
  final _pAgeMax = TextEditingController();
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
    _pAgeMin.dispose();
    _pAgeMax.dispose();
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
      _occupation.text = p['occupation']?.toString() ?? '';
      _education.text = p['education_level']?.toString() ?? '';
      _salary.text = p['monthly_salary']?.toString() ?? '';
      _phone.text = p['phone']?.toString() ?? '';
      _whatsapp.text = p['whatsapp_number']?.toString() ?? '';
      _mangal.text = p['mangal_dosh']?.toString() ?? '';
      _birthTime.text = p['birth_time']?.toString() ?? '';
      _birthPlace.text = p['birth_place']?.toString() ?? '';
      _photoUrls = (p['photo_urls'] as List<dynamic>?)?.cast<String>() ?? const [];
      if (p['date_of_birth'] != null) {
        _dob.text = p['date_of_birth'].toString().split('T').first;
      }
      final pp = p['partner_preferences'];
      if (pp is Map) {
        _pAgeMin.text = pp['age_min']?.toString() ?? '';
        _pAgeMax.text = pp['age_max']?.toString() ?? '';
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
    setState(() => _saving = true);
    try {
      final h = int.tryParse(_height.text.trim());
      final body = <String, dynamic>{
        'display_name': _name.text.trim(),
      };
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
      final phone = _phone.text.trim();
      final whatsapp = _whatsapp.text.trim();
      if (phone.isNotEmpty) body['phone'] = phone;
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

      final amin = int.tryParse(_pAgeMin.text.trim());
      final amax = int.tryParse(_pAgeMax.text.trim());
      if (amin != null) pp['age_min'] = amin;
      if (amax != null) pp['age_max'] = amax;
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
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Saved')));
        Navigator.of(context).pop(true);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Edit profile')),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: MangalamTheme.maroon))
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
                      decoration: const InputDecoration(
                        labelText: 'Gender',
                        prefixIcon: Icon(Iconsax.user),
                      ),
                      items: const [
                        DropdownMenuItem(value: 'male', child: Text('Male')),
                        DropdownMenuItem(value: 'female', child: Text('Female')),
                        DropdownMenuItem(value: 'other', child: Text('Other')),
                      ],
                      onChanged: (v) => setState(() => _gender = v),
                    ),
                    const SizedBox(height: 12),
                    _field(_dob, 'Date of birth (YYYY-MM-DD)', icon: Iconsax.calendar),
                  ],
                ),
                _section(
                  icon: Iconsax.book_1,
                  title: 'Community',
                  children: [
                    _field(_community, 'Community', icon: Iconsax.people),
                    const SizedBox(height: 12),
                    _field(_motherTongue, 'Mother tongue', icon: Iconsax.translate),
                    const SizedBox(height: 12),
                    _field(_diet, 'Diet', icon: Iconsax.cup),
                  ],
                ),
                _section(
                  icon: Iconsax.building,
                  title: 'Location',
                  children: [
                    _field(_city, 'City', icon: Iconsax.building),
                    const SizedBox(height: 12),
                    _field(_state, 'State', icon: Iconsax.map),
                  ],
                ),
                _section(
                  icon: Iconsax.arrow_swap,
                  title: 'Personal',
                  children: [
                    _field(_height, 'Height (cm)', icon: Iconsax.arrow_swap, number: true),
                    const SizedBox(height: 12),
                    _field(_profileFor, 'Profile for', icon: Iconsax.profile_2user),
                    const SizedBox(height: 12),
                    _field(_marital, 'Marital status', icon: Iconsax.heart),
                    const SizedBox(height: 12),
                    _field(_bio, 'Bio', icon: Iconsax.document_text, maxLines: 4),
                  ],
                ),
                _section(
                  icon: Iconsax.briefcase,
                  title: 'Career',
                  children: [
                    _field(_occupation, 'Occupation', icon: Iconsax.briefcase),
                    const SizedBox(height: 12),
                    _field(_education, 'Education level', icon: Iconsax.book_saved),
                    const SizedBox(height: 12),
                    _field(_salary, 'Monthly salary', icon: Iconsax.wallet),
                  ],
                ),
                _section(
                  icon: Iconsax.flash,
                  title: 'Astrology',
                  children: [
                    _field(_mangal, 'Mangal Dosh', icon: Iconsax.flash),
                    const SizedBox(height: 12),
                    _field(_birthTime, 'Birth time (HH:MM)', icon: Iconsax.clock),
                    const SizedBox(height: 12),
                    _field(_birthPlace, 'Place of birth', icon: Iconsax.location),
                  ],
                ),
                _section(
                  icon: Iconsax.heart,
                  title: 'Partner preference',
                  children: [
                    Row(
                      children: [
                        Expanded(child: _field(_pAgeMin, 'Age min', icon: Iconsax.arrow_up, number: true)),
                        const SizedBox(width: 12),
                        Expanded(child: _field(_pAgeMax, 'Age max', icon: Iconsax.arrow_down, number: true)),
                      ],
                    ),
                    const SizedBox(height: 12),
                    _field(_pLocation, 'Location', icon: Iconsax.location),
                    const SizedBox(height: 12),
                    _field(_pHeight, 'Height pref', icon: Iconsax.arrow_swap),
                    const SizedBox(height: 12),
                    _field(_pDiet, 'Diet pref', icon: Iconsax.cup),
                    const SizedBox(height: 12),
                    _field(_pMarital, 'Marital status pref', icon: Iconsax.heart),
                    const SizedBox(height: 12),
                    _field(_pTongue, 'Mother tongue pref', icon: Iconsax.translate),
                    const SizedBox(height: 12),
                    _field(_pMangal, 'Mangal Dosh pref', icon: Iconsax.flash),
                    const SizedBox(height: 12),
                    _field(_pOccupation, 'Occupation pref', icon: Iconsax.briefcase),
                    const SizedBox(height: 12),
                    _field(_pSalary, 'Salary pref', icon: Iconsax.wallet),
                    const SizedBox(height: 12),
                    _field(_pEducation, 'Education pref', icon: Iconsax.book_saved),
                  ],
                ),
                const SizedBox(height: 8),
                _section(
                  icon: Iconsax.call,
                  title: 'Contact details',
                  children: [
                    _field(_phone, 'Phone number', icon: Iconsax.call),
                    const SizedBox(height: 12),
                    _field(_whatsapp, 'WhatsApp number (optional)', icon: Iconsax.message),
                    const SizedBox(height: 4),
                    const Text(
                      'Sharing is off by default. Only verified + Premium members can view these when you opt in.',
                      style: TextStyle(fontSize: 12, color: MangalamTheme.muted, height: 1.35),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                SwitchListTile(
                  title: const Text('Share my contact with verified, paid members'),
                  subtitle: const Text(
                    'Only verified & Premium members will see your phone / WhatsApp.',
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
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Text('Save changes'),
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
        labelText: label,
        prefixIcon: icon != null ? Icon(icon) : null,
      ),
    );
  }
}

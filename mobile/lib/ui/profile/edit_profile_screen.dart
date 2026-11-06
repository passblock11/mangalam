import 'package:flutter/material.dart';

import '../../services/api_client.dart';

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
      _mangal.text = p['mangal_dosh']?.toString() ?? '';
      _birthTime.text = p['birth_time']?.toString() ?? '';
      _birthPlace.text = p['birth_place']?.toString() ?? '';
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
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                TextField(
                  controller: _name,
                  decoration: const InputDecoration(labelText: 'Display name', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: _gender,
                  decoration: const InputDecoration(labelText: 'Gender', border: OutlineInputBorder()),
                  items: const [
                    DropdownMenuItem(value: 'male', child: Text('Male')),
                    DropdownMenuItem(value: 'female', child: Text('Female')),
                    DropdownMenuItem(value: 'other', child: Text('Other')),
                  ],
                  onChanged: (v) => setState(() => _gender = v),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _community,
                  decoration: const InputDecoration(labelText: 'Community', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _motherTongue,
                  decoration: const InputDecoration(labelText: 'Mother tongue', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _diet,
                  decoration: const InputDecoration(labelText: 'Diet', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _height,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Height (cm)', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _profileFor,
                  decoration: const InputDecoration(labelText: 'Profile for?', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _marital,
                  decoration: const InputDecoration(labelText: 'Marital status', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _city,
                  decoration: const InputDecoration(labelText: 'City', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _state,
                  decoration: const InputDecoration(labelText: 'State', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _bio,
                  maxLines: 4,
                  decoration: const InputDecoration(labelText: 'Bio', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 12),
                SwitchListTile(
                  title: const Text('Show phone on profile (after trust)'),
                  value: _phoneVisible,
                  onChanged: (v) => setState(() => _phoneVisible = v),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _dob,
                  decoration: const InputDecoration(
                    labelText: 'Date of birth (YYYY-MM-DD)',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _mangal,
                  decoration: const InputDecoration(labelText: 'Mangal Dosh', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _birthTime,
                  decoration: const InputDecoration(
                    labelText: 'Birth time (HH:MM or 14:05)',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _birthPlace,
                  decoration: const InputDecoration(labelText: 'Place of birth', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 20),
                Text('Occupation', style: Theme.of(context).textTheme.titleSmall),
                const SizedBox(height: 8),
                TextField(
                  controller: _occupation,
                  decoration: const InputDecoration(labelText: 'Occupation', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _education,
                  decoration: const InputDecoration(labelText: 'Education level', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _salary,
                  decoration: const InputDecoration(labelText: 'Monthly salary', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 20),
                Text('Partner preference', style: Theme.of(context).textTheme.titleSmall),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _pAgeMin,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(labelText: 'Age min', border: OutlineInputBorder()),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        controller: _pAgeMax,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(labelText: 'Age max', border: OutlineInputBorder()),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _pLocation,
                  decoration: const InputDecoration(labelText: 'Location', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _pHeight,
                  decoration: const InputDecoration(labelText: 'Height pref', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _pDiet,
                  decoration: const InputDecoration(labelText: 'Diet pref', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _pMarital,
                  decoration: const InputDecoration(labelText: 'Marital status pref', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _pTongue,
                  decoration: const InputDecoration(labelText: 'Mother tongue pref', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _pMangal,
                  decoration: const InputDecoration(labelText: 'Mangal Dosh pref', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _pOccupation,
                  decoration: const InputDecoration(labelText: 'Occupation pref', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _pSalary,
                  decoration: const InputDecoration(labelText: 'Salary pref', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _pEducation,
                  decoration: const InputDecoration(labelText: 'Education pref', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: _saving ? null : _save,
                  child: _saving
                      ? const SizedBox(
                          height: 22,
                          width: 22,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Save'),
                ),
              ],
            ),
    );
  }
}

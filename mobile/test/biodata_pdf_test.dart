import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:mangalam_app/services/biodata_pdf.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    await initializeDateFormatting();
  });

  test('builds a biodata PDF from the signed-in profile', () async {
    final bytes = await buildOwnBiodata({
      'display_name': 'Asha Patil',
      'gender': 'female',
      'date_of_birth': '1996-04-12',
      'religion': 'Hindu',
      'community': 'Maratha',
      'mother_tongue': 'Marathi',
      'diet': 'Vegetarian',
      'height_cm': 162,
      'profile_for': 'Myself',
      'marital_status': 'Never married',
      'city': 'Pune',
      'state': 'Maharashtra',
      'country': 'India',
      'bio': 'A short introduction for the family.',
      'occupation': 'Software Engineer',
      'education_level': "Bachelor's",
      'monthly_salary': '₹50,000 - ₹75,000',
      'mangal_dosh': 'No',
      'birth_time': '08:30',
      'birth_place': 'Pune',
      'phone': '+919876543210',
      'whatsapp_number': '+919876543210',
      'is_verified': true,
      'partner_preferences': {
        'age_min': 26,
        'age_max': 32,
        'diet': 'Vegetarian',
        'height': '170',
      },
    }, email: 'asha@example.com');

    expect(bytes.length, greaterThan(1000));
    expect(String.fromCharCodes(bytes.take(5)), '%PDF-');
  }, timeout: const Timeout(Duration(seconds: 45)));
}

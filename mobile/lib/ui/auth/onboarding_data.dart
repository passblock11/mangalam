// Static option lists for onboarding (Indian matrimonial context).

class OnboardingData {
  OnboardingData._();

  static const List<String> profileForOptions = [
    'Self',
    'Son',
    'Daughter',
    'Brother',
    'Sister',
    'Friend',
    'Relative',
  ];

  static const List<String> genders = ['male', 'female', 'other'];

  static const List<String> religions = [
    'Hindu',
    'Muslim',
    'Christian',
    'Sikh',
    'Jain',
    'Buddhist',
    'Parsi',
    'Jewish',
    'Other',
  ];

  static const List<String> motherTongues = [
    'Hindi',
    'English',
    'Bengali',
    'Telugu',
    'Marathi',
    'Tamil',
    'Gujarati',
    'Urdu',
    'Kannada',
    'Odia',
    'Malayalam',
    'Punjabi',
    'Assamese',
    'Maithili',
    'Sanskrit',
    'Other',
  ];

  static const List<String> diets = [
    'Vegetarian',
    'Non-vegetarian',
    'Eggetarian',
    'Vegan',
    'Jain',
  ];

  static const List<String> maritalStatuses = [
    'Never married',
    'Divorced',
    'Widowed',
    'Awaiting divorce',
    'Annulled',
  ];

  static const List<String> indianStates = [
    'Andhra Pradesh',
    'Arunachal Pradesh',
    'Assam',
    'Bihar',
    'Chhattisgarh',
    'Goa',
    'Gujarat',
    'Haryana',
    'Himachal Pradesh',
    'Jharkhand',
    'Karnataka',
    'Kerala',
    'Madhya Pradesh',
    'Maharashtra',
    'Manipur',
    'Meghalaya',
    'Mizoram',
    'Nagaland',
    'Odisha',
    'Punjab',
    'Rajasthan',
    'Sikkim',
    'Tamil Nadu',
    'Telangana',
    'Tripura',
    'Uttar Pradesh',
    'Uttarakhand',
    'West Bengal',
    'Andaman and Nicobar Islands',
    'Chandigarh',
    'Dadra and Nagar Haveli and Daman and Diu',
    'Delhi',
    'Jammu and Kashmir',
    'Ladakh',
    'Lakshadweep',
    'Puducherry',
  ];

  static const List<String> educationLevels = [
    'Below 10th',
    '10th pass',
    '12th pass',
    'Diploma',
    "Bachelor's",
    "Master's",
    'Doctorate',
    'Other',
  ];

  static const List<String> occupations = [
    'Software / IT',
    'Doctor',
    'Engineer (non-IT)',
    'Teacher / Professor',
    'Government job',
    'Banking / Finance',
    'Business',
    'Self-employed',
    'Civil Services',
    'Defence',
    'Sales / Marketing',
    'HR',
    'Designer / Creative',
    'Lawyer',
    'Accountant / CA',
    'Agriculture',
    'Student',
    'Not working',
    'Other',
  ];

  static const List<String> salaryRanges = [
    'Below ₹10,000',
    '₹10,000 – ₹25,000',
    '₹25,000 – ₹50,000',
    '₹50,000 – ₹1,00,000',
    '₹1,00,000 – ₹2,00,000',
    '₹2,00,000 – ₹5,00,000',
    '₹5,00,000 – ₹10,00,000',
    'Above ₹10,00,000',
    'Prefer not to say',
  ];

  static const List<String> mangalDoshOptions = ['Yes', 'No', "Don't know"];

  static const List<String> heightOptionsCm = [
    '140',
    '142',
    '145',
    '147',
    '150',
    '152',
    '155',
    '157',
    '160',
    '162',
    '165',
    '167',
    '170',
    '172',
    '175',
    '177',
    '180',
    '182',
    '185',
    '187',
    '190',
    '192',
    '195',
    '197',
    '200',
  ];

  static String heightLabel(String cm) {
    final h = int.tryParse(cm);
    if (h == null) return cm;
    final ft = (h / 30.48).floor();
    final inch = (((h / 2.54) % 12)).round();
    return "$cm cm  ·  $ft'$inch\"";
  }

  /// App interface languages. Stored as the ISO 639-1 code in
  /// profiles.app_language; the native name is shown in the UI.
  static const List<({String code, String name})> appLanguages = [
    (code: 'en', name: 'English'),
    (code: 'hi', name: 'हिन्दी  ·  Hindi'),
    (code: 'mr', name: 'मराठी  ·  Marathi'),
    (code: 'ta', name: 'தமிழ்  ·  Tamil'),
    (code: 'te', name: 'తెలుగు  ·  Telugu'),
    (code: 'kn', name: 'ಕನ್ನಡ  ·  Kannada'),
    (code: 'bn', name: 'বাংলা  ·  Bengali'),
    (code: 'gu', name: 'ગુજરાતી  ·  Gujarati'),
    (code: 'pa', name: 'ਪੰਜਾਬੀ  ·  Punjabi'),
    (code: 'ml', name: 'മലയാളം  ·  Malayalam'),
  ];

  static String appLanguageName(String code) {
    for (final l in appLanguages) {
      if (l.code == code) return l.name;
    }
    return code.toUpperCase();
  }

  /// Age values for partner preference dropdowns (18..50).
  static const List<int> ageOptions = [
    18,
    19,
    20,
    21,
    22,
    23,
    24,
    25,
    26,
    27,
    28,
    29,
    30,
    31,
    32,
    33,
    34,
    35,
    36,
    37,
    38,
    39,
    40,
    41,
    42,
    43,
    44,
    45,
    46,
    47,
    48,
    49,
    50,
  ];
}

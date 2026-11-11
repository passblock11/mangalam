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
    '140', '142', '145', '147', '150', '152', '155', '157',
    '160', '162', '165', '167', '170', '172', '175', '177',
    '180', '182', '185', '187', '190', '192', '195', '197', '200',
  ];

  static String heightLabel(String cm) {
    final h = int.tryParse(cm);
    if (h == null) return cm;
    final ft = (h / 30.48).floor();
    final inch = (((h / 2.54) % 12)).round();
    return "$cm cm  ·  $ft'$inch\"";
  }
}

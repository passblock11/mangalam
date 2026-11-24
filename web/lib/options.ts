export const profileForOptions = ["Self", "Son", "Daughter", "Brother", "Sister", "Friend", "Relative"];
export const genders = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];
export const religions = ["Hindu", "Muslim", "Christian", "Sikh", "Jain", "Buddhist", "Parsi", "Jewish", "Other"];
export const motherTongues = ["Hindi", "English", "Bengali", "Telugu", "Marathi", "Tamil", "Gujarati", "Urdu", "Kannada", "Odia", "Malayalam", "Punjabi", "Assamese", "Maithili", "Sanskrit", "Other"];
export const diets = ["Vegetarian", "Non-vegetarian", "Eggetarian", "Vegan", "Jain"];
export const maritalStatuses = ["Never married", "Divorced", "Widowed", "Awaiting divorce", "Annulled"];
export const states = ["Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"];
export const educationLevels = ["Below 10th", "10th pass", "12th pass", "Diploma", "Bachelor's", "Master's", "Doctorate", "Other"];
export const occupations = ["Software / IT", "Doctor", "Engineer (non-IT)", "Teacher / Professor", "Government job", "Banking / Finance", "Business", "Self-employed", "Civil Services", "Defence", "Sales / Marketing", "HR", "Designer / Creative", "Lawyer", "Accountant / CA", "Agriculture", "Student", "Not working", "Other"];
export const salaryRanges = ["Below ₹10,000", "₹10,000 – ₹25,000", "₹25,000 – ₹50,000", "₹50,000 – ₹1,00,000", "₹1,00,000 – ₹2,00,000", "₹2,00,000 – ₹5,00,000", "₹5,00,000 – ₹10,00,000", "Above ₹10,00,000", "Prefer not to say"];
export const mangalDoshOptions = ["Yes", "No", "Don't know"];

/** Same height steps as the Mangalam mobile app. */
export const heightOptionsCm = [
  "140", "142", "145", "147", "150", "152", "155", "157", "160", "162", "165", "167",
  "170", "172", "175", "177", "180", "182", "185", "187", "190", "192", "195", "197", "200",
];

export function heightLabel(cm: string): string {
  const h = Number(cm);
  if (!Number.isFinite(h)) return cm;
  const ft = Math.floor(h / 30.48);
  const inch = Math.round((h / 2.54) % 12);
  return `${cm} cm  ·  ${ft}'${inch}"`;
}

/** Minimum age to create or keep a profile (web matches product rule). */
export const MIN_PROFILE_AGE = 20;

/** Partner preference age dropdown values (min profile age .. 50). */
export const ageOptions = Array.from({ length: 50 - MIN_PROFILE_AGE + 1 }, (_, i) => String(MIN_PROFILE_AGE + i));

/** Latest allowed date of birth for someone who is at least `minAge` today. */
export function maxDateOfBirth(minAge = MIN_PROFILE_AGE): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - minAge);
  return d.toISOString().slice(0, 10);
}

export function minDateOfBirth(maxAge = 80): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - maxAge);
  return d.toISOString().slice(0, 10);
}

export function isAtLeastAge(dob: string, minAge = MIN_PROFILE_AGE): boolean {
  if (!dob) return false;
  return dob <= maxDateOfBirth(minAge);
}

export const languages = [
  ["en", "English"],
  ["hi", "हिन्दी · Hindi"],
  ["mr", "मराठी · Marathi"],
  ["ta", "தமிழ் · Tamil"],
  ["te", "తెలుగు · Telugu"],
  ["kn", "ಕನ್ನಡ · Kannada"],
  ["bn", "বাংলা · Bengali"],
  ["gu", "ગુજરાતી · Gujarati"],
  ["pa", "ਪੰਜਾਬੀ · Punjabi"],
  ["ml", "മലയാളം · Malayalam"],
] as const;

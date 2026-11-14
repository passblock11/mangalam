import 'dart:typed_data';

import 'package:flutter/widgets.dart';
import 'package:http/http.dart' as http;
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

import '../l10n/app_locale.dart';
import '../ui/auth/onboarding_data.dart';
import '../ui/profile/profile_widgets.dart';
import '../utils/formatting.dart';

const _maroon = PdfColor(0.718, 0.110, 0.110);
const _gold = PdfColor(0.788, 0.635, 0.153);
const _cream = PdfColor(1, 0.973, 0.953);
const _ink = PdfColor(0.122, 0.106, 0.086);
const _muted = PdfColor(0.420, 0.384, 0.345);
const _line = PdfColor(0.906, 0.867, 0.831);

final Map<String, Future<pw.Font>> _fontCache = {};

/// Builds the signed-in member's own biodata and opens the system share sheet
/// so they can save it or send it to family. Nothing is uploaded.
Future<void> shareOwnBiodata({
  required Map<String, dynamic> profile,
  required String email,
  Rect? shareOrigin,
  Future<void> Function()? beforeShare,
}) async {
  final bytes = await buildOwnBiodata(profile, email: email);
  if (beforeShare != null) await beforeShare();
  final name = _plain(profile['display_name']) ?? '';
  await Printing.sharePdf(
    bytes: bytes,
    filename: _filename(name),
    bounds: shareOrigin,
    subject: name.isEmpty ? 'Mangalam biodata' : 'Mangalam biodata — $name',
  );
}

Future<Uint8List> buildOwnBiodata(
  Map<String, dynamic> profile, {
  required String email,
}) async {
  final photo = await _photo(profile['photo_urls']);
  final theme = await _theme(_corpus(profile, email));
  final doc = pw.Document(theme: theme);
  doc.addPage(
    pw.MultiPage(
      pageTheme: pw.PageTheme(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.fromLTRB(32, 28, 32, 40),
        theme: theme,
        buildBackground: (_) => pw.FullPage(
          ignoreMargins: true,
          child: pw.Container(color: _cream),
        ),
      ),
      header: _header,
      footer: _footer,
      build: (_) => _body(profile, email: email, photo: photo),
    ),
  );
  return doc.save();
}

pw.Widget _header(pw.Context context) {
  return pw.Container(
    margin: const pw.EdgeInsets.only(bottom: 14),
    padding: const pw.EdgeInsets.symmetric(horizontal: 14, vertical: 11),
    decoration: pw.BoxDecoration(
      color: _maroon,
      borderRadius: pw.BorderRadius.circular(8),
    ),
    child: pw.Row(
      mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
      crossAxisAlignment: pw.CrossAxisAlignment.center,
      children: [
        pw.Text(
          'MANGALAM',
          style: pw.TextStyle(
            color: _gold,
            fontSize: 14,
            fontWeight: pw.FontWeight.bold,
            letterSpacing: 2.4,
          ),
        ),
        pw.Text(
          t('Marriage biodata'),
          style: const pw.TextStyle(color: PdfColors.white, fontSize: 10),
        ),
      ],
    ),
  );
}

pw.Widget _footer(pw.Context context) {
  return pw.Container(
    margin: const pw.EdgeInsets.only(top: 8),
    child: pw.Row(
      mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
      children: [
        pw.Text(
          tf('Generated on {date}', {
            'date': formatDate(DateTime.now().toIso8601String()),
          }),
          style: const pw.TextStyle(color: _muted, fontSize: 8),
        ),
        pw.Text(
          '${context.pageNumber} / ${context.pagesCount}',
          style: const pw.TextStyle(color: _muted, fontSize: 8),
        ),
      ],
    ),
  );
}

List<pw.Widget> _body(
  Map<String, dynamic> profile, {
  required String email,
  required pw.MemoryImage? photo,
}) {
  final name = _plain(profile['display_name']) ?? t('Member');
  final place = _location(profile);
  final age = _age(profile['date_of_birth']);
  final meta = [?age, ?place].join('  ·  ');

  final personal = _rows([
    (t('Profile for'), _option(profile['profile_for'])),
    (t('Gender'), _gender(profile['gender'])),
    (t('Age'), age),
    (t('Date of Birth'), _dob(profile['date_of_birth'])),
    (t('Height'), _height(profile['height_cm'])),
    (t('Marital status'), _option(profile['marital_status'])),
    (t('Location'), place),
  ]);
  final community = _rows([
    (t('Religion'), _option(profile['religion'])),
    (t('Caste'), _option(profile['community'])),
    (t('Mother tongue'), _option(profile['mother_tongue'])),
    (t('Diet'), _option(profile['diet'])),
  ]);
  final career = _rows([
    (t('Education level'), _option(profile['education_level'])),
    (t('Occupation'), _option(profile['occupation'])),
    (t('Monthly salary'), _option(profile['monthly_salary'])),
  ]);
  final astrology = _rows([
    (t('Mangal Dosh'), _option(profile['mangal_dosh'])),
    (t('Birth time'), _birthTime(profile['birth_time'])),
    (t('Birth place'), _plain(profile['birth_place'])),
  ]);
  final partner = _partnerRows(profile['partner_preferences']);
  final contact = _rows([
    (t('Phone'), _plain(profile['phone'])),
    (t('Email'), _plain(email)),
    (t('WhatsApp'), _plain(profile['whatsapp_number'])),
  ]);
  final about = _plain(profile['bio']);

  return [
    pw.Row(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        if (photo != null) ...[
          pw.Container(
            width: 96,
            height: 120,
            decoration: pw.BoxDecoration(
              border: pw.Border.all(color: _gold, width: 1.4),
              borderRadius: pw.BorderRadius.circular(8),
            ),
            child: pw.ClipRRect(
              horizontalRadius: 7,
              verticalRadius: 7,
              child: pw.Image(photo, fit: pw.BoxFit.cover),
            ),
          ),
          pw.SizedBox(width: 14),
        ],
        pw.Expanded(
          child: pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Text(
                name,
                style: pw.TextStyle(
                  color: _ink,
                  fontSize: 20,
                  fontWeight: pw.FontWeight.bold,
                ),
              ),
              if (meta.isNotEmpty) ...[
                pw.SizedBox(height: 4),
                pw.Text(
                  meta,
                  style: const pw.TextStyle(color: _muted, fontSize: 11),
                ),
              ],
              if (profile['is_verified'] == true) ...[
                pw.SizedBox(height: 6),
                pw.Text(
                  t('Verified'),
                  style: pw.TextStyle(
                    color: _gold,
                    fontSize: 10,
                    fontWeight: pw.FontWeight.bold,
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    ),
    ..._section(t('Personal'), personal),
    ..._section(t('Community'), community),
    ..._section(t('Education & career'), career),
    ..._section(t('Astrology'), astrology),
    if (about != null) ..._about(about),
    ..._section(t('Partner preference'), partner),
    ..._section(t('Contact details'), contact),
  ];
}

List<pw.Widget> _section(String title, List<pw.Widget> rows) {
  if (rows.isEmpty) return const [];
  return [
    pw.SizedBox(height: 14),
    pw.Container(
      width: double.infinity,
      padding: const pw.EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: pw.BoxDecoration(
        color: _maroon,
        borderRadius: pw.BorderRadius.circular(4),
      ),
      child: pw.Text(
        title,
        style: pw.TextStyle(
          color: PdfColors.white,
          fontSize: 11,
          fontWeight: pw.FontWeight.bold,
        ),
      ),
    ),
    pw.SizedBox(height: 2),
    ...rows,
  ];
}

List<pw.Widget> _about(String bio) {
  return [
    pw.SizedBox(height: 14),
    pw.Container(
      width: double.infinity,
      padding: const pw.EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: pw.BoxDecoration(
        color: _maroon,
        borderRadius: pw.BorderRadius.circular(4),
      ),
      child: pw.Text(
        t('About'),
        style: pw.TextStyle(
          color: PdfColors.white,
          fontSize: 11,
          fontWeight: pw.FontWeight.bold,
        ),
      ),
    ),
    ..._chunks(bio).map(
      (part) => pw.Padding(
        padding: const pw.EdgeInsets.only(top: 6, left: 2, right: 2),
        child: pw.Text(
          part,
          style: const pw.TextStyle(color: _ink, fontSize: 11, lineSpacing: 3),
        ),
      ),
    ),
  ];
}

List<pw.Widget> _rows(List<(String, String?)> pairs) {
  final filled = pairs.where((pair) => pair.$2 != null && pair.$2!.isNotEmpty);
  return [
    for (final pair in filled)
      pw.Container(
        padding: const pw.EdgeInsets.symmetric(vertical: 5, horizontal: 2),
        decoration: const pw.BoxDecoration(
          border: pw.Border(bottom: pw.BorderSide(color: _line, width: 0.4)),
        ),
        child: pw.Row(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Expanded(
              flex: 4,
              child: pw.Text(
                pair.$1,
                style: const pw.TextStyle(color: _muted, fontSize: 10),
              ),
            ),
            pw.SizedBox(width: 8),
            pw.Expanded(
              flex: 6,
              child: pw.Text(
                pair.$2!,
                style: const pw.TextStyle(color: _ink, fontSize: 11),
              ),
            ),
          ],
        ),
      ),
  ];
}

List<pw.Widget> _partnerRows(dynamic raw) {
  final pp = raw is Map
      ? raw.map((key, value) => MapEntry(key.toString(), value))
      : const <String, dynamic>{};
  final min = pp['age_min']?.toString();
  final max = pp['age_max']?.toString();
  String? age;
  if (min != null && min.isNotEmpty && max != null && max.isNotEmpty) {
    age = '$min - $max';
  } else if (min != null && min.isNotEmpty) {
    age = min;
  } else if (max != null && max.isNotEmpty) {
    age = max;
  }
  return _rows([
    (t('Age'), age),
    (t('Location'), _plain(pp['location'])),
    (t('Height'), _height(pp['height'])),
    (t('Diet'), _option(pp['diet'])),
    (t('Marital status'), _option(pp['marital_status'])),
    (t('Mother tongue'), _option(pp['mother_tongue'])),
    (t('Mangal Dosh'), _option(pp['mangal_dosh'])),
    (t('Occupation'), _option(pp['occupation'])),
    (t('Education level'), _option(pp['education_level'])),
    (t('Monthly salary'), _option(pp['monthly_salary'])),
  ]);
}

String _corpus(Map<String, dynamic> profile, String email) {
  final parts = <String>[
    t('Marriage biodata'),
    t('Personal'),
    t('Community'),
    t('Education & career'),
    t('Astrology'),
    t('About'),
    t('Partner preference'),
    t('Contact details'),
    t('Verified'),
    _plain(profile['display_name']) ?? '',
    _plain(profile['bio']) ?? '',
    _plain(profile['birth_place']) ?? '',
    _plain(profile['city']) ?? '',
    _location(profile) ?? '',
    email,
  ];
  return parts.join('\n');
}

Future<pw.ThemeData> _theme(String corpus) async {
  final regular = await _cachedFont(
    'noto-sans',
    PdfGoogleFonts.notoSansRegular,
  );
  final bold = await _cachedFont('noto-sans-bold', PdfGoogleFonts.notoSansBold);
  final fallbacks = <pw.Font>[];
  for (final script in _scripts(corpus)) {
    fallbacks.add(await _cachedFont(script, () => _scriptFont(script)));
  }
  final base = regular.font == null ? regular : pw.Font.helvetica();
  final boldFont = bold.font == null ? bold : pw.Font.helveticaBold();
  return pw.ThemeData.withFont(
    base: base,
    bold: boldFont,
    fontFallback: fallbacks.where((font) => font.font == null).toList(),
  );
}

Future<pw.Font> _scriptFont(String script) {
  switch (script) {
    case 'deva':
      return PdfGoogleFonts.notoSansDevanagariRegular();
    case 'beng':
      return PdfGoogleFonts.notoSansBengaliRegular();
    case 'guru':
      return PdfGoogleFonts.notoSansGurmukhiRegular();
    case 'gujr':
      return PdfGoogleFonts.notoSansGujaratiRegular();
    case 'taml':
      return PdfGoogleFonts.notoSansTamilRegular();
    case 'telu':
      return PdfGoogleFonts.notoSansTeluguRegular();
    case 'knda':
      return PdfGoogleFonts.notoSansKannadaRegular();
    case 'mlym':
      return PdfGoogleFonts.notoSansMalayalamRegular();
    default:
      return PdfGoogleFonts.notoSansRegular();
  }
}

Future<pw.Font> _cachedFont(String key, Future<pw.Font> Function() load) {
  final existing = _fontCache[key];
  if (existing != null) return existing;
  final future = () async {
    try {
      final font = await load().timeout(const Duration(seconds: 12));
      if (font.font != null) _fontCache.remove(key);
      return font;
    } catch (_) {
      _fontCache.remove(key);
      return pw.Font.helvetica();
    }
  }();
  _fontCache[key] = future;
  return future;
}

Set<String> _scripts(String text) {
  final found = <String>{};
  for (final rune in text.runes) {
    if (rune >= 0x0900 && rune <= 0x097F) found.add('deva');
    if (rune >= 0x0980 && rune <= 0x09FF) found.add('beng');
    if (rune >= 0x0A00 && rune <= 0x0A7F) found.add('guru');
    if (rune >= 0x0A80 && rune <= 0x0AFF) found.add('gujr');
    if (rune >= 0x0B80 && rune <= 0x0BFF) found.add('taml');
    if (rune >= 0x0C00 && rune <= 0x0C7F) found.add('telu');
    if (rune >= 0x0C80 && rune <= 0x0CFF) found.add('knda');
    if (rune >= 0x0D00 && rune <= 0x0D7F) found.add('mlym');
  }
  return found;
}

Future<pw.MemoryImage?> _photo(dynamic raw) async {
  if (raw is! List || raw.isEmpty) return null;
  final url = raw.first?.toString() ?? '';
  if (!url.startsWith('http')) return null;
  try {
    final response = await http
        .get(Uri.parse(url))
        .timeout(const Duration(seconds: 8));
    if (response.statusCode != 200 || response.bodyBytes.length < 32) {
      return null;
    }
    return pw.MemoryImage(response.bodyBytes);
  } catch (_) {
    return null;
  }
}

List<String> _chunks(String text) {
  const size = 700;
  final chunks = <String>[];
  var rest = text.trim();
  while (rest.isNotEmpty) {
    if (rest.length <= size) {
      chunks.add(rest);
      break;
    }
    var cut = rest.lastIndexOf(' ', size);
    if (cut < 200) cut = size;
    chunks.add(rest.substring(0, cut).trimRight());
    rest = rest.substring(cut).trimLeft();
  }
  return chunks;
}

String _filename(String name) {
  final ascii = name
      .replaceAll(RegExp(r'[^A-Za-z0-9]+'), '-')
      .replaceAll(RegExp(r'-+'), '-')
      .replaceAll(RegExp(r'^-|-$'), '');
  final base = ascii.isEmpty ? 'Mangalam-Biodata' : 'Mangalam-Biodata-$ascii';
  return '$base.pdf';
}

String? _plain(dynamic raw) {
  final value = raw?.toString().trim() ?? '';
  if (value.isEmpty) return null;
  return value;
}

String? _option(dynamic raw) {
  final value = _plain(raw);
  if (value == null) return null;
  return tValue(value);
}

String? _gender(dynamic raw) {
  switch (raw?.toString()) {
    case 'male':
      return t('Male');
    case 'female':
      return t('Female');
    case 'other':
      return t('Other');
    default:
      return null;
  }
}

String? _height(dynamic raw) {
  final value = _plain(raw);
  if (value == null) return null;
  if (int.tryParse(value) == null) return tValue(value);
  return OnboardingData.heightLabel(value);
}

String? _dob(dynamic raw) {
  if (_plain(raw) == null) return null;
  final formatted = formatDob(raw);
  return formatted == '—' ? null : formatted;
}

String? _birthTime(dynamic raw) {
  if (_plain(raw) == null) return null;
  final formatted = formatBirthTime(raw);
  return formatted == '—' ? null : formatted;
}

String? _age(dynamic raw) {
  final parsed = DateTime.tryParse(raw?.toString() ?? '');
  if (parsed == null) return null;
  final years = DateTime.now().difference(parsed).inDays ~/ 365;
  if (years < 1 || years > 120) return null;
  return tf('{n} years', {'n': '$years'});
}

String? _location(Map<String, dynamic> profile) {
  final city = _plain(profile['city']);
  final state = _plain(profile['state']);
  final country = _plain(profile['country']);
  final parts = <String>[
    ?city,
    ?(state == null ? null : t(state)),
    ?(country == null ? null : tValue(country)),
  ];
  if (parts.isEmpty) return null;
  return parts.join(', ');
}

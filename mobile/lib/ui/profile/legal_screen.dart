import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:iconsax_flutter/iconsax_flutter.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/config.dart';
import '../core/mangalam_theme.dart';

/// Admin-authored legal page (Privacy, Terms, Refund, About).
///
/// Loaded from the public JSON API and rendered in Flutter. This avoids
/// the native WebView, which was crashing the app on open (the plugin
/// channel was not available when the screen was pushed).
class LegalScreen extends StatefulWidget {
  const LegalScreen({super.key, required this.slug, this.title});

  final String slug;
  final String? title;

  @override
  State<LegalScreen> createState() => _LegalScreenState();
}

class _LegalScreenState extends State<LegalScreen> {
  bool _loading = true;
  String? _error;
  String _title = '';
  String _updated = '';
  String _body = '';

  @override
  void initState() {
    super.initState();
    _title = widget.title ?? widget.slug;
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final base = AppConfig.apiBaseUrl.replaceAll(RegExp(r'/$'), '');
    final uri = Uri.parse('$base/v1/config/legal/${widget.slug}');
    try {
      final res = await http.get(uri).timeout(const Duration(seconds: 20));
      if (res.statusCode < 200 || res.statusCode >= 300) {
        throw Exception('Could not load this page.');
      }
      final decoded = jsonDecode(res.body);
      final page = decoded is Map ? decoded['page'] : null;
      if (page is! Map) throw Exception('This page is not available yet.');
      final updatedRaw = page['updated_at']?.toString();
      String updated = '';
      final parsed = updatedRaw == null ? null : DateTime.tryParse(updatedRaw);
      if (parsed != null) {
        updated = DateFormat('MMM d, yyyy').format(parsed.toLocal());
      }
      if (!mounted) return;
      setState(() {
        _title = page['title']?.toString().trim().isNotEmpty == true
            ? page['title'].toString()
            : (widget.title ?? widget.slug);
        _body = page['body']?.toString() ?? '';
        _updated = updated;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Could not load this page. Check your connection and try again.';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFFFDF8),
      appBar: AppBar(title: Text(_title)),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: MangalamTheme.maroon),
            )
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(28),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Iconsax.warning_2,
                          size: 40,
                          color: MangalamTheme.maroon,
                        ),
                        const SizedBox(height: 10),
                        Text(_error!, textAlign: TextAlign.center),
                        const SizedBox(height: 12),
                        OutlinedButton.icon(
                          onPressed: _load,
                          icon: const Icon(Iconsax.refresh),
                          label: const Text('Retry'),
                        ),
                      ],
                    ),
                  ),
                )
              : ListView(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
                  children: [
                    Text(
                      _title,
                      style: const TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.w800,
                        color: MangalamTheme.maroon,
                        height: 1.15,
                        letterSpacing: -0.3,
                      ),
                    ),
                    if (_updated.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text(
                        'Last updated $_updated',
                        style: const TextStyle(
                          fontSize: 13,
                          color: MangalamTheme.muted,
                        ),
                      ),
                    ],
                    const SizedBox(height: 18),
                    ..._markdownBlocks(_body),
                  ],
                ),
    );
  }
}

List<Widget> _markdownBlocks(String markdown) {
  final lines = markdown.replaceAll('\r\n', '\n').split('\n');
  final widgets = <Widget>[];
  final para = <String>[];
  final list = <String>[];

  void flushPara() {
    if (para.isEmpty) return;
    widgets.add(_Paragraph(para.join(' ').trim()));
    widgets.add(const SizedBox(height: 12));
    para.clear();
  }

  void flushList() {
    if (list.isEmpty) return;
    for (final item in list) {
      widgets.add(_Bullet(item));
    }
    widgets.add(const SizedBox(height: 8));
    list.clear();
  }

  for (final raw in lines) {
    final line = raw.trimRight();
    final trimmed = line.trim();
    if (trimmed.isEmpty) {
      flushPara();
      flushList();
      continue;
    }
    if (trimmed.startsWith('### ')) {
      flushPara();
      flushList();
      widgets.add(_Heading(trimmed.substring(4), 3));
      continue;
    }
    if (trimmed.startsWith('## ')) {
      flushPara();
      flushList();
      widgets.add(_Heading(trimmed.substring(3), 2));
      continue;
    }
    if (trimmed.startsWith('# ')) {
      flushPara();
      flushList();
      widgets.add(_Heading(trimmed.substring(2), 1));
      continue;
    }
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      flushPara();
      list.add(trimmed.substring(2));
      continue;
    }
    flushList();
    para.add(trimmed);
  }
  flushPara();
  flushList();
  return widgets;
}

class _Heading extends StatelessWidget {
  const _Heading(this.text, this.level);
  final String text;
  final int level;

  @override
  Widget build(BuildContext context) {
    final size = level == 1 ? 22.0 : level == 2 ? 18.0 : 16.0;
    return Padding(
      padding: const EdgeInsets.only(top: 8, bottom: 8),
      child: Text(
        text,
        style: TextStyle(
          fontSize: size,
          fontWeight: FontWeight.w800,
          color: MangalamTheme.maroon,
          height: 1.25,
        ),
      ),
    );
  }
}

class _Paragraph extends StatelessWidget {
  const _Paragraph(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Text.rich(
      TextSpan(children: _spans(text)),
      style: const TextStyle(
        fontSize: 15.5,
        height: 1.55,
        color: Color(0xFF1F1F1F),
      ),
    );
  }
}

class _Bullet extends StatelessWidget {
  const _Bullet(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6, left: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.only(top: 8, right: 8),
            child: Icon(Icons.circle, size: 6, color: MangalamTheme.maroon),
          ),
          Expanded(
            child: Text.rich(
              TextSpan(children: _spans(text)),
              style: const TextStyle(
                fontSize: 15.5,
                height: 1.5,
                color: Color(0xFF1F1F1F),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

List<InlineSpan> _spans(String input) {
  final spans = <InlineSpan>[];
  final re = RegExp(r'\*\*(.+?)\*\*|\[(.+?)\]\((.+?)\)');
  var start = 0;
  for (final m in re.allMatches(input)) {
    if (m.start > start) {
      spans.add(TextSpan(text: input.substring(start, m.start)));
    }
    if (m.group(1) != null) {
      spans.add(TextSpan(
        text: m.group(1),
        style: const TextStyle(fontWeight: FontWeight.w700),
      ));
    } else {
      final label = m.group(2) ?? '';
      final href = m.group(3) ?? '';
      spans.add(WidgetSpan(
        alignment: PlaceholderAlignment.baseline,
        baseline: TextBaseline.alphabetic,
        child: GestureDetector(
          onTap: () async {
            final uri = Uri.tryParse(href);
            if (uri == null) return;
            if (await canLaunchUrl(uri)) {
              await launchUrl(uri, mode: LaunchMode.externalApplication);
            }
          },
          child: Text(
            label,
            style: const TextStyle(
              color: MangalamTheme.maroon,
              decoration: TextDecoration.underline,
              fontSize: 15.5,
              height: 1.5,
            ),
          ),
        ),
      ));
    }
    start = m.end;
  }
  if (start < input.length) {
    spans.add(TextSpan(text: input.substring(start)));
  }
  return spans;
}

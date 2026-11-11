import 'package:flutter/material.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../services/api_client.dart';
import '../core/mangalam_theme.dart';

/// Full complaint form: title, category, description, and up to 4 screenshots.
/// Submitted to /v1/reports and reviewed in the admin complaint console.
class ReportUserScreen extends StatefulWidget {
  const ReportUserScreen({
    super.key,
    required this.reportedProfileId,
    required this.reportedName,
  });

  final String reportedProfileId;
  final String reportedName;

  @override
  State<ReportUserScreen> createState() => _ReportUserScreenState();
}

class _ReportUserScreenState extends State<ReportUserScreen> {
  final _api = ApiClient();
  final _titleCtrl = TextEditingController();
  final _descCtrl = TextEditingController();

  String _category = 'other';
  final List<String> _screenshotPaths = []; // storage paths
  final List<XFile> _pickedFiles = [];
  bool _uploading = false;
  bool _submitting = false;
  String? _error;

  static const _categories = <({String value, String label, IconData icon})>[
    (value: 'scam_fraud', label: 'Scam / Fraud', icon: Iconsax.warning_2),
    (value: 'harassment', label: 'Harassment', icon: Iconsax.message),
    (value: 'fake_profile', label: 'Fake profile', icon: Iconsax.user),
    (value: 'inappropriate', label: 'Inappropriate content', icon: Iconsax.eye),
    (value: 'illegal', label: 'Illegal / Harmful', icon: Iconsax.shield_cross),
    (value: 'other', label: 'Other', icon: Iconsax.more_circle),
  ];

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickScreenshots() async {
    final remaining = 4 - _pickedFiles.length;
    if (remaining <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Maximum 4 screenshots allowed.')),
      );
      return;
    }
    final picker = ImagePicker();
    try {
      final files = await picker.pickMultiImage(
        imageQuality: 80,
        maxWidth: 1600,
        limit: remaining,
      );
      if (files.isEmpty) return;
      setState(() => _uploading = true);
      final sb = Supabase.instance.client;
      final uid = sb.auth.currentUser?.id ?? '';
      final urls = <String>[];
      for (final f in files) {
        final bytes = await f.readAsBytes();
        final path =
            '$uid/reports/${DateTime.now().millisecondsSinceEpoch}_${_pickedFiles.length + urls.length}.jpg';
        await sb.storage
            .from('report-screenshots')
            .uploadBinary(
              path,
              bytes,
              fileOptions: const FileOptions(
                contentType: 'image/jpeg',
                upsert: true,
              ),
            );
        urls.add(sb.storage.from('report-screenshots').getPublicUrl(path));
      }
      if (!mounted) return;
      setState(() {
        _pickedFiles.addAll(files);
        _screenshotPaths.addAll(urls);
        _uploading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _uploading = false);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Upload failed: $e')));
    }
  }

  void _removeScreenshot(int i) {
    setState(() {
      _pickedFiles.removeAt(i);
      _screenshotPaths.removeAt(i);
    });
  }

  Future<void> _submit() async {
    final title = _titleCtrl.text.trim();
    final desc = _descCtrl.text.trim();
    if (title.isEmpty) {
      setState(() => _error = 'Please add a short title.');
      return;
    }
    if (desc.isEmpty || desc.length < 10) {
      setState(
        () =>
            _error = 'Please describe what happened (at least 10 characters).',
      );
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await _api.post('/v1/reports', {
        'reported_profile_id': widget.reportedProfileId,
        'title': title,
        'description': desc,
        'category': _category,
        'screenshot_urls': _screenshotPaths,
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Report submitted. Our team will review it.'),
        ),
      );
      Navigator.of(context).pop(true);
    } on BannedException {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Your account has been banned.')),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Report user')),
      body: ListView(
        padding: EdgeInsets.fromLTRB(
          20,
          12,
          20,
          MediaQuery.of(context).padding.bottom + 32,
        ),
        children: [
          // Reported user card
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: MangalamTheme.maroon.withValues(alpha: 0.05),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: MangalamTheme.maroon.withValues(alpha: 0.15),
              ),
            ),
            child: Row(
              children: [
                const Icon(Iconsax.user, color: MangalamTheme.maroon, size: 22),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Reporting',
                        style: TextStyle(
                          fontSize: 11,
                          color: MangalamTheme.muted,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      Text(
                        widget.reportedName,
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 15,
                          color: MangalamTheme.ink,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Title
          const Text(
            'Title',
            style: TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: 13,
              color: MangalamTheme.ink,
            ),
          ),
          const SizedBox(height: 6),
          TextField(
            controller: _titleCtrl,
            maxLength: 120,
            textCapitalization: TextCapitalization.sentences,
            decoration: InputDecoration(
              hintText: 'e.g. Asked for money / fake photos',
              filled: true,
              fillColor: Colors.white,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFE7E2DC)),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFE7E2DC)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: MangalamTheme.maroon, width: 1.5),
              ),
            ),
          ),
          const SizedBox(height: 18),

          // Category
          const Text(
            'Category',
            style: TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: 13,
              color: MangalamTheme.ink,
            ),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _categories.map((c) {
              final selected = _category == c.value;
              return ChoiceChip(
                label: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      c.icon,
                      size: 14,
                      color: selected ? Colors.white : MangalamTheme.maroon,
                    ),
                    const SizedBox(width: 6),
                    Text(c.label),
                  ],
                ),
                selected: selected,
                selectedColor: MangalamTheme.maroon,
                labelStyle: TextStyle(
                  color: selected ? Colors.white : MangalamTheme.ink,
                  fontWeight: FontWeight.w600,
                  fontSize: 12.5,
                ),
                showCheckmark: false,
                onSelected: (_) => setState(() => _category = c.value),
              );
            }).toList(),
          ),
          const SizedBox(height: 18),

          // Description
          const Text(
            'What happened?',
            style: TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: 13,
              color: MangalamTheme.ink,
            ),
          ),
          const SizedBox(height: 6),
          TextField(
            controller: _descCtrl,
            maxLines: 5,
            maxLength: 2000,
            textCapitalization: TextCapitalization.sentences,
            decoration: InputDecoration(
              hintText:
                  'Describe the incident in detail. Include dates, what was said, and any evidence you have.',
              filled: true,
              fillColor: Colors.white,
              alignLabelWithHint: true,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFE7E2DC)),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFE7E2DC)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: MangalamTheme.maroon, width: 1.5),
              ),
            ),
          ),
          const SizedBox(height: 18),

          // Screenshots
          Row(
            children: [
              const Text(
                'Screenshots',
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                  color: MangalamTheme.ink,
                ),
              ),
              const SizedBox(width: 6),
              Text(
                '(${_screenshotPaths.length}/4)',
                style: const TextStyle(
                  fontSize: 12,
                  color: MangalamTheme.muted,
                ),
              ),
              const Spacer(),
              if (_uploading)
                const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: MangalamTheme.maroon,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),
          if (_screenshotPaths.isEmpty)
            _addScreenshotTile()
          else
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                ..._screenshotPaths.asMap().entries.map(
                  (e) => _screenshotThumb(e.key, e.value),
                ),
                if (_screenshotPaths.length < 4) _addScreenshotTile(),
              ],
            ),
          const SizedBox(height: 8),
          const Text(
            'Chat screenshots or evidence photos help our team take action faster.',
            style: TextStyle(
              fontSize: 11.5,
              color: MangalamTheme.muted,
              height: 1.4,
            ),
          ),

          if (_error != null) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: MangalamTheme.maroon.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  const Icon(
                    Iconsax.warning_2,
                    color: MangalamTheme.maroon,
                    size: 18,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _error!,
                      style: const TextStyle(
                        fontSize: 12.5,
                        color: MangalamTheme.maroon,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],

          const SizedBox(height: 24),
          FilledButton.icon(
            onPressed: _submitting ? null : _submit,
            icon: _submitting
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Icon(Iconsax.send_2),
            label: const Text('Submit complaint'),
          ),
          const SizedBox(height: 10),
          const Text(
            'False reports may lead to action against your own account. Please report only genuine violations.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 11.5,
              color: MangalamTheme.muted,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }

  Widget _addScreenshotTile() {
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: _uploading ? null : _pickScreenshots,
      child: Container(
        width: 96,
        height: 96,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: const Color(0xFFE7E2DC),
            style: BorderStyle.solid,
          ),
        ),
        child: const Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Iconsax.add, color: MangalamTheme.maroon, size: 26),
            SizedBox(height: 4),
            Text(
              'Add',
              style: TextStyle(
                fontSize: 11,
                color: MangalamTheme.muted,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _screenshotThumb(int index, String url) {
    return Stack(
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: Image.network(
            url,
            width: 96,
            height: 96,
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => Container(
              width: 96,
              height: 96,
              color: const Color(0xFFF3E9DF),
              child: const Icon(Iconsax.image, color: MangalamTheme.muted),
            ),
          ),
        ),
        Positioned(
          top: 4,
          right: 4,
          child: GestureDetector(
            onTap: () => _removeScreenshot(index),
            child: Container(
              padding: const EdgeInsets.all(3),
              decoration: const BoxDecoration(
                color: Colors.black87,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Iconsax.close_circle,
                color: Colors.white,
                size: 14,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

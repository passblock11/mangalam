import 'package:flutter/material.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';

import '../../services/api_client.dart';
import '../core/mangalam_theme.dart';

/// Displays a legal page (Privacy Policy, Terms, Refund, About) fetched
/// from the admin-managed backend. Content is authored in the admin panel.
class LegalScreen extends StatefulWidget {
  const LegalScreen({super.key, required this.slug, this.title});

  final String slug;
  final String? title;

  @override
  State<LegalScreen> createState() => _LegalScreenState();
}

class _LegalScreenState extends State<LegalScreen> {
  final _api = ApiClient();
  bool _loading = true;
  String? _error;
  String? _title;
  String? _body;
  String? _updatedAt;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (!mounted) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res =
          await _api.get('/v1/config/legal/${widget.slug}')
              as Map<String, dynamic>;
      if (!mounted) return;
      final page = res['page'] as Map<String, dynamic>?;
      setState(() {
        _title = page?['title']?.toString() ?? widget.title ?? widget.slug;
        _body = page?['body']?.toString();
        _updatedAt = page?['updated_at']?.toString();
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_title ?? widget.title ?? widget.slug)),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: MangalamTheme.maroon),
            )
          : _error != null
          ? MangalamEmptyState(
              icon: Iconsax.warning_2,
              title: 'Could not load',
              subtitle: _error,
              action: FilledButton(
                onPressed: _load,
                child: const Text('Retry'),
              ),
            )
          : ListView(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
              children: [
                if (_updatedAt != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Text(
                      'Last updated ${_updatedAt!.substring(0, 10)}',
                      style: const TextStyle(
                        fontSize: 12,
                        color: MangalamTheme.muted,
                      ),
                    ),
                  ),
                Text(
                  _body ?? 'This page has no content yet.',
                  style: const TextStyle(
                    fontSize: 14,
                    height: 1.6,
                    color: MangalamTheme.ink,
                  ),
                ),
              ],
            ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../core/config.dart';
import '../core/mangalam_theme.dart';

/// Displays a legal page (Privacy Policy, Terms, Refund, About) as a real
/// HTML document rendered by the admin-managed backend and shown in an
/// in-app WebView. The same URL is used for Play Store listing links.
///
/// The backend endpoint `/v1/config/legal/:slug/html` returns a full HTML
/// page (Markdown body rendered via markdown-it). Content is authored in
/// the admin panel.
class LegalScreen extends StatefulWidget {
  const LegalScreen({super.key, required this.slug, this.title});

  final String slug;
  final String? title;

  @override
  State<LegalScreen> createState() => _LegalScreenState();
}

class _LegalScreenState extends State<LegalScreen> {
  late final WebViewController _controller;
  bool _loading = true;
  bool _errored = false;

  @override
  void initState() {
    super.initState();
    _initWebView();
  }

  void _initWebView() {
    final url = '${AppConfig.apiBaseUrl}/v1/config/legal/${widget.slug}/html';
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageFinished: (_) {
            if (mounted) setState(() => _loading = false);
          },
          onWebResourceError: (e) {
            if (mounted) setState(() => _errored = true);
          },
        ),
      )
      ..loadRequest(Uri.parse(url));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.title ?? widget.slug)),
      body: Stack(
        children: [
          if (_errored)
            Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Iconsax.warning_2,
                      size: 40, color: MangalamTheme.maroon),
                  const SizedBox(height: 10),
                  const Text('Could not load this page.'),
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    onPressed: () {
                      setState(() {
                        _errored = false;
                        _loading = true;
                      });
                      _initWebView();
                    },
                    icon: const Icon(Iconsax.refresh),
                    label: const Text('Retry'),
                  ),
                ],
              ),
            )
          else
            WebViewWidget(controller: _controller),
          if (_loading && !_errored)
            const Center(
              child: CircularProgressIndicator(color: MangalamTheme.maroon),
            ),
        ],
      ),
    );
  }
}

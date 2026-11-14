import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../l10n/app_locale.dart';
import '../../services/api_client.dart';
import '../core/mangalam_theme.dart';

const supportEmail = 'passblock.securities@gmail.com';

const _categories = <String, String>{
  'account': 'Account',
  'verification': 'Verification',
  'payment': 'Payment',
  'technical': 'App problem',
  'other': 'Other',
};

String supportStatusLabel(String status) {
  switch (status) {
    case 'in_progress':
      return 'In progress';
    case 'waiting_on_you':
      return 'Waiting for you';
    case 'resolved':
      return 'Resolved';
    case 'closed':
      return 'Closed';
    default:
      return 'Open';
  }
}

class SupportScreen extends StatefulWidget {
  const SupportScreen({super.key, this.phone, this.whatsapp});

  final String? phone;
  final String? whatsapp;

  @override
  State<SupportScreen> createState() => _SupportScreenState();
}

class _SupportScreenState extends State<SupportScreen> {
  final _api = ApiClient();
  List<Map<String, dynamic>> _tickets = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final json = await _api.get('/v1/support/tickets') as Map<String, dynamic>;
      final list = json['tickets'] as List<dynamic>? ?? [];
      if (!mounted) return;
      setState(() {
        _tickets = list.map((row) => Map<String, dynamic>.from(row as Map)).toList();
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = userFacingError(e);
        _loading = false;
      });
    }
  }

  Future<void> _open(Uri uri) async {
    try {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(t('Could not open that link.'))),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(t('Support'))),
      body: RefreshIndicator(
        color: MangalamTheme.maroon,
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
          children: [
            MangalamCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    t('Write to us or send a ticket'),
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    t('Email us at the address below, or send a ticket and follow every status here. We also notify you when it changes.'),
                    style: const TextStyle(color: MangalamTheme.muted, height: 1.35),
                  ),
                  const SizedBox(height: 12),
                  SelectableText(
                    supportEmail,
                    style: const TextStyle(fontWeight: FontWeight.w800, color: MangalamTheme.maroon),
                  ),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      OutlinedButton.icon(
                        onPressed: () => _open(Uri.parse('mailto:$supportEmail')),
                        icon: const Icon(Iconsax.sms, size: 18),
                        label: Text(t('Email')),
                      ),
                      OutlinedButton.icon(
                        onPressed: () async {
                          await Clipboard.setData(const ClipboardData(text: supportEmail));
                          if (!context.mounted) return;
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text(t('Email copied'))),
                          );
                        },
                        icon: const Icon(Iconsax.copy, size: 18),
                        label: Text(t('Copy')),
                      ),
                      if ((widget.whatsapp ?? '').isNotEmpty)
                        OutlinedButton.icon(
                          onPressed: () => _open(
                            Uri.parse('https://wa.me/${widget.whatsapp!.replaceAll(RegExp(r'\D'), '')}'),
                          ),
                          icon: const Icon(Iconsax.message, size: 18),
                          label: Text(t('WhatsApp')),
                        ),
                      if ((widget.phone ?? '').isNotEmpty)
                        OutlinedButton.icon(
                          onPressed: () => _open(
                            Uri.parse('tel:${widget.phone!.replaceAll(RegExp(r'\s'), '')}'),
                          ),
                          icon: const Icon(Iconsax.call, size: 18),
                          label: Text(t('Call')),
                        ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: () async {
                final sent = await Navigator.of(context).push<bool>(
                  MaterialPageRoute(builder: (_) => const SupportComposerScreen()),
                );
                if (sent == true) _load();
              },
              icon: const Icon(Iconsax.add),
              label: Text(t('New ticket')),
            ),
            const SizedBox(height: 18),
            Text(
              t('Your tickets'),
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
            ),
            const SizedBox(height: 8),
            if (_loading)
              const Padding(
                padding: EdgeInsets.all(24),
                child: Center(child: CircularProgressIndicator(color: MangalamTheme.maroon)),
              )
            else if (_error != null)
              Text(t(_error!), style: const TextStyle(color: MangalamTheme.maroon))
            else if (_tickets.isEmpty)
              Text(
                t('No tickets yet.'),
                style: const TextStyle(color: MangalamTheme.muted),
              )
            else
              ..._tickets.map((ticket) {
                final number = ticket['ticket_number']?.toString() ?? '';
                final subject = ticket['subject']?.toString() ?? '';
                final status = ticket['status']?.toString() ?? 'open';
                return Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    title: Text('#$number  $subject', maxLines: 1, overflow: TextOverflow.ellipsis),
                    subtitle: Text(t(supportStatusLabel(status))),
                    trailing: const Icon(Iconsax.arrow_right, color: MangalamTheme.muted),
                    onTap: () async {
                      await Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => SupportTicketScreen(ticketId: ticket['id'].toString()),
                        ),
                      );
                      if (mounted) _load();
                    },
                  ),
                );
              }),
          ],
        ),
      ),
    );
  }
}

class SupportComposerScreen extends StatefulWidget {
  const SupportComposerScreen({super.key});

  @override
  State<SupportComposerScreen> createState() => _SupportComposerScreenState();
}

class _SupportComposerScreenState extends State<SupportComposerScreen> {
  final _api = ApiClient();
  final _subject = TextEditingController();
  final _body = TextEditingController();
  final List<Uint8List> _photos = [];
  String _category = 'account';
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _subject.dispose();
    _body.dispose();
    super.dispose();
  }

  Future<void> _pickPhotos() async {
    final remaining = 4 - _photos.length;
    if (remaining <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(t('Maximum 4 screenshots allowed.'))),
      );
      return;
    }
    final files = await ImagePicker().pickMultiImage(
      imageQuality: 80,
      maxWidth: 1600,
      limit: remaining,
    );
    if (files.isEmpty || !mounted) return;
    final picked = <Uint8List>[];
    for (final file in files.take(remaining)) {
      try {
        picked.add(await file.readAsBytes());
      } catch (_) {}
    }
    if (!mounted) return;
    setState(() {
      if (picked.isEmpty) {
        _error = 'One of the photos could not be attached.';
      } else {
        _photos.addAll(picked);
        _error = null;
      }
    });
  }

  Future<List<String>> _uploadPhotos() async {
    final sb = Supabase.instance.client;
    final uid = sb.auth.currentUser?.id ?? '';
    if (uid.isEmpty) throw StateError('Not signed in');
    final urls = <String>[];
    for (var i = 0; i < _photos.length; i++) {
      final path = '$uid/support/${DateTime.now().microsecondsSinceEpoch}_$i.jpg';
      await sb.storage.from('report-screenshots').uploadBinary(
            path,
            _photos[i],
            fileOptions: const FileOptions(contentType: 'image/jpeg', upsert: false),
          );
      urls.add(sb.storage.from('report-screenshots').getPublicUrl(path));
    }
    return urls;
  }

  Future<void> _send() async {
    final subject = _subject.text.trim();
    final body = _body.text.trim();
    if (subject.length < 3 || body.length < 10) {
      setState(() => _error = 'Add a subject and describe what happened.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final photos = await _uploadPhotos();
      await _api.post('/v1/support/tickets', {
        'subject': subject,
        'category': _category,
        'body': body,
        if (photos.isNotEmpty) 'attachment_urls': photos,
      });
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      final raw = userFacingError(e);
      setState(() {
        _error = raw.contains('PathNotFound') || raw.contains('No such file')
            ? 'One of the photos could not be attached.'
            : raw;
      });
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(t('New ticket'))),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
        children: [
          Text(t('Topic'), style: const TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          DropdownButtonFormField<String>(
            initialValue: _category,
            items: _categories.entries
                .map((item) => DropdownMenuItem(value: item.key, child: Text(t(item.value))))
                .toList(),
            onChanged: _saving ? null : (value) => setState(() => _category = value ?? 'account'),
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _subject,
            maxLength: 120,
            onChanged: (_) {
              if (_error != null) setState(() => _error = null);
            },
            decoration: InputDecoration(labelText: t('Subject')),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _body,
            minLines: 5,
            maxLines: 8,
            maxLength: 2000,
            onChanged: (_) {
              if (_error != null) setState(() => _error = null);
            },
            decoration: InputDecoration(
              labelText: t('What happened?'),
              alignLabelWithHint: true,
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Text(t('Screenshots'), style: const TextStyle(fontWeight: FontWeight.w700)),
              const SizedBox(width: 6),
              Text(
                t('Optional'),
                style: const TextStyle(color: MangalamTheme.muted, fontSize: 12),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              ..._photos.asMap().entries.map((entry) {
                return Stack(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: Image.memory(
                        entry.value,
                        width: 84,
                        height: 84,
                        fit: BoxFit.cover,
                      ),
                    ),
                    Positioned(
                      top: 2,
                      right: 2,
                      child: GestureDetector(
                        onTap: _saving ? null : () => setState(() => _photos.removeAt(entry.key)),
                        child: const CircleAvatar(
                          radius: 10,
                          backgroundColor: Colors.black87,
                          child: Icon(Icons.close, size: 12, color: Colors.white),
                        ),
                      ),
                    ),
                  ],
                );
              }),
              if (_photos.length < 4)
                InkWell(
                  onTap: _saving ? null : _pickPhotos,
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    width: 84,
                    height: 84,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE7E2DC)),
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Iconsax.gallery_add, color: MangalamTheme.maroon),
                        const SizedBox(height: 4),
                        Text(t('Add'), style: const TextStyle(fontSize: 11, color: MangalamTheme.muted)),
                      ],
                    ),
                  ),
                ),
            ],
          ),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(t(_error!), style: const TextStyle(color: MangalamTheme.maroon)),
          ],
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _saving ? null : _send,
            child: Text(_saving ? t('Sending…') : t('Send ticket')),
          ),
        ],
      ),
    );
  }
}

class SupportTicketScreen extends StatefulWidget {
  const SupportTicketScreen({super.key, required this.ticketId});

  final String ticketId;

  @override
  State<SupportTicketScreen> createState() => _SupportTicketScreenState();
}

class _SupportTicketScreenState extends State<SupportTicketScreen> {
  final _api = ApiClient();
  final _reply = TextEditingController();
  Map<String, dynamic>? _ticket;
  List<Map<String, dynamic>> _messages = [];
  List<Map<String, dynamic>> _events = [];
  bool _loading = true;
  bool _sending = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _reply.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = _ticket == null;
      _error = null;
    });
    try {
      final json = await _api.get('/v1/support/tickets/${widget.ticketId}') as Map<String, dynamic>;
      if (!mounted) return;
      setState(() {
        _ticket = Map<String, dynamic>.from(json['ticket'] as Map);
        _messages = ((json['messages'] as List?) ?? [])
            .map((row) => Map<String, dynamic>.from(row as Map))
            .toList();
        _events = ((json['events'] as List?) ?? [])
            .map((row) => Map<String, dynamic>.from(row as Map))
            .toList();
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = userFacingError(e);
        _loading = false;
      });
    }
  }

  List<String> _messagePhotos(Map<String, dynamic> message) {
    final raw = message['attachment_urls'];
    if (raw is! List) return const [];
    return raw.map((item) => item.toString()).where((item) => item.startsWith('https://')).toList();
  }

  void _openPhoto(BuildContext context, String url) {
    showDialog<void>(
      context: context,
      builder: (ctx) => Dialog(
        child: InteractiveViewer(child: Image.network(url)),
      ),
    );
  }

  Future<void> _send() async {
    final text = _reply.text.trim();
    if (text.isEmpty) return;
    setState(() => _sending = true);
    try {
      await _api.post('/v1/support/tickets/${widget.ticketId}/messages', {'body': text});
      _reply.clear();
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(tError(e))));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ticket = _ticket;
    final number = ticket?['ticket_number']?.toString() ?? '';
    final subject = ticket?['subject']?.toString() ?? t('Support');
    return Scaffold(
      appBar: AppBar(title: Text(number.isEmpty ? subject : '#$number')),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: MangalamTheme.maroon))
          : _error != null && ticket == null
              ? Center(child: Text(t(_error!), style: const TextStyle(color: MangalamTheme.maroon)))
              : Column(
                  children: [
                    Expanded(
                      child: ListView(
                        padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                        children: [
                          Text(subject, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                          const SizedBox(height: 6),
                          Text(
                            t(supportStatusLabel(ticket?['status']?.toString() ?? 'open')),
                            style: const TextStyle(color: MangalamTheme.maroon, fontWeight: FontWeight.w700),
                          ),
                          const SizedBox(height: 16),
                          Text(t('Status history'), style: const TextStyle(fontWeight: FontWeight.w800)),
                          const SizedBox(height: 8),
                          ..._events.map((event) {
                            final label = supportStatusLabel(event['to_status']?.toString() ?? 'open');
                            final who = event['actor_role'] == 'admin' ? t('Team') : t('You');
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 6),
                              child: Text('$who · ${t(label)}'),
                            );
                          }),
                          const SizedBox(height: 12),
                          ..._messages.map((message) {
                            final mine = message['author_role'] == 'member';
                            final photos = _messagePhotos(message);
                            return Align(
                              alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
                              child: Container(
                                margin: const EdgeInsets.only(bottom: 8),
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                                constraints: const BoxConstraints(maxWidth: 320),
                                decoration: BoxDecoration(
                                  color: mine ? MangalamTheme.maroon : const Color(0xFFF3E9DF),
                                  borderRadius: BorderRadius.circular(14),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      message['body']?.toString() ?? '',
                                      style: TextStyle(color: mine ? Colors.white : MangalamTheme.ink, height: 1.35),
                                    ),
                                    if (photos.isNotEmpty) ...[
                                      const SizedBox(height: 8),
                                      Wrap(
                                        spacing: 6,
                                        runSpacing: 6,
                                        children: photos
                                            .map(
                                              (url) => GestureDetector(
                                                onTap: () => _openPhoto(context, url),
                                                child: ClipRRect(
                                                  borderRadius: BorderRadius.circular(8),
                                                  child: Image.network(
                                                    url,
                                                    width: 92,
                                                    height: 92,
                                                    fit: BoxFit.cover,
                                                  ),
                                                ),
                                              ),
                                            )
                                            .toList(),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                            );
                          }),
                        ],
                      ),
                    ),
                    SafeArea(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                        child: Row(
                          children: [
                            Expanded(
                              child: TextField(
                                controller: _reply,
                                minLines: 1,
                                maxLines: 4,
                                maxLength: 2000,
                                decoration: InputDecoration(
                                  hintText: t('Add more detail'),
                                  counterText: '',
                                ),
                              ),
                            ),
                            IconButton(
                              onPressed: _sending ? null : _send,
                              icon: const Icon(Iconsax.send_1, color: MangalamTheme.maroon),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
    );
  }
}

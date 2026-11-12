import 'dart:async';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../services/api_client.dart';
import '../../services/photo_service.dart';
import '../core/mangalam_theme.dart';

final _apiChat = ApiClient();

class ChatScreen extends StatefulWidget {
  const ChatScreen({
    super.key,
    required this.conversationId,
    required this.otherName,
    this.otherPhotoUrls = const [],
  });

  final String conversationId;
  final String otherName;
  final List<String> otherPhotoUrls;

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _text = TextEditingController();
  final _scroll = ScrollController();
  List<dynamic> _messages = [];
  String? _error;
  bool _loading = true;
  bool _uploading = false;
  RealtimeChannel? _channel;
  final _seenIds = <String>{};

  @override
  void initState() {
    super.initState();
    _refresh();
    _subscribeRealtime();
  }

  @override
  void dispose() {
    _unsubscribeRealtime();
    _text.dispose();
    _scroll.dispose();
    super.dispose();
  }

  /// Subscribe to live INSERTs on the messages table for this conversation.
  /// New messages from the other person appear instantly without polling.
  void _subscribeRealtime() {
    _channel = Supabase.instance.client.channel('chat:${widget.conversationId}');
    _channel!
        .onPostgresChanges(
          event: PostgresChangeEvent.insert,
          schema: 'public',
          table: 'messages',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'conversation_id',
            value: widget.conversationId,
          ),
          callback: (payload) {
            final row = payload.newRecord;
            final id = row['id']?.toString();
            if (id == null || _seenIds.contains(id)) return;
            _seenIds.add(id);
            if (!mounted) return;
            setState(() {
              _messages.add(row);
            });
            _scrollToBottom();
          },
        )
        .subscribe();
  }

  void _unsubscribeRealtime() {
    if (_channel != null) {
      try {
        Supabase.instance.client.removeChannel(_channel!);
      } catch (_) {}
      _channel = null;
    }
  }

  Future<void> _refresh() async {
    if (!mounted) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final json =
          await _apiChat.get(
                '/v1/conversations/${widget.conversationId}/messages',
              )
              as Map<String, dynamic>;
      if (!mounted) return;
      final list = json['messages'] as List<dynamic>? ?? [];
      _seenIds
        ..clear()
        ..addAll(list.map((m) => (m as Map)['id'].toString()));
      setState(() {
        _messages = list;
        _loading = false;
      });
      _scrollToBottom();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.animateTo(
          _scroll.position.maxScrollExtent,
          duration: const Duration(milliseconds: 220),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _send() async {
    final body = _text.text.trim();
    if (body.isEmpty) return;
    _text.clear();
    await _sendMessage(body: body);
  }

  Future<void> _sendMessage({
    String body = '',
    String? attachmentUrl,
    String? attachmentType,
    String? attachmentName,
    String? attachmentMime,
    int? attachmentSize,
  }) async {
    try {
      final json = await _apiChat.post(
        '/v1/conversations/${widget.conversationId}/messages',
        {
          if (body.isNotEmpty) 'body': body,
          if (attachmentUrl != null) 'attachment_url': attachmentUrl,
          if (attachmentType != null) 'attachment_type': attachmentType,
          if (attachmentName != null) 'attachment_name': attachmentName,
          if (attachmentMime != null) 'attachment_mime': attachmentMime,
          if (attachmentSize != null) 'attachment_size': attachmentSize,
        },
      ) as Map<String, dynamic>;
      final msg = json['message'] as Map<String, dynamic>?;
      if (msg != null) {
        final id = msg['id']?.toString();
        if (id != null && !_seenIds.contains(id)) {
          _seenIds.add(id);
          if (mounted) {
            setState(() => _messages.add(msg));
            _scrollToBottom();
          }
        }
      }
      // Realtime will also deliver this INSERT; _seenIds dedup prevents a double.
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(e.toString())));
      }
    }
  }

  Future<void> _pickAttachment(String source) async {
    // source: image | video | file
    try {
      if (source == 'image') {
        final picker = ImagePicker();
        final f = await picker.pickImage(
          source: ImageSource.gallery,
          imageQuality: 80,
          maxWidth: 1600,
        );
        if (f != null) await _uploadAndSend(f, 'image');
      } else if (source == 'video') {
        final picker = ImagePicker();
        final f = await picker.pickVideo(
          source: ImageSource.gallery,
          maxDuration: const Duration(minutes: 5),
        );
        if (f != null) await _uploadAndSend(f, 'video');
      } else {
        final result = await FilePicker.platform.pickFiles(withData: false);
        if (result != null && result.files.isNotEmpty) {
          final pf = result.files.first;
          await _uploadAndSend(
            XFile(pf.path!, mimeType: pf.identifier, name: pf.name),
            'file',
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Could not pick file: $e')));
      }
    }
  }

  Future<void> _uploadAndSend(XFile file, String type) async {
    if (!mounted) return;
    // Show a small inline "uploading" indicator.
    setState(() => _uploading = true);
    try {
      final att = await PhotoService.uploadChatAttachment(
        conversationId: widget.conversationId,
        file: file,
        type: type,
      );
      final caption = _text.text.trim();
      if (caption.isNotEmpty) _text.clear();
      await _sendMessage(
        body: caption,
        attachmentUrl: att.url,
        attachmentType: att.type,
        attachmentName: att.name,
        attachmentMime: att.mime,
        attachmentSize: att.size,
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Upload failed: $e')));
      }
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _revealPhone() async {
    try {
      final json =
          await _apiChat.post(
                '/v1/conversations/${widget.conversationId}/reveal-phone',
                {},
              )
              as Map<String, dynamic>;
      final phone = json['revealed_phone'];
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Phone: ${phone ?? 'n/a'}')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(e.toString())));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(20),
              child: SizedBox(
                width: 40,
                height: 40,
                child: ProfilePhoto(
                  name: widget.otherName,
                  photoUrls: widget.otherPhotoUrls,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    widget.otherName,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 16,
                    ),
                  ),
                  const Text(
                    'Tap to reveal phone',
                    style: TextStyle(
                      fontSize: 11.5,
                      color: MangalamTheme.muted,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            onPressed: _revealPhone,
            icon: const Icon(Iconsax.call_calling),
            tooltip: 'Reveal phone (uses credit)',
          ),
          PopupMenuButton<String>(
            onSelected: (v) async {
              if (v == 'refresh') await _refresh();
            },
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'refresh', child: Text('Refresh')),
            ],
          ),
        ],
      ),
      body: Column(
        children: [
          if (_error != null)
            MaterialBanner(
              content: Text(_error!),
              contentTextStyle: const TextStyle(color: Colors.white),
              backgroundColor: MangalamTheme.maroon,
              actions: [
                TextButton(
                  onPressed: _refresh,
                  child: const Text(
                    'Retry',
                    style: TextStyle(color: Colors.white),
                  ),
                ),
              ],
            ),
          Expanded(
            child: _loading
                ? const Center(
                    child: CircularProgressIndicator(
                      color: MangalamTheme.maroon,
                    ),
                  )
                : _messages.isEmpty
                ? const Center(
                    child: Text(
                      'Say hello 👋',
                      style: TextStyle(
                        color: MangalamTheme.muted,
                        fontSize: 15,
                      ),
                    ),
                  )
                : Container(
                    color: MangalamTheme.cream,
                    child: ListView.builder(
                      controller: _scroll,
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                      itemCount: _messages.length,
                      itemBuilder: (context, i) {
                        final m = _messages[i] as Map<String, dynamic>;
                        final isMine = m['sender_id'] == _apiChat.currentUserId;
                        final body = m['body'] as String? ?? '';
                        return _Bubble(
                          body: body,
                          mine: isMine,
                          attachmentUrl: m['attachment_url'] as String?,
                          attachmentType: m['attachment_type'] as String?,
                          attachmentName: m['attachment_name'] as String?,
                        );
                      },
                    ),
                  ),
          ),
          SafeArea(
            child: Container(
              color: Colors.white,
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
              child: Row(
                children: [
                  _AttachButton(onPick: _pickAttachment, disabled: _uploading),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Container(
                      decoration: BoxDecoration(
                        color: const Color(0xFFF3E9DF),
                        borderRadius: BorderRadius.circular(24),
                      ),
                      child: Row(
                        children: [
                          const SizedBox(width: 12),
                          Expanded(
                            child: TextField(
                              controller: _text,
                              decoration: const InputDecoration(
                                hintText: 'Type a message',
                                border: InputBorder.none,
                                enabledBorder: InputBorder.none,
                                focusedBorder: InputBorder.none,
                              ),
                              minLines: 1,
                              maxLines: 4,
                              textInputAction: TextInputAction.send,
                              onSubmitted: (_) => _send(),
                            ),
                          ),
                          if (_uploading)
                            const Padding(
                              padding: EdgeInsets.symmetric(horizontal: 8),
                              child: SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: MangalamTheme.maroon,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Material(
                    color: MangalamTheme.maroon,
                    shape: const CircleBorder(),
                    child: InkWell(
                      customBorder: const CircleBorder(),
                      onTap: _uploading ? null : _send,
                      child: const SizedBox(
                        width: 48,
                        height: 48,
                        child: Icon(
                          Iconsax.send_1,
                          color: Colors.white,
                          size: 20,
                        ),
                      ),
                    ),
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

class _Bubble extends StatelessWidget {
  const _Bubble({
    required this.body,
    required this.mine,
    this.attachmentUrl,
    this.attachmentType,
    this.attachmentName,
  });

  final String body;
  final bool mine;
  final String? attachmentUrl;
  final String? attachmentType;
  final String? attachmentName;

  @override
  Widget build(BuildContext context) {
    final hasAttachment = attachmentUrl != null && attachmentUrl!.isNotEmpty;
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width * 0.78,
        ),
        decoration: BoxDecoration(
          gradient: mine
              ? const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [Color(0xFFE53935), Color(0xFFB71C1C)],
                )
              : null,
          color: mine ? null : Colors.white,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(18),
            topRight: const Radius.circular(18),
            bottomLeft: mine
                ? const Radius.circular(18)
                : const Radius.circular(4),
            bottomRight: mine
                ? const Radius.circular(4)
                : const Radius.circular(18),
          ),
          boxShadow: [
            BoxShadow(
              color: MangalamTheme.maroon.withValues(alpha: 0.06),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            if (hasAttachment)
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: _AttachmentView(
                  url: attachmentUrl!,
                  type: attachmentType ?? 'file',
                  name: attachmentName ?? '',
                ),
              ),
            if (body.isNotEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: Text(
                  body,
                  style: TextStyle(
                    color: mine ? Colors.white : MangalamTheme.ink,
                    fontSize: 14.5,
                    height: 1.35,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Renders an image thumbnail, a video/file chip, or a file download chip.
class _AttachmentView extends StatelessWidget {
  const _AttachmentView({
    required this.url,
    required this.type,
    required this.name,
  });

  final String url;
  final String type;
  final String name;

  @override
  Widget build(BuildContext context) {
    if (type == 'image') {
      return ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: GestureDetector(
          onTap: () => _openFullScreen(context),
          child: ConstrainedBox(
            constraints: BoxConstraints(
              maxWidth: MediaQuery.of(context).size.width * 0.6,
              maxHeight: 240,
            ),
            child: Image.network(
              url,
              fit: BoxFit.cover,
              loadingBuilder: (context, child, progress) {
                if (progress == null) return child;
                return Container(
                  width: 160,
                  height: 160,
                  color: const Color(0xFFF3E9DF),
                  alignment: Alignment.center,
                  child: const CircularProgressIndicator(
                    strokeWidth: 2,
                    color: MangalamTheme.maroon,
                  ),
                );
              },
              errorBuilder: (_, __, ___) => Container(
                width: 160,
                height: 120,
                color: const Color(0xFFF3E9DF),
                alignment: Alignment.center,
                child: const Icon(Iconsax.gallery,
                    color: MangalamTheme.muted, size: 28),
              ),
            ),
          ),
        ),
      );
    }

    final IconData icon = switch (type) {
      'video' => Iconsax.video_play,
      'audio' => Iconsax.music,
      _ => Iconsax.document_text,
    };
    final label = name.isNotEmpty ? name : 'Attachment';
    return GestureDetector(
      onTap: () async {
        final uri = Uri.parse(url);
        if (await canLaunchUrl(uri)) {
          await launchUrl(uri, mode: LaunchMode.externalApplication);
        }
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 20, color: MangalamTheme.maroon),
            const SizedBox(width: 8),
            ConstrainedBox(
              constraints: BoxConstraints(
                maxWidth: MediaQuery.of(context).size.width * 0.5,
              ),
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            const SizedBox(width: 6),
            const Icon(Iconsax.arrow_down,
                size: 14, color: MangalamTheme.maroon),
          ],
        ),
      ),
    );
  }

  void _openFullScreen(BuildContext context) {
    Navigator.of(context).push(
      PageRouteBuilder<void>(
        opaque: false,
        barrierColor: Colors.black,
        pageBuilder: (_, __, ___) => _FullScreenImage(url: url),
      ),
    );
  }
}

class _FullScreenImage extends StatelessWidget {
  const _FullScreenImage({required this.url});
  final String url;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        leading: IconButton(
          icon: const Icon(Iconsax.arrow_left),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: InteractiveViewer(
        maxScale: 4,
        child: Center(
          child: Image.network(url, fit: BoxFit.contain),
        ),
      ),
    );
  }
}

/// Paperclip button that pops up Photo / Video / File options.
class _AttachButton extends StatelessWidget {
  const _AttachButton({required this.onPick, required this.disabled});

  final void Function(String source) onPick;
  final bool disabled;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: MangalamTheme.maroon.withValues(alpha: 0.08),
      shape: const CircleBorder(),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: disabled
            ? null
            : () {
                showModalBottomSheet<String>(
                  context: context,
                  showDragHandle: true,
                  builder: (ctx) => SafeArea(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(8, 8, 8, 12),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          ListTile(
                            leading: const Icon(Iconsax.gallery),
                            title: const Text('Photo'),
                            onTap: () => Navigator.pop(ctx, 'image'),
                          ),
                          ListTile(
                            leading: const Icon(Iconsax.video_play),
                            title: const Text('Video'),
                            onTap: () => Navigator.pop(ctx, 'video'),
                          ),
                          ListTile(
                            leading: const Icon(Iconsax.document_text),
                            title: const Text('File'),
                            onTap: () => Navigator.pop(ctx, 'file'),
                          ),
                        ],
                      ),
                    ),
                  ),
                ).then((v) {
                  if (v != null) onPick(v);
                });
              },
        child: const SizedBox(
          width: 44,
          height: 44,
          child: Icon(Iconsax.paperclip_2, color: MangalamTheme.maroon, size: 20),
        ),
      ),
    );
  }
}

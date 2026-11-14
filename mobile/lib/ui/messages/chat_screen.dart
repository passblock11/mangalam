import 'dart:async';
import 'dart:convert';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../services/api_client.dart';
import '../../services/image_crop.dart';
import '../../services/photo_service.dart';
import '../core/mangalam_theme.dart';
import '../profile/membership_screen.dart';
import '../profile/profile_detail_screen.dart';
import '../../l10n/app_locale.dart';

final _apiChat = ApiClient();

/// Shows a send failure. When the wallet is short, the action opens the credit shop.
void showMessageCreditFailure(BuildContext context, Object error) {
  final short =
      error is ApiException &&
      (error.statusCode == 402 || error.message == 'Not enough contact credits.');
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      content: Text(tError(error)),
      action: short
          ? SnackBarAction(
              label: t('Buy credits'),
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute<void>(builder: (_) => const MembershipScreen()),
                );
              },
            )
          : null,
    ),
  );
}

const _attMark = '\u2063mangalam-att:';

/// Turns a stored message into the shape the bubbles expect, including
/// photos saved before the attachment columns exist.
Map<String, dynamic> _presentMessage(Map<String, dynamic> row) {
  final stored = row['body']?.toString() ?? '';
  if (stored.startsWith('mgc1:')) {
    return {...row, 'body': '', 'attachment_url': null};
  }
  if ((row['attachment_url']?.toString() ?? '').isNotEmpty) return row;
  final body = stored;
  final i = body.lastIndexOf(_attMark);
  if (i < 0) return row;
  try {
    final meta = jsonDecode(body.substring(i + _attMark.length));
    if (meta is! Map || meta['u'] == null) return row;
    return {
      ...row,
      'body': body.substring(0, i),
      'attachment_url': meta['u'],
      'attachment_type': meta['t'],
      'attachment_name': meta['n'],
    };
  } catch (_) {
    return row;
  }
}

class ChatScreen extends StatefulWidget {
  const ChatScreen({
    super.key,
    required this.conversationId,
    required this.otherName,
    this.otherProfileId,
    this.otherPhotoUrls = const [],
    this.photosLocked = false,
    this.contactLocked = false,
  });

  final String conversationId;
  final String otherName;
  final String? otherProfileId;
  final List<String> otherPhotoUrls;
  final bool photosLocked;
  final bool contactLocked;

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
  bool _sending = false;
  int? _nextCost;
  int? _credits;
  int _freeRemaining = 0;
  Timer? _syncTimer;
  bool _contactLocked = false;
  bool _photosLocked = false;
  late String _otherName;
  String? _otherId;
  List<String> _otherPhotos = const [];
  RealtimeChannel? _channel;
  final _seenIds = <String>{};

  @override
  void initState() {
    super.initState();
    _contactLocked = widget.contactLocked;
    _photosLocked = widget.photosLocked;
    _otherName = widget.otherName;
    _otherId = widget.otherProfileId;
    _otherPhotos = widget.otherPhotoUrls;
    _refresh();
    _subscribeRealtime();
    _loadContact();
  }

  void _applyOther(Object? raw) {
    if (raw is! Map) return;
    final id = raw['id']?.toString() ?? '';
    final name = raw['display_name']?.toString().trim() ?? '';
    final photos = raw['photo_urls'];
    if (!mounted) return;
    setState(() {
      if (id.isNotEmpty) _otherId = id;
      if (name.isNotEmpty) _otherName = name;
      if (photos is List) {
        _otherPhotos = photos.map((e) => e.toString()).where((e) => e.isNotEmpty).toList();
      }
      if (raw.containsKey('photos_locked')) {
        _photosLocked = raw['photos_locked'] == true;
      }
    });
  }

  Future<void> _loadContact() async {
    final id = _otherId ?? widget.otherProfileId;
    if (id == null || id.isEmpty) return;
    try {
      final json = await _apiChat.get('/v1/profiles/$id') as Map<String, dynamic>;
      final profile = json['profile'] as Map<String, dynamic>? ?? {};
      final locked = profile['contact_locked'] == true ||
          profile['contact_owner_disabled'] == true ||
          profile['phone_available'] != true;
      if (!mounted) return;
      setState(() {
        _contactLocked = locked;
        _photosLocked = profile['photos_locked'] == true;
      });
    } catch (_) {}
  }

  @override
  void dispose() {
    _syncTimer?.cancel();
    _unsubscribeRealtime();
    _text.dispose();
    _scroll.dispose();
    super.dispose();
  }

  /// Live inserts and edits. Stored text is encrypted, so the row from
  /// realtime is only a signal to reload the decrypted thread.
  void _subscribeRealtime() {
    _channel = Supabase.instance.client.channel('chat:${widget.conversationId}');
    _channel!
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'messages',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'conversation_id',
            value: widget.conversationId,
          ),
          callback: (_) => _scheduleSync(),
        )
        .subscribe();
  }

  void _scheduleSync() {
    _syncTimer?.cancel();
    _syncTimer = Timer(const Duration(milliseconds: 250), _syncQuiet);
  }

  Future<void> _syncQuiet() async {
    try {
      final json =
          await _apiChat.get(
                '/v1/conversations/${widget.conversationId}/messages',
              )
              as Map<String, dynamic>;
      if (!mounted) return;
      final list = json['messages'] as List<dynamic>? ?? [];
      _applyOther(json['other']);
      _applyBilling(json['billing']);
      final grew = list.length > _messages.length;
      _seenIds
        ..clear()
        ..addAll(list.map((m) => (m as Map)['id'].toString()));
      setState(() => _messages = list);
      if (grew) _scrollToBottom();
    } catch (_) {}
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
      _applyOther(json['other']);
      _applyBilling(json['billing']);
      await _loadContact();
      if (!mounted) return;
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
        _error = userFacingError(e);
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

  void _applyBilling(Object? raw) {
    if (raw is! Map) return;
    final next = raw['next_cost'];
    final credits = raw['contact_credits'];
    final free = raw['free_remaining'];
    if (!mounted) return;
    setState(() {
      if (next is num) _nextCost = next.toInt();
      if (credits is num) _credits = credits.toInt();
      if (free is num) _freeRemaining = free.toInt();
    });
  }

  bool _shortOfCredits() {
    final next = _nextCost;
    if (next == null || next <= 0) return false;
    return (_credits ?? 0) < next;
  }

  Future<void> _send() async {
    final body = _text.text.trim();
    if (body.isEmpty || _sending) return;
    final ok = await _sendMessage(body: body);
    if (ok) _text.clear();
  }

  Future<bool> _sendMessage({
    String body = '',
    String? attachmentUrl,
    String? attachmentType,
    String? attachmentName,
    String? attachmentMime,
    int? attachmentSize,
  }) async {
    if (_sending) return false;
    if (_shortOfCredits()) {
      if (mounted) {
        showMessageCreditFailure(
          context,
          ApiException(402, 'Not enough contact credits.'),
        );
      }
      return false;
    }
    setState(() => _sending = true);
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
      _applyBilling(json['billing']);
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
      return true;
    } catch (e) {
      if (mounted) showMessageCreditFailure(context, e);
      return false;
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _pickAttachment(String source) async {
    try {
      if (source == 'image') {
        final picker = ImagePicker();
        final f = await picker.pickImage(
          source: ImageSource.gallery,
          imageQuality: 80,
          maxWidth: 1600,
        );
        if (f != null) {
          final cropped = await ImageCrop.one(f, ImageCropKind.chat);
          if (cropped != null) await _uploadAndSend(cropped, 'image');
        }
      } else {
        final result = await FilePicker.platform.pickFiles(withData: false);
        if (result != null && result.files.isNotEmpty) {
          final pf = result.files.first;
          if (pf.size > PhotoService.maxChatBytes) {
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text(t('File is larger than 5 MB.'))),
              );
            }
            return;
          }
          if (pf.path == null) return;
          var file = XFile(pf.path!, name: pf.name);
          if (ImageCrop.isRaster(file.name)) {
            final cropped = await ImageCrop.one(file, ImageCropKind.chat);
            if (cropped == null) return;
            file = cropped;
          }
          await _uploadAndSend(file, 'file');
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(tf('Could not pick file: {error}', {'error': tError(e)}))));
      }
    }
  }

  Future<void> _uploadAndSend(XFile file, String type) async {
    if (!mounted) return;
    final size = await file.length();
    if (size > PhotoService.maxChatBytes) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(t('File is larger than 5 MB.'))),
        );
      }
      return;
    }
    setState(() => _uploading = true);
    try {
      final att = await PhotoService.uploadChatAttachment(
        conversationId: widget.conversationId,
        file: file,
        type: type,
      );
      final caption = _text.text.trim();
      final sent = await _sendMessage(
        body: caption,
        attachmentUrl: att.url,
        attachmentType: att.type,
        attachmentName: att.name,
        attachmentMime: att.mime,
        attachmentSize: att.size,
      );
      if (!sent) {
        await PhotoService.deleteChatUrl(att.url);
      } else if (caption.isNotEmpty && mounted) {
        _text.clear();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(tf('Upload failed: {error}', {'error': tError(e)}))));
      }
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  void _replaceMessage(Map<String, dynamic> msg) {
    final id = msg['id']?.toString();
    if (id == null || !mounted) return;
    final i = _messages.indexWhere((m) => (m as Map)['id'].toString() == id);
    if (i < 0) return;
    setState(() => _messages[i] = msg);
  }

  bool _hasMedia(Map<String, dynamic> m) {
    final url = m['attachment_url']?.toString() ?? '';
    return url.isNotEmpty;
  }

  Future<void> _messageActions(Map<String, dynamic> m) async {
    final canEdit = !_hasMedia(m);
    final choice = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (canEdit)
              ListTile(
                leading: const Icon(Iconsax.edit_2),
                title: Text(t('Edit message')),
                onTap: () => Navigator.pop(ctx, 'edit'),
              ),
            ListTile(
              leading: const Icon(Iconsax.trash, color: MangalamTheme.maroon),
              title: Text(t('Delete message')),
              onTap: () => Navigator.pop(ctx, 'delete'),
            ),
          ],
        ),
      ),
    );
    if (!mounted || choice == null) return;
    if (choice == 'edit' && canEdit) {
      await _editMessage(m);
    } else if (choice == 'delete') {
      await _deleteMessage(m);
    }
  }

  Future<void> _editMessage(Map<String, dynamic> m) async {
    if (_hasMedia(m)) return;
    final current = m['body']?.toString() ?? '';
    final next = await showDialog<String>(
      context: context,
      builder: (ctx) => _EditMessageDialog(initial: current),
    );
    if (next == null || !mounted) return;
    final trimmed = next.trim();
    if (trimmed.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(t('Message cannot be empty.'))),
      );
      return;
    }
    if (trimmed == current.trim()) return;
    try {
      final json = await _apiChat.patch(
        '/v1/conversations/${widget.conversationId}/messages/${m['id']}',
        {'body': trimmed},
      ) as Map<String, dynamic>;
      final msg = json['message'];
      if (msg is Map) _replaceMessage(Map<String, dynamic>.from(msg));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(tError(e))),
        );
      }
    }
  }

  Future<void> _deleteMessage(Map<String, dynamic> m) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(t('Delete message')),
        content: Text(
          t('This cannot be undone. Any photo or file in it will be removed.'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(t('Cancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(t('Delete message')),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    try {
      final json = await _apiChat.delete(
        '/v1/conversations/${widget.conversationId}/messages/${m['id']}',
      ) as Map<String, dynamic>;
      final msg = json['message'];
      if (msg is Map) _replaceMessage(Map<String, dynamic>.from(msg));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(tError(e))),
        );
      }
    }
  }

  Future<void> _openOtherProfile() async {
    final id = _otherId ?? widget.otherProfileId;
    if (id == null || id.isEmpty) return;
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => ProfileDetailScreen(profileId: id),
      ),
    );
  }

  Future<void> _revealPhone() async {
    try {
      final otherId = _otherId ?? widget.otherProfileId;
      late final Map<String, dynamic> json;
      if (otherId != null && otherId.isNotEmpty) {
        final preview = await _apiChat.post(
          '/v1/profiles/$otherId/reveal-contact',
          {'channel': 'phone', 'confirm': false},
        ) as Map<String, dynamic>;
        final cost = (preview['credit_cost'] as num?)?.toInt() ?? 1;
        if (preview['needs_confirm'] == true && cost > 0) {
          if (!mounted) return;
          final ok = await showDialog<bool>(
            context: context,
            builder: (ctx) => AlertDialog(
              title: Text(t('View this number?')),
              content: Text(tf('This uses {n} contact credits.', {'n': '$cost'})),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(ctx, false),
                  child: Text(t('Cancel')),
                ),
                FilledButton(
                  onPressed: () => Navigator.pop(ctx, true),
                  child: Text(t('View number')),
                ),
              ],
            ),
          );
          if (ok != true || !mounted) return;
          json = await _apiChat.post(
            '/v1/profiles/$otherId/reveal-contact',
            {'channel': 'phone', 'confirm': true},
          ) as Map<String, dynamic>;
        } else {
          json = preview;
        }
      } else {
        json = await _apiChat.post(
          '/v1/conversations/${widget.conversationId}/reveal-phone',
          {},
        ) as Map<String, dynamic>;
      }
      final phone = (json['value'] ?? json['revealed_phone'])?.toString().trim() ?? '';
      if (!mounted) return;
      if (phone.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(t('This member has not shared a phone number.')),
          ),
        );
        return;
      }
      await showModalBottomSheet<void>(
        context: context,
        showDragHandle: true,
        builder: (ctx) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  _otherName,
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 18,
                  ),
                ),
                const SizedBox(height: 6),
                Text(t('Phone number'),
                  style: TextStyle(color: MangalamTheme.muted, fontSize: 13),
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 14,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF7F3EE),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    phone,
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.4,
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                FilledButton.icon(
                  onPressed: () async {
                    await Clipboard.setData(ClipboardData(text: phone));
                    if (ctx.mounted) Navigator.of(ctx).pop();
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text(t('Phone number copied'))),
                      );
                    }
                  },
                  icon: const Icon(Iconsax.copy),
                  label: Text(t('Copy number')),
                ),
              ],
            ),
          ),
        ),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(tError(e))));
      }
    }
  }

  Widget? _creditHint() {
    final next = _nextCost;
    if (next == null) return null;
    if (next <= 0 && _freeRemaining <= 0) return null;
    final line = next <= 0
        ? tf('{n} free messages left in this chat', {'n': '$_freeRemaining'})
        : tf('This message uses {n} credits. {left} left.', {
            'n': '$next',
            'left': '${_credits ?? 0}',
          });
    return Padding(
      padding: const EdgeInsets.only(left: 8, right: 8, bottom: 6),
      child: Text(
        line,
        style: const TextStyle(fontSize: 11.5, color: MangalamTheme.muted),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: InkWell(
          onTap: (_otherId == null || _otherId!.isEmpty) ? null : _openOtherProfile,
          child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(20),
              child: SizedBox(
                width: 40,
                height: 40,
                child: ProfilePhoto(
                  name: _otherName,
                  photoUrls: _otherPhotos,
                  locked: _photosLocked,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _otherName,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 16,
                    ),
                  ),
                  Text(t('View profile'),
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
        ),
        actions: [
          if (!_contactLocked)
            IconButton(
              onPressed: _revealPhone,
              icon: const Icon(Iconsax.call_calling),
              tooltip: t('Reveal phone (uses credit)'),
            ),
          PopupMenuButton<String>(
            onSelected: (v) async {
              if (v == 'refresh') await _refresh();
            },
            itemBuilder: (_) => [
              PopupMenuItem(value: 'refresh', child: Text(t('Refresh'))),
            ],
          ),
        ],
      ),
      body: Column(
        children: [
          if (_error != null)
            MaterialBanner(
              content: Text(t(_error!)),
              contentTextStyle: const TextStyle(color: Colors.white),
              backgroundColor: MangalamTheme.maroon,
              actions: [
                TextButton(
                  onPressed: _refresh,
                  child: Text(t('Retry'),
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
                ? Center(
                    child: Text(t('Say hello 👋'),
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
                        final m = _presentMessage(
                          Map<String, dynamic>.from(
                            _messages[i] as Map,
                          ),
                        );
                        final isMine = m['sender_id'] == _apiChat.currentUserId;
                        final deleted = m['deleted'] == true;
                        final body = m['body'] as String? ?? '';
                        return _Bubble(
                          body: body,
                          mine: isMine,
                          deleted: deleted,
                          edited: m['edited'] == true && !deleted,
                          attachmentUrl: deleted
                              ? null
                              : m['attachment_url'] as String?,
                          attachmentType: m['attachment_type'] as String?,
                          attachmentName: m['attachment_name'] as String?,
                          onLongPress: isMine && !deleted
                              ? () => _messageActions(m)
                              : null,
                        );
                      },
                    ),
                  ),
          ),
          SafeArea(
            child: Container(
              color: Colors.white,
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  ?_creditHint(),
                  Row(
                children: [
                  _AttachButton(onPick: _pickAttachment, disabled: _uploading || _sending),
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
                              decoration: InputDecoration(
                                hintText: t('Type a message'),
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
                      onTap: _uploading || _sending ? null : _send,
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
    this.deleted = false,
    this.edited = false,
    this.onLongPress,
  });

  final String body;
  final bool mine;
  final String? attachmentUrl;
  final String? attachmentType;
  final String? attachmentName;
  final bool deleted;
  final bool edited;
  final VoidCallback? onLongPress;

  @override
  Widget build(BuildContext context) {
    final hasAttachment = attachmentUrl != null && attachmentUrl!.isNotEmpty;
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: GestureDetector(
        onLongPress: onLongPress,
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
            if (deleted)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: Text(
                  t('This message is deleted'),
                  style: TextStyle(
                    color: mine ? Colors.white70 : MangalamTheme.muted,
                    fontSize: 14,
                    fontStyle: FontStyle.italic,
                    height: 1.35,
                  ),
                ),
              )
            else ...[
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
              if (edited)
                Padding(
                  padding: const EdgeInsets.only(left: 4, top: 2),
                  child: Text(
                    t('Edited'),
                    style: TextStyle(
                      color: mine ? Colors.white70 : MangalamTheme.muted,
                      fontSize: 10,
                      fontStyle: FontStyle.italic,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
            ],
          ],
        ),
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
                            title: Text(t('Photo')),
                            subtitle: Text(t('Up to 5 MB')),
                            onTap: () => Navigator.pop(ctx, 'image'),
                          ),
                          ListTile(
                            leading: const Icon(Iconsax.document_text),
                            title: Text(t('File')),
                            subtitle: Text(t('Up to 5 MB')),
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

/// Owns the field controller until the dialog route itself is disposed.
/// Disposing it as soon as the dialog pops leaves the field attached to a
/// dead controller while the route is still animating closed.
class _EditMessageDialog extends StatefulWidget {
  const _EditMessageDialog({required this.initial});

  final String initial;

  @override
  State<_EditMessageDialog> createState() => _EditMessageDialogState();
}

class _EditMessageDialogState extends State<_EditMessageDialog> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.initial);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(t('Edit message')),
      content: TextField(
        controller: _controller,
        autofocus: true,
        maxLines: 4,
        minLines: 1,
        textCapitalization: TextCapitalization.sentences,
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text(t('Cancel')),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(context, _controller.text),
          child: Text(t('Save')),
        ),
      ],
    );
  }
}
